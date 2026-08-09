import { Module } from '@nestjs/common';
import { FactionsService } from './factions.service';
import { FactionsController } from './factions.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminModule } from '../admin';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [NotificationsModule, AdminModule, QueueModule],
  controllers: [FactionsController],
  providers: [FactionsService],
  exports: [FactionsService],
})
export class FactionsModule {}
