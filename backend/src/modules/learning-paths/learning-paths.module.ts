import { Module } from '@nestjs/common';
import { LearningPathsService } from './learning-paths.service';
import { LearningPathsController } from './learning-paths.controller';
import { ProgrammesModule } from '../programmes';

@Module({
  imports: [ProgrammesModule],
  controllers: [LearningPathsController],
  providers: [LearningPathsService],
  exports: [LearningPathsService],
})
export class LearningPathsModule {}
