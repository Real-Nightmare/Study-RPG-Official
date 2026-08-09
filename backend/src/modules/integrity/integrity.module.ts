import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CampfireService } from './campfire.service';
import { CampfireController } from './campfire.controller';

/**
 * Study RPG Integrity (spec 014): pure reward math + behavioural guards +
 * the metacognitive Campfire loop. Exposes CampfireService for reward-path
 * wiring (focus sessions, quizzes, exam clones, teach-back, battles).
 */
@Module({
  imports: [AiModule],
  controllers: [CampfireController],
  providers: [CampfireService],
  exports: [CampfireService],
})
export class IntegrityModule {}
