import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIn, IsArray, IsBoolean } from 'class-validator';

export const PUZZLE_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type PuzzleDifficulty = (typeof PUZZLE_DIFFICULTIES)[number];

export class CreatePuzzleDto {
  @ApiProperty({ description: 'Subject' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ description: 'Question text' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ description: 'Choices, e.g. [{ "key": "A", "text": "..." }]' })
  @IsArray()
  choices: Array<{ key: string; text: string }>;

  @ApiProperty({ description: 'Correct choice key' })
  @IsString()
  @IsNotEmpty()
  answerKey: string;

  @ApiPropertyOptional({ description: 'Explanation' })
  @IsString()
  @IsOptional()
  explanation?: string;

  @ApiPropertyOptional({ description: 'Difficulty', enum: PUZZLE_DIFFICULTIES, default: 'medium' })
  @IsString()
  @IsOptional()
  @IsIn(PUZZLE_DIFFICULTIES)
  difficulty?: PuzzleDifficulty;
}

export class SubmitPuzzleDto {
  @ApiProperty({ description: 'Selected choice key' })
  @IsString()
  @IsNotEmpty()
  selectedKey: string;

  @ApiPropertyOptional({ description: 'Mode', enum: ['ranked', 'practice'], default: 'practice' })
  @IsString()
  @IsOptional()
  @IsIn(['ranked', 'practice'])
  mode?: string;

  @ApiPropertyOptional({ description: 'Use a streak shield (ranked only)' })
  @IsBoolean()
  @IsOptional()
  shielded?: boolean;
}

export class UpdatePuzzleDto {
  @ApiPropertyOptional({ description: 'Question text' })
  @IsString()
  @IsOptional()
  question?: string;

  @ApiPropertyOptional({ description: 'Choices' })
  @IsArray()
  @IsOptional()
  choices?: Array<{ key: string; text: string }>;

  @ApiPropertyOptional({ description: 'Correct choice key' })
  @IsString()
  @IsOptional()
  answerKey?: string;

  @ApiPropertyOptional({ description: 'Explanation' })
  @IsString()
  @IsOptional()
  explanation?: string;

  @ApiPropertyOptional({ description: 'Difficulty' })
  @IsString()
  @IsOptional()
  @IsIn(PUZZLE_DIFFICULTIES)
  difficulty?: PuzzleDifficulty;
}
