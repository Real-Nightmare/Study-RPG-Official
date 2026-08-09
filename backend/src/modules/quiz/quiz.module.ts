import { Module } from '@nestjs/common';
import { RpgModule } from '../rpg/rpg.module';
import { IntegrityModule } from '../integrity/integrity.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../events';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';
import { QuizGeneratorService } from './quiz-generator.service';
import { LiveQuizService } from './live-quiz.service';
import { LiveQuizGateway } from './live-quiz.gateway';

@Module({
  imports: [AuthModule, NotificationsModule, EventsModule, RpgModule, IntegrityModule],
  controllers: [QuizController],
  providers: [QuizService, QuizGeneratorService, LiveQuizService, LiveQuizGateway],
  exports: [QuizService, QuizGeneratorService, LiveQuizService],
})
export class QuizModule {}
