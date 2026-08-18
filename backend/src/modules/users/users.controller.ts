import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService, UpdateUserDto } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { UserResponseDto, UserStatsDto, UpdateProfileDto } from './dto';
import { SubscriptionService } from '../subscription/subscription.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile', type: UserResponseDto })
  async getProfile(@CurrentUser() user: JwtPayload) {
    const profile = await this.usersService.findById(user.sub);
    if (!profile) {
      throw new NotFoundException('User not found');
    }

    const subscriptionData = await this.loadSubscription(user.sub, profile.email || '');

    return this.buildProfileResponse(profile, subscriptionData);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated', type: UserResponseDto })
  async updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    const updateDto: UpdateUserDto = {};
    if (dto.name !== undefined) updateDto.name = dto.name;
    if (dto.avatarUrl !== undefined) updateDto.avatarUrl = dto.avatarUrl;
    if (dto.educationLevel !== undefined) updateDto.educationLevel = dto.educationLevel;
    if (dto.subjects !== undefined) updateDto.subjects = dto.subjects;
    if (dto.profileCompleted !== undefined) updateDto.profileCompleted = dto.profileCompleted;
    if (dto.preferences !== undefined) updateDto.preferences = dto.preferences;

    const profile = await this.usersService.update(user.sub, updateDto);

    const subscriptionData = await this.loadSubscription(user.sub, profile.email || '');

    return this.buildProfileResponse(profile, subscriptionData);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete current user account' })
  @ApiResponse({ status: 204, description: 'Account deleted' })
  async deleteAccount(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.usersService.delete(user.sub);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get current user statistics' })
  @ApiResponse({ status: 200, description: 'User stats', type: UserStatsDto })
  async getStats(@CurrentUser() user: JwtPayload): Promise<UserStatsDto> {
    return this.usersService.getStats(user.sub);
  }

  @Get('me/gamification')
  @ApiOperation({ summary: 'Get current user gamification stats (XP, level, streak)' })
  @ApiResponse({ status: 200, description: 'Gamification stats' })
  async getGamification(@CurrentUser() user: JwtPayload) {
    return this.usersService.getGamification(user.sub);
  }

  @Post('me/xp')
  @ApiOperation({ summary: 'Add XP event for current user' })
  @ApiResponse({ status: 201, description: 'XP added' })
  async addXp(@CurrentUser() user: JwtPayload, @Body() body: { type: string; xp: number }) {
    await this.usersService.addXp(user.sub, body.type, body.xp);
    return { success: true };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (public profile)' })
  @ApiResponse({ status: 200, description: 'User profile', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string): Promise<Partial<UserResponseDto>> {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }

  /**
   * Fetches the user's subscription; failures degrade to a free plan rather
   * than breaking the profile request.
   */
  private async loadSubscription(
    userId: string,
    email: string,
  ): Promise<{
    plan: string;
    status: string;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null> {
    try {
      const subscription = await this.subscriptionService.getOrCreateSubscription(userId, email);
      if (!subscription) return null;

      return {
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to fetch subscription for user ${userId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Normalizes the raw billing plan for the frontend: monthly/yearly are
   * presented as 'pro', while the raw cycle is kept for billing screens.
   */
  private buildProfileResponse(
    profile: import('../users/users.service').User,
    subscription: {
      plan: string;
      status: string;
      currentPeriodStart: Date | null;
      currentPeriodEnd: Date | null;
      cancelAtPeriodEnd: boolean;
    } | null,
  ) {
    const plan = subscription?.plan || 'free';
    const planDisplay = plan === 'monthly' || plan === 'yearly' ? 'pro' : 'free';

    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      role: profile.role,
      emailVerified: profile.emailVerified,
      educationLevel: profile.educationLevel,
      subjects: profile.subjects,
      profileCompleted: profile.profileCompleted,
      preferences: profile.preferences,
      plan: planDisplay,
      billingCycle: plan === 'free' ? null : plan,
      subscription,
      createdAt: profile.createdAt,
    };
  }
}
