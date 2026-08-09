import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  IsUUID,
  IsDateString,
} from 'class-validator';

export const TASK_TYPES = [
  'homework',
  'revision',
  'exam_prep',
  'project',
  'reading',
  'practice',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_RECURRENCE = ['none', 'daily', 'weekly', 'monthly'] as const;
export type TaskRecurrence = (typeof TASK_RECURRENCE)[number];

export class CreateTaskDto {
  @ApiProperty({ description: 'Task title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Task description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Parent task ID (for subtasks)' })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Task type', enum: TASK_TYPES, default: 'homework' })
  @IsString()
  @IsOptional()
  @IsIn(TASK_TYPES)
  taskType?: TaskType;

  @ApiPropertyOptional({ description: 'Subject' })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({ description: 'Chapter' })
  @IsString()
  @IsOptional()
  chapter?: string;

  @ApiPropertyOptional({ description: 'Priority', enum: TASK_PRIORITIES, default: 'medium' })
  @IsString()
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Due date (ISO)' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Estimated time in minutes' })
  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedMinutes?: number;

  @ApiPropertyOptional({ description: 'Recurrence', enum: TASK_RECURRENCE, default: 'none' })
  @IsString()
  @IsOptional()
  @IsIn(TASK_RECURRENCE)
  recurrence?: TaskRecurrence;
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ description: 'Task title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Task description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Parent task ID (for subtasks)' })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Task type', enum: TASK_TYPES })
  @IsString()
  @IsOptional()
  @IsIn(TASK_TYPES)
  taskType?: TaskType;

  @ApiPropertyOptional({ description: 'Subject' })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({ description: 'Chapter' })
  @IsString()
  @IsOptional()
  chapter?: string;

  @ApiPropertyOptional({ description: 'Priority', enum: TASK_PRIORITIES })
  @IsString()
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Status', enum: TASK_STATUSES })
  @IsString()
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @ApiPropertyOptional({ description: 'Due date (ISO)' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Estimated time in minutes' })
  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedMinutes?: number;

  @ApiPropertyOptional({ description: 'Actual time spent in minutes' })
  @IsInt()
  @Min(0)
  @IsOptional()
  actualMinutes?: number;

  @ApiPropertyOptional({ description: 'Recurrence', enum: TASK_RECURRENCE })
  @IsString()
  @IsOptional()
  @IsIn(TASK_RECURRENCE)
  recurrence?: TaskRecurrence;
}

export class CompleteTaskDto {
  @ApiPropertyOptional({ description: 'Actual time spent in minutes' })
  @IsInt()
  @Min(0)
  @IsOptional()
  actualMinutes?: number;
}
