import { Module } from '@nestjs/common';
import { ProgrammesService } from './programmes.service';
import { ProgrammesController } from './programmes.controller';
import { AiModule } from '../ai';
import { AdminModule } from '../admin';

@Module({
  imports: [AiModule, AdminModule],
  controllers: [ProgrammesController],
  providers: [ProgrammesService],
  exports: [ProgrammesService],
})
export class ProgrammesModule {}
