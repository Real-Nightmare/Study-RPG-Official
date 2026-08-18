import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { OAuth2Client } from 'google-auth-library';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { RegisterDto, LoginDto, RefreshTokenDto, OAuthDto, SubscriptionDto } from './dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

const PASSWORD_ROUNDS = 12;
const ACCESS_TOKEN_TTL_SECONDS = 604800; // 7 days
const VERIFY_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const RESET_TOKEN_TTL_SECONDS = 60 * 60;

/**
 * Credential and social authentication. Emails are optional for accounts
 * (Phase 6): verification/welcome emails are only sent when an email exists,
 * otherwise website notifications are the channel. Registration and login both
 * attach the user's current subscription details to the response.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;
  private appleJwksClient: jwksClient.JwksClient;
  private readonly appleClientId: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly subscriptionService: SubscriptionService,
  ) {
    this.googleClient = new OAuth2Client(this.configService.get<string>('GOOGLE_CLIENT_ID'));

    // Apple Sign In public keys (rotated by Apple, cached for 24h).
    this.appleJwksClient = jwksClient({
      jwksUri: 'https://appleid.apple.com/auth/keys',
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 86400000, // 24 hours
    });
    this.appleClientId = this.configService.get<string>('APPLE_CLIENT_ID', '');
  }

  async register(dto: RegisterDto): Promise<{
    user: { id: string; email: string | null; username: string | null };
    tokens: TokenPair;
    subscription: SubscriptionDto;
  }> {
    if (!dto.email && !dto.username) {
      throw new BadRequestException('Provide an email or a username to register');
    }

    await this.ensureIdentifiersAvailable(dto);

    const hashedPassword = await bcrypt.hash(dto.password, PASSWORD_ROUNDS);
    const user = await this.usersService.create({
      email: dto.email,
      username: dto.username,
      password: hashedPassword,
      name: dto.name,
    });

    const tokens = await this.generateTokens(user.id, user.email || '', user.role);

    if (user.email) {
      await this.sendVerificationEmail(user.email, user.id);
      await this.emailService.sendWelcomeEmail(user.email, user.name || user.email);
    }

    const subscription = await this.getSubscriptionDto(user.id, user.email || '');

    return {
      user: { id: user.id, email: user.email, username: user.username },
      tokens,
      subscription,
    };
  }

  async login(dto: LoginDto): Promise<{
    user: { id: string; email: string | null; username: string | null };
    tokens: TokenPair;
    subscription: SubscriptionDto;
  }> {
    const user = await this.usersService.findByIdentifier(dto.identifier);
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account disabled — contact an administrator');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email || '', user.role);
    await this.usersService.updateLastLogin(user.id);

    const subscription = await this.getSubscriptionDto(user.id, user.email || '');

    return {
      user: { id: user.id, email: user.email, username: user.username },
      tokens,
      subscription,
    };
  }

  async refreshToken(dto: RefreshTokenDto): Promise<TokenPair> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      if (await this.redisService.exists(`blacklist:${dto.refreshToken}`)) {
        throw new UnauthorizedException('Token has been revoked');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Rotate: the presented refresh token is invalidated after use.
      await this.blacklistToken(dto.refreshToken);

      return this.generateTokens(user.id, user.email || '', user.role);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    await this.blacklistToken(refreshToken);
  }

  async googleAuth(dto: OAuthDto): Promise<{
    user: { id: string; email: string | null; username: string | null };
    tokens: TokenPair;
    subscription: SubscriptionDto;
  }> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new BadRequestException('Invalid Google token');
      }

      let user = await this.usersService.findByEmail(payload.email);
      const isNewUser = !user;

      if (!user) {
        user = await this.usersService.create({
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          googleId: payload.sub,
          avatarUrl: payload.picture,
          emailVerified: true,
        });
      } else if (!user.googleId) {
        await this.usersService.linkGoogleAccount(user.id, payload.sub);
      }

      const tokens = await this.generateTokens(user.id, user.email || '', user.role);
      await this.usersService.updateLastLogin(user.id);

      if (isNewUser && user.email) {
        await this.emailService.sendWelcomeEmail(user.email, user.name || user.email);
      }

      const subscription = await this.getSubscriptionDto(user.id, user.email || '');

      return {
        user: { id: user.id, email: user.email, username: user.username },
        tokens,
        subscription,
      };
    } catch (error) {
      this.logger.error('Google auth failed', error);
      throw new UnauthorizedException('Google authentication failed');
    }
  }

  async appleAuth(dto: OAuthDto): Promise<{
    user: { id: string; email: string | null; username: string | null };
    tokens: TokenPair;
    subscription: SubscriptionDto;
  }> {
    try {
      const identity = await this.verifyAppleIdentityToken(dto.idToken);
      if (!identity.email) {
        throw new BadRequestException('Email not provided by Apple');
      }

      let user = await this.usersService.findByEmail(identity.email);

      if (!user) {
        // Apple only provides a name on the first authorization.
        const name = dto.userData?.name || identity.email.split('@')[0];
        user = await this.usersService.create({
          email: identity.email,
          name,
          appleId: identity.sub,
          emailVerified: identity.emailVerified,
        });

        if (user.email) {
          await this.emailService.sendWelcomeEmail(user.email, user.name || user.email);
        }
      } else if (!user.appleId) {
        await this.usersService.linkAppleAccount(user.id, identity.sub);
      }

      const tokens = await this.generateTokens(user.id, user.email || '', user.role);
      await this.usersService.updateLastLogin(user.id);

      const subscription = await this.getSubscriptionDto(user.id, user.email || '');

      return {
        user: { id: user.id, email: user.email, username: user.username },
        tokens,
        subscription,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Apple auth failed', error);
      throw new UnauthorizedException('Apple authentication failed');
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Never reveal whether an address is registered.
      return;
    }

    const resetToken = uuidv4();
    await this.redisService.set(`password-reset:${resetToken}`, user.id, RESET_TOKEN_TTL_SECONDS);

    const emailSent = await this.emailService.sendPasswordResetEmail(email, resetToken);
    if (emailSent) {
      this.logger.log(`Password reset email sent to ${email}`);
    } else {
      this.logger.warn(`Failed to send password reset email to ${email}`);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.redisService.get(`password-reset:${token}`);
    if (!userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, PASSWORD_ROUNDS);
    await this.usersService.updatePassword(userId, hashedPassword);
    await this.redisService.del(`password-reset:${token}`);

    this.logger.log(`Password reset completed for user ${userId}`);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.password) {
      throw new BadRequestException('Cannot change password for this account');
    }

    const passwordMatches = await bcrypt.compare(oldPassword, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid current password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, PASSWORD_ROUNDS);
    await this.usersService.updatePassword(userId, hashedPassword);
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.redisService.get(`email-verify:${token}`);
    if (!userId) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.usersService.verifyEmail(userId);
    await this.redisService.del(`email-verify:${token}`);
  }

  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (!user.email) {
      throw new BadRequestException(
        'No email on this account — website notifications are used instead',
      );
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    await this.sendVerificationEmail(user.email, user.id);
  }

  private async sendVerificationEmail(email: string, userId: string): Promise<void> {
    const verifyToken = uuidv4();
    await this.redisService.set(`email-verify:${verifyToken}`, userId, VERIFY_TOKEN_TTL_SECONDS);
    const emailSent = await this.emailService.sendVerificationEmail(email, verifyToken);
    if (emailSent) {
      this.logger.log(`Verification email sent to ${email}`);
    } else {
      this.logger.warn(`Failed to send verification email to ${email}`);
    }
  }

  private async ensureIdentifiersAvailable(dto: RegisterDto): Promise<void> {
    if (dto.email) {
      const existing = await this.usersService.findByEmail(dto.email);
      if (existing) {
        throw new ConflictException('Email already registered');
      }
    }
    if (dto.username) {
      const existing = await this.usersService.findByUsername(dto.username);
      if (existing) {
        throw new ConflictException('Username already taken');
      }
    }
  }

  private async verifyAppleIdentityToken(idToken: string): Promise<{
    email: string | null;
    sub: string;
    emailVerified: boolean;
  }> {
    // Read the key id from the JWT header so we can fetch Apple's signing key.
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
      throw new BadRequestException('Invalid Apple token');
    }

    const key = await this.appleJwksClient.getSigningKey(decoded.header.kid);
    const publicKey = key.getPublicKey();

    const payload = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
      audience: this.appleClientId,
    }) as jwt.JwtPayload;

    return {
      email: payload.email ?? null,
      sub: payload.sub!,
      emailVerified: payload.email_verified === 'true' || payload.email_verified === true,
    };
  }

  private async generateTokens(userId: string, email: string, role: string): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION', '7d'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '30d'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  private async getSubscriptionDto(userId: string, email: string): Promise<SubscriptionDto> {
    const subscription = await this.subscriptionService.getOrCreateSubscription(userId, email);

    return {
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart || undefined,
      currentPeriodEnd: subscription.currentPeriodEnd || undefined,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
  }

  private async blacklistToken(token: string): Promise<void> {
    try {
      const payload = this.jwtService.decode(token) as { exp?: number };
      const ttl = payload?.exp ? payload.exp - Math.floor(Date.now() / 1000) : 60 * 60 * 24 * 7;
      if (ttl > 0) {
        await this.redisService.set(`blacklist:${token}`, '1', ttl);
      }
    } catch {
      // Token invalid, nothing to blacklist.
    }
  }
}
