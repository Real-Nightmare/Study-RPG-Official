import { Module, forwardRef } from '@nestjs/common';
import { RpgModule } from '../rpg/rpg.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminModule } from '../admin';
import { EventsController } from './events.controller';
import { StudyEventsService } from './events.service';
import { QuestsService } from './quests.service';
import { EventItemsService } from './event-items.service';
import { AbstractedService } from './abstracted.service';
import { ExtinctionService } from './extinction.service';

/**
 * PDF Phase 7 — Events (§25–§30): always-active scheduler with Study Sprint
 * fallback, data-driven quests, StudyPass with Free/Gold tracks, the
 * Abstracted event (unabstracting + Limbo) and the Great Extinction
 * (targets + Sigils). Imported by RpgModule (battle win hook) via
 * `forwardRef` — the module itself needs the RPG wallet/card services.
 */
@Module({
  imports: [forwardRef(() => RpgModule), NotificationsModule, AdminModule],
  controllers: [EventsController],
  providers: [
    StudyEventsService,
    QuestsService,
    EventItemsService,
    AbstractedService,
    ExtinctionService,
  ],
  exports: [
    StudyEventsService,
    QuestsService,
    EventItemsService,
    AbstractedService,
    ExtinctionService,
  ],
})
export class EventsModule {}
