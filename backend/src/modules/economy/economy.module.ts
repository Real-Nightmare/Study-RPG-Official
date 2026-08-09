import { Module } from '@nestjs/common';
import { RpgModule } from '../rpg/rpg.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../events';
import { EconomyController } from './economy.controller';
import { EconomyService } from './economy.service';
import { BurnerService } from './burner.service';
import { SupplyService } from './supply.service';

/**
 * PDF Phase 6 — Economy (§16–§24): official card value, supply ledger,
 * marketplace & trades, scraper, burner with instalments, extinction.
 */
@Module({
  imports: [RpgModule, NotificationsModule, EventsModule],
  controllers: [EconomyController],
  providers: [EconomyService, BurnerService, SupplyService],
  exports: [EconomyService, BurnerService, SupplyService],
})
export class EconomyModule {}
