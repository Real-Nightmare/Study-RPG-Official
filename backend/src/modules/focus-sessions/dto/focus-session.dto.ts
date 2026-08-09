import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsInt, Min } from 'class-validator';

export class StartFocusSessionDto {
  @ApiPropertyOptional({ description: 'Task being worked on' })
  @IsUUID()
  @IsOptional()
  taskId?: string;

  @ApiPropertyOptional({ description: 'Subject' })
  @IsString()
  @IsOptional()
  subject?: string;
}

export class UpdateFocusSessionDto {
  @ApiPropertyOptional({ description: 'Task being worked on' })
  @IsUUID()
  @IsOptional()
  taskId?: string;

  @ApiPropertyOptional({ description: 'Subject' })
  @IsString()
  @IsOptional()
  subject?: string;
}

export class CompleteFocusSessionDto {
  @ApiPropertyOptional({ description: 'Manual focus minutes override (defaults to elapsed)' })
  @IsInt()
  @Min(0)
  @IsOptional()
  focusMinutes?: number;
}
