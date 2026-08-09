import { Module } from '@nestjs/common';
import { AdminNotesService } from './admin-notes.service';
import { AdminNotesController } from './admin-notes.controller';
import { AdminModule } from '../admin';

@Module({
  imports: [AdminModule],
  controllers: [AdminNotesController],
  providers: [AdminNotesService],
  exports: [AdminNotesService],
})
export class AdminNotesModule {}
