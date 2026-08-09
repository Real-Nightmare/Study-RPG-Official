import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsUUID,
  IsNumber,
  Min,
  IsArray,
} from 'class-validator';

export class CreateExamPeriodDto {
  @ApiProperty({ description: 'Period name (e.g. "Mid-term 2026")' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Start date (YYYY-MM-DD)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateExamPeriodDto {
  @ApiPropertyOptional({ description: 'Period name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class AttachExamsDto {
  @ApiProperty({ description: 'Exam ids to attach to the period' })
  @IsArray()
  @IsUUID('4', { each: true })
  examIds: string[];
}

export class RecordExamResultDto {
  @ApiProperty({ description: 'Marks obtained' })
  @IsNumber()
  @Min(0)
  marksObtained: number;

  @ApiProperty({ description: 'Total possible marks' })
  @IsNumber()
  @Min(1)
  marksTotal: number;

  @ApiPropertyOptional({ description: 'Mistake analysis' })
  @IsString()
  @IsOptional()
  mistakeAnalysis?: string;

  @ApiPropertyOptional({ description: 'Revision plan' })
  @IsString()
  @IsOptional()
  revisionPlan?: string;
}
