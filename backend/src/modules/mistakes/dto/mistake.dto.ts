import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export const MISTAKE_CATEGORIES = ['concept', 'careless', 'time', 'guess', 'other'] as const;
export type MistakeCategory = (typeof MISTAKE_CATEGORIES)[number];

export const MISTAKE_STATUSES = ['open', 'resolved', 'reopened'] as const;
export type MistakeStatus = (typeof MISTAKE_STATUSES)[number];

export class CreateMistakeDto {
  @ApiProperty({ description: 'The question that was answered wrong' })
  @IsString()
  @IsNotEmpty()
  questionText: string;

  @ApiPropertyOptional({ description: 'Subject' })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({ description: 'Chapter' })
  @IsString()
  @IsOptional()
  chapter?: string;

  @ApiPropertyOptional({ description: 'Correct answer' })
  @IsString()
  @IsOptional()
  correctAnswer?: string;

  @ApiPropertyOptional({ description: 'What the student wrote' })
  @IsString()
  @IsOptional()
  wrongAnswer?: string;

  @ApiPropertyOptional({ description: 'Category', enum: MISTAKE_CATEGORIES })
  @IsString()
  @IsOptional()
  @IsIn(MISTAKE_CATEGORIES)
  category?: MistakeCategory;

  @ApiPropertyOptional({ description: 'Why the mistake happened' })
  @IsString()
  @IsOptional()
  cause?: string;

  @ApiPropertyOptional({ description: 'Correction note' })
  @IsString()
  @IsOptional()
  correctionNote?: string;

  @ApiPropertyOptional({ description: 'Source', default: 'manual' })
  @IsString()
  @IsOptional()
  @IsIn(['manual', 'quiz', 'exam'])
  source?: string;
}

export class UpdateMistakeDto {
  @ApiPropertyOptional({ description: 'Subject' })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({ description: 'Chapter' })
  @IsString()
  @IsOptional()
  chapter?: string;

  @ApiPropertyOptional({ description: 'Correct answer' })
  @IsString()
  @IsOptional()
  correctAnswer?: string;

  @ApiPropertyOptional({ description: 'Category' })
  @IsString()
  @IsOptional()
  @IsIn(MISTAKE_CATEGORIES)
  category?: MistakeCategory;

  @ApiPropertyOptional({ description: 'Why the mistake happened' })
  @IsString()
  @IsOptional()
  cause?: string;

  @ApiPropertyOptional({ description: 'Correction note' })
  @IsString()
  @IsOptional()
  correctionNote?: string;
}

export class ResolveMistakeDto {
  @ApiPropertyOptional({ description: 'Correction note recorded on resolution' })
  @IsString()
  @IsOptional()
  correctionNote?: string;
}
