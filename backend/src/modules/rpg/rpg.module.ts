import { Module, forwardRef } from '@nestjs/common';
import { RpgController } from './rpg.controller';
import { PlayerService } from './player.service';
import { WalletService } from './wallet.service';
import { CardService } from './card.service';
import { BattleService } from './battle.service';
import { PvpService } from './pvp.service';
import { PartyService } from './party.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../events/events.module';
import { IntegrityModule } from '../integrity/integrity.module';

@Module({
  imports: [NotificationsModule, forwardRef(() => EventsModule), IntegrityModule],
  controllers: [RpgController],
  providers: [PlayerService, WalletService, CardService, BattleService, PvpService, PartyService],
  exports: [PlayerService, WalletService, CardService, BattleService, PvpService, PartyService],
})
export class RpgModule {}
