import { Module } from '@nestjs/common';
import { TeachBackService } from './teach-back.service';
import { TeachBackController } from './teach-back.controller';
import { TeachBackGateway } from './teach-back.gateway';
import { AuthModule } from '../auth/auth.module';
import { RpgModule } from '../rpg/rpg.module';
import { IntegrityModule } from '../integrity/integrity.module';

@Module({
  imports: [AuthModule, RpgModule, IntegrityModule],
  controllers: [TeachBackController],
  providers: [TeachBackService, TeachBackGateway],
  exports: [TeachBackService],
})
export class TeachBackModule {}
