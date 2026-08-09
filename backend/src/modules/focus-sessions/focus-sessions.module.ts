import { Module } from '@nestjs/common';
import { FocusSessionsService } from './focus-sessions.service';
import { FocusSessionsController } from './focus-sessions.controller';
import { EventsModule } from '../events';

@Module({
  imports: [EventsModule],
  controllers: [FocusSessionsController],
  providers: [FocusSessionsService],
  exports: [FocusSessionsService],
})
export class FocusSessionsModule {}
