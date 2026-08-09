import { Module } from '@nestjs/common';
import { PuzzlesService } from './puzzles.service';
import { PuzzlesController } from './puzzles.controller';
import { EventsModule } from '../events';

@Module({
  imports: [EventsModule],
  controllers: [PuzzlesController],
  providers: [PuzzlesService],
  exports: [PuzzlesService],
})
export class PuzzlesModule {}
