import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { SESService } from './ses.service';
import { SmtpService } from './smtp.service';

/**
 * Email transports (owner policy T2: fully-local by default):
 *   - `smtp`  — default. Any SMTP server; docker wires Mailpit so dev email
 *               lands in http://localhost:8025 with zero accounts.
 *   - `ses`   — opt-in AWS SES for operators who want it (needs credentials).
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [EmailService, SESService, SmtpService],
  exports: [EmailService, SESService, SmtpService],
})
export class EmailModule {}
