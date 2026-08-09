import { Module } from '@nestjs/common';
import { ExamPeriodsService } from './exam-periods.service';
import { ExamPeriodsController } from './exam-periods.controller';

@Module({
  controllers: [ExamPeriodsController],
  providers: [ExamPeriodsService],
  exports: [ExamPeriodsService],
})
export class ExamPeriodsModule {}
