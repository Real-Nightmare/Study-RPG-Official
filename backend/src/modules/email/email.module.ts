import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { SESService } from './ses.service';
import { SMTPService } from './smtp.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [EmailService, SESService, SMTPService],
  exports: [EmailService, SESService, SMTPService],
})
export class EmailModule {}
