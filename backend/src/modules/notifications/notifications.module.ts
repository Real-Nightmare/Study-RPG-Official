import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { WebPushService } from './web-push.service';
import { FirebaseModule } from '../firebase';
import { GatewayModule } from '../../common/gateways/gateway.module';

@Module({
  imports: [FirebaseModule, GatewayModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, WebPushService],
  exports: [NotificationsService, WebPushService],
})
export class NotificationsModule {}
