import { Module } from '@nestjs/common';
import { MistakesService } from './mistakes.service';
import { MistakesController } from './mistakes.controller';

@Module({
  controllers: [MistakesController],
  providers: [MistakesService],
  exports: [MistakesService],
})
export class MistakesModule {}
