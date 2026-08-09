import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsDateString,
  MaxLength,
} from 'class-validator';

// ---------- Academic profile ----------

export class UpdateAcademicProfileDto {
  @ApiPropertyOptional({ description: 'Country' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'School board (e.g. CBSE)' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  board?: string;

  @ApiPropertyOptional({ description: 'School name' })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  school?: string;

  @ApiPropertyOptional({ description: 'Grade (e.g. 9)' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  grade?: string;

  @ApiPropertyOptional({ description: 'Academic year (e.g. 2026-27)' })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  academicYear?: string;
}

// ---------- Subjects ----------

export class CreateSubjectDto {
  @ApiProperty({ description: 'Subject name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ description: 'Programme (e.g. Science – Biology)' })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  programme?: string;

  @ApiPropertyOptional({ description: 'Accent colour for the UI' })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ description: 'Icon name' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class UpdateSubjectDto {
  @ApiPropertyOptional({ description: 'Subject name' })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: 'Programme' })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  programme?: string;

  @ApiPropertyOptional({ description: 'Accent colour for the UI' })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ description: 'Icon name' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

// ---------- Chapters ----------

export class CreateChapterDto {
  @ApiProperty({ description: 'Chapter name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Chapter description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Order within the subject' })
  @IsInt()
  @IsOptional()
  orderIndex?: number;
}

export class UpdateChapterDto {
  @ApiPropertyOptional({ description: 'Chapter name' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Chapter description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Order within the subject' })
  @IsInt()
  @IsOptional()
  orderIndex?: number;
}

// ---------- Topics ----------

export class CreateTopicDto {
  @ApiProperty({ description: 'Topic name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Learning objective' })
  @IsString()
  @IsOptional()
  learningObjective?: string;

  @ApiPropertyOptional({ description: 'Order within the chapter' })
  @IsInt()
  @IsOptional()
  orderIndex?: number;
}

export class UpdateTopicDto {
  @ApiPropertyOptional({ description: 'Topic name' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Learning objective' })
  @IsString()
  @IsOptional()
  learningObjective?: string;

  @ApiPropertyOptional({ description: 'Order within the chapter' })
  @IsInt()
  @IsOptional()
  orderIndex?: number;
}

// ---------- Exams ----------

export class CreateExamDto {
  @ApiProperty({ description: 'Exam name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Subject ID' })
  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Exam date (ISO)' })
  @IsDateString()
  @IsOptional()
  examDate?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateExamDto {
  @ApiPropertyOptional({ description: 'Exam name' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Subject ID' })
  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Exam date (ISO)' })
  @IsDateString()
  @IsOptional()
  examDate?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

// ---------- Exam portions ----------

export class AddPortionDto {
  @ApiProperty({ description: 'Chapter ID to include in the exam portion' })
  @IsUUID()
  chapterId: string;

  @ApiPropertyOptional({ description: 'Relative weight of this portion' })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  weight?: number;
}
