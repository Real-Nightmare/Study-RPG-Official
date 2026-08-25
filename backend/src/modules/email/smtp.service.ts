import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SmtpEmailOptions {
  from?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

export interface SmtpEmailResponse {
  messageId: string;
  status: 'sent' | 'failed';
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Plain SMTP adapter (owner policy T2: email must work fully locally with no
 * AWS account). The default docker stack points this at Mailpit
 * (http://localhost:8025) so password-reset and verification emails are
 * readable during local play. Any standards-compliant SMTP relay works —
 * configure via EMAIL_TRANSPORT=smtp + MAIL_HOST/MAIL_PORT/MAIL_USERNAME/
 * MAIL_PASSWORD. Degrades gracefully when unconfigured, mirroring SESService.
 */
@Injectable()
export class SmtpService {
  private readonly logger = new Logger(SmtpService.name);
  private readonly transporter: Transporter | null = null;
  private readonly defaultFrom: string;
  private readonly isConfigured: boolean = false;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('MAIL_HOST');
    if (!host) {
      this.logger.warn(
        'SMTP host not configured (MAIL_HOST). SMTP email sending is disabled — set ' +
          'EMAIL_TRANSPORT=smtp and MAIL_HOST/MAIL_PORT to use the local Mailpit sink.',
      );
      this.isConfigured = false;
    } else {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.configService.get('MAIL_PORT', 1025)),
        secure: String(this.configService.get('MAIL_SECURE', 'false')) === 'true',
        auth:
          this.configService.get<string>('MAIL_USERNAME') ||
          this.configService.get<string>('MAIL_PASSWORD')
            ? {
                user: this.configService.get<string>('MAIL_USERNAME', ''),
                pass: this.configService.get<string>('MAIL_PASSWORD', ''),
              }
            : undefined,
        connectionTimeout: 10_000,
      });
      this.isConfigured = true;
      this.logger.log(
        `SMTP transport initialized for ${host}:${this.configService.get('MAIL_PORT', 1025)}`,
      );
    }

    this.defaultFrom = this.configService.get('EMAIL_DEFAULT_FROM', 'noreply@studyrpg.app');
  }

  isReady(): boolean {
    return this.isConfigured && this.transporter !== null;
  }

  async sendEmail(options: SmtpEmailOptions): Promise<SmtpEmailResponse> {
    if (!this.isReady()) {
      this.logger.warn('SMTP not configured. Skipping email send:', options.to);
      return { messageId: `mock-${Date.now()}`, status: 'failed', error: 'SMTP not configured' };
    }

    try {
      const info = await this.transporter!.sendMail({
        from: options.from || this.defaultFrom,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined,
        replyTo: options.replyTo
          ? Array.isArray(options.replyTo)
            ? options.replyTo.join(', ')
            : options.replyTo
          : undefined,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      this.logger.log(`Email sent via SMTP "${options.subject}" (id=${info.messageId})`);
      return {
        messageId: info.messageId,
        status: 'sent',
        details: {
          from: options.from || this.defaultFrom,
          to: Array.isArray(options.to) ? options.to : [options.to],
          subject: options.subject,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to send email via SMTP:', error);
      return {
        messageId: `error-${Date.now()}`,
        status: 'failed',
        error: (error as Error).message,
      };
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.isReady()) return false;
    try {
      await this.transporter!.verify();
      return true;
    } catch (error) {
      this.logger.error('SMTP connection test failed:', error);
      return false;
    }
  }

  getConfiguration(): {
    transport: 'smtp';
    host?: string;
    port: number;
    defaultFrom: string;
    hasCredentials: boolean;
  } {
    return {
      transport: 'smtp',
      host: this.configService.get<string>('MAIL_HOST'),
      port: Number(this.configService.get('MAIL_PORT', 1025)),
      defaultFrom: this.defaultFrom,
      hasCredentials: this.isConfigured,
    };
  }
}
