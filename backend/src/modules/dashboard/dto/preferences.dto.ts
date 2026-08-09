import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ description: 'Hide all game statistics from the dashboard' })
  @IsBoolean()
  @IsOptional()
  hideGameStats?: boolean;
}
