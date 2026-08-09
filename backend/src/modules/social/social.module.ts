import { Module } from '@nestjs/common';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';
import { SocialGateway } from './social.gateway';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [NotificationsModule, AdminModule],
  controllers: [SocialController],
  providers: [SocialService, SocialGateway],
  exports: [SocialService],
})
export class SocialModule {}
