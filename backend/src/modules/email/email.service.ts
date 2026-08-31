import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESService } from './ses.service';
import { SMTPService } from './smtp.service';
import { DatabaseService } from '../database/database.service';

export type EmailTransport = 'ses' | 'smtp';

export interface EmailOptions {
  from?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailLog {
  id: string;
  userId?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  from: string;
  subject: string;
  status: 'sent' | 'failed' | 'pending';
  messageId?: string;
  error?: string;
  sentAt?: Date;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * High-level email orchestration: normalises recipients, delegates the actual
 * send to SES, records every attempt in `email_logs`, and keeps templating
 * self-contained so callers only pass the data they have.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly appUrl: string;

  private readonly transport: EmailTransport;

  constructor(
    private readonly configService: ConfigService,
    private readonly sesService: SESService,
    private readonly smtpService: SMTPService,
    private readonly db: DatabaseService,
  ) {
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    // Determine transport: default to smtp if host is set, otherwise ses
    this.transport = (this.configService.get<string>('EMAIL_TRANSPORT') as EmailTransport)
      || (this.smtpService.isReady() ? 'smtp' : 'ses');
    this.logger.log(`Email transport: ${this.transport}`);
  }

  async sendEmail(
    options: EmailOptions,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { userId, metadata, ...emailOptions } = options;

      const to = Array.isArray(emailOptions.to) ? emailOptions.to : [emailOptions.to];
      const cc = emailOptions.cc
        ? Array.isArray(emailOptions.cc)
          ? emailOptions.cc
          : [emailOptions.cc]
        : undefined;
      const bcc = emailOptions.bcc
        ? Array.isArray(emailOptions.bcc)
          ? emailOptions.bcc
          : [emailOptions.bcc]
        : undefined;

      let result;
      if (this.transport === 'smtp' && this.smtpService.isReady()) {
        result = await this.smtpService.sendEmail({
          from: emailOptions.from,
          to,
          subject: emailOptions.subject,
          text: emailOptions.text,
          html: emailOptions.html,
        });
      } else {
        result = await this.sesService.sendEmail({
          from: emailOptions.from,
          to,
          cc,
          bcc,
          subject: emailOptions.subject,
          text: emailOptions.text,
          html: emailOptions.html,
        });
      }

      await this.logEmail({
        userId,
        to,
        cc,
        bcc,
        from:
          emailOptions.from || this.configService.get('EMAIL_DEFAULT_FROM', 'noreply@studyrpg.app'),
        subject: emailOptions.subject,
        status: result.status,
        messageId: result.messageId,
        error: result.error,
        sentAt: result.status === 'sent' ? new Date() : undefined,
        metadata,
      });

      return {
        success: result.status === 'sent',
        messageId: result.messageId,
        error: result.error,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send email: ${(error as Error).message}`,
        (error as Error).stack,
      );

      await this.logEmail({
        userId: options.userId,
        to: Array.isArray(options.to) ? options.to : [options.to],
        from: options.from || this.configService.get('EMAIL_DEFAULT_FROM', 'noreply@studyrpg.app'),
        subject: options.subject,
        status: 'failed',
        error: (error as Error).message,
        metadata: options.metadata,
      });

      throw error;
    }
  }

  async sendSimpleEmail(
    to: string | string[],
    subject: string,
    content: { text?: string; html?: string },
    options?: {
      from?: string;
      cc?: string | string[];
      bcc?: string | string[];
      userId?: string;
    },
  ) {
    return this.sendEmail({
      to,
      subject,
      text: content.text,
      html: content.html,
      from: options?.from,
      cc: options?.cc,
      bcc: options?.bcc,
      userId: options?.userId,
    });
  }

  async sendVerificationEmail(email: string, token: string, userId?: string): Promise<boolean> {
    const verifyUrl = `${this.appUrl}/verify-email?token=${token}`;
    const template = this.getVerificationTemplate(verifyUrl);

    const result = await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      userId,
      metadata: { type: 'verification', token },
    });

    return result.success;
  }

  async sendPasswordResetEmail(email: string, token: string, userId?: string): Promise<boolean> {
    const resetUrl = `${this.appUrl}/reset-password?token=${token}`;
    const template = this.getPasswordResetTemplate(resetUrl);

    const result = await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      userId,
      metadata: { type: 'password_reset', token },
    });

    return result.success;
  }

  async sendWelcomeEmail(email: string, name: string, userId?: string): Promise<boolean> {
    const template = this.getWelcomeTemplate(name);

    const result = await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      userId,
      metadata: { type: 'welcome' },
    });

    return result.success;
  }

  async sendStudyReminderEmail(
    email: string,
    name: string,
    streak: number,
    userId?: string,
  ): Promise<boolean> {
    const template = this.getStudyReminderTemplate(name, streak);

    const result = await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      userId,
      metadata: { type: 'study_reminder', streak },
    });

    return result.success;
  }

  async sendWeeklyDigestEmail(
    email: string,
    name: string,
    stats: { cardsReviewed: number; quizzesTaken: number; studyTime: number },
    userId?: string,
  ): Promise<boolean> {
    const template = this.getWeeklyDigestTemplate(name, stats);

    const result = await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      userId,
      metadata: { type: 'weekly_digest', stats },
    });

    return result.success;
  }

  private async logEmail(data: Omit<EmailLog, 'id' | 'createdAt'>): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO email_logs (
          user_id, "to", cc, bcc, "from", subject,
          status, message_id, error, sent_at, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [
          data.userId || null,
          data.to,
          data.cc || null,
          data.bcc || null,
          data.from,
          data.subject,
          data.status,
          data.messageId || null,
          data.error || null,
          data.sentAt || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ],
      );
    } catch (error) {
      this.logger.error(`Failed to log email: ${(error as Error).message}`);
    }
  }

  isReady(): boolean {
    return this.sesService.isReady();
  }

  getConfiguration() {
    return this.sesService.getConfiguration();
  }

  private getVerificationTemplate(verifyUrl: string): EmailTemplate {
    return {
      subject: 'Verify Your Study RPG Account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #2d2a26; background: #faf8f4; }
            .container { max-width: 600px; margin: 0 auto; padding: 24px; }
            .card { background: #ffffff; border: 1px solid #e8e2d8; border-radius: 12px; overflow: hidden; }
            .header { background: #1f3a5f; color: #ffffff; padding: 28px; text-align: center; }
            .content { padding: 28px; }
            .button { display: inline-block; background: #c97b2d; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
            .footer { text-align: center; color: #8a8378; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header"><h1 style="margin:0;">Welcome to Study RPG</h1></div>
              <div class="content">
                <p>One more step before you can start your adventure: confirm your email address so we know the account is really yours.</p>
                <p style="text-align: center;">
                  <a href="${verifyUrl}" class="button">Verify Email</a>
                </p>
                <p>Or copy this link into your browser:<br><a href="${verifyUrl}">${verifyUrl}</a></p>
                <p>This link expires in 24 hours.</p>
              </div>
            </div>
            <div class="footer">
              <p>If you didn't create this account, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Welcome to Study RPG!\n\nOne more step before you can start your adventure: confirm your email address.\n\nVerify here: ${verifyUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't create this account, you can safely ignore this email.`,
    };
  }

  private getPasswordResetTemplate(resetUrl: string): EmailTemplate {
    return {
      subject: 'Reset Your Study RPG Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #2d2a26; background: #faf8f4; }
            .container { max-width: 600px; margin: 0 auto; padding: 24px; }
            .card { background: #ffffff; border: 1px solid #e8e2d8; border-radius: 12px; overflow: hidden; }
            .header { background: #1f3a5f; color: #ffffff; padding: 28px; text-align: center; }
            .content { padding: 28px; }
            .button { display: inline-block; background: #c97b2d; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
            .footer { text-align: center; color: #8a8378; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header"><h1 style="margin:0;">Password Reset</h1></div>
              <div class="content">
                <p>We received a request to reset your password. Click below to choose a new one.</p>
                <p style="text-align: center;">
                  <a href="${resetUrl}" class="button">Reset Password</a>
                </p>
                <p>Or copy this link:<br><a href="${resetUrl}">${resetUrl}</a></p>
                <p>This link expires in 1 hour.</p>
              </div>
            </div>
            <div class="footer">
              <p>If you didn't request this reset, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Password Reset\n\nWe received a request to reset your password. Visit this link to choose a new one:\n\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this reset, you can safely ignore this email.`,
    };
  }

  private getWelcomeTemplate(name: string): EmailTemplate {
    return {
      subject: 'Welcome to Study RPG - Your Adventure Begins',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #2d2a26; background: #faf8f4; }
            .container { max-width: 600px; margin: 0 auto; padding: 24px; }
            .card { background: #ffffff; border: 1px solid #e8e2d8; border-radius: 12px; overflow: hidden; }
            .header { background: #1f3a5f; color: #ffffff; padding: 28px; text-align: center; }
            .content { padding: 28px; }
            .feature { padding: 14px 0; border-bottom: 1px solid #f0ece4; }
            .button { display: inline-block; background: #c97b2d; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header"><h1 style="margin:0;">Welcome, ${name}!</h1></div>
              <div class="content">
                <p>You're now a hero of Study RPG. Here's what awaits you:</p>
                <div class="feature"><strong>AI Flashcards & Quizzes</strong> - Turn your notes into active recall sessions in seconds</div>
                <div class="feature"><strong>Spaced repetition</strong> - A review schedule tuned to how your memory actually works</div>
                <div class="feature"><strong>Document Q&amp;A</strong> - Ask questions of your own study materials</div>
                <div class="feature"><strong>Exam practice</strong> - Mock exams, teach-back, and collaborative battles</div>
                <div class="feature"><strong>RPG progression</strong> - Level up, join a faction, and keep streaks alive</div>
                <p style="text-align: center;">
                  <a href="${this.appUrl}" class="button">Start Learning</a>
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Welcome, ${name}!\n\nYou're now a hero of Study RPG. Here's what awaits you:\n\n- AI Flashcards & Quizzes: turn notes into active recall sessions in seconds\n- Spaced repetition: a review schedule tuned to your memory\n- Document Q&A: ask questions of your own study materials\n- Exam practice: mock exams, teach-back, and collaborative battles\n- RPG progression: level up, join a faction, keep streaks alive\n\nStart learning: ${this.appUrl}`,
    };
  }

  private getStudyReminderTemplate(name: string, streak: number): EmailTemplate {
    const streakText =
      streak > 0
        ? `You have a ${streak}-day streak going — don't let the ember die!`
        : 'Start building your streak today!';

    return {
      subject: "Time to Study - Don't Break Your Streak!",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #2d2a26; background: #faf8f4; }
            .container { max-width: 600px; margin: 0 auto; padding: 24px; }
            .card { background: #ffffff; border: 1px solid #e8e2d8; border-radius: 12px; overflow: hidden; }
            .header { background: #1f3a5f; color: #ffffff; padding: 28px; text-align: center; }
            .content { padding: 28px; }
            .streak { font-size: 48px; text-align: center; color: #c97b2d; font-weight: 700; }
            .button { display: inline-block; background: #c97b2d; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header"><h1 style="margin:0;">Hey ${name}!</h1></div>
              <div class="content">
                <p class="streak">${streak} days</p>
                <p style="text-align: center;">${streakText}</p>
                <p style="text-align: center;">
                  <a href="${this.appUrl}/study" class="button">Study Now</a>
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hey ${name}!\n\n${streakText}\n\nStudy now: ${this.appUrl}/study`,
    };
  }

  private getWeeklyDigestTemplate(
    name: string,
    stats: { cardsReviewed: number; quizzesTaken: number; studyTime: number },
  ): EmailTemplate {
    const hours = Math.floor(stats.studyTime / 60);
    const minutes = stats.studyTime % 60;
    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} minutes`;

    return {
      subject: 'Your Weekly Study RPG Progress Report',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #2d2a26; background: #faf8f4; }
            .container { max-width: 600px; margin: 0 auto; padding: 24px; }
            .card { background: #ffffff; border: 1px solid #e8e2d8; border-radius: 12px; overflow: hidden; }
            .header { background: #1f3a5f; color: #ffffff; padding: 28px; text-align: center; }
            .content { padding: 28px; }
            .stats { display: flex; justify-content: space-around; text-align: center; margin: 20px 0; }
            .stat { padding: 20px; }
            .stat-value { font-size: 32px; color: #c97b2d; font-weight: 700; }
            .stat-label { color: #8a8378; font-size: 14px; }
            .button { display: inline-block; background: #c97b2d; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header"><h1 style="margin:0;">Weekly Progress</h1><p style="margin:8px 0 0;">Hey ${name}, here's your week in review</p></div>
              <div class="content">
                <div class="stats">
                  <div class="stat">
                    <div class="stat-value">${stats.cardsReviewed}</div>
                    <div class="stat-label">Cards Reviewed</div>
                  </div>
                  <div class="stat">
                    <div class="stat-value">${stats.quizzesTaken}</div>
                    <div class="stat-label">Quizzes Taken</div>
                  </div>
                  <div class="stat">
                    <div class="stat-value">${timeStr}</div>
                    <div class="stat-label">Study Time</div>
                  </div>
                </div>
                <p style="text-align: center;">
                  <a href="${this.appUrl}/analytics" class="button">View Full Report</a>
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Weekly Progress Report for ${name}\n\nCards Reviewed: ${stats.cardsReviewed}\nQuizzes Taken: ${stats.quizzesTaken}\nStudy Time: ${timeStr}\n\nView full report: ${this.appUrl}/analytics`,
    };
  }
}
