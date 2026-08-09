import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ChooseTrackDto {
  @IsIn(['free', 'gold'])
  track: 'free' | 'gold';
}

export class ClaimLevelDto {
  @IsInt()
  @Min(0)
  @Max(13)
  level: number;
}

export class TransferSigilDto {
  @IsUUID()
  toUserId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class UnabstractDto {
  @IsUUID()
  instanceId: string;

  @IsBoolean()
  confirm: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class LimboDto {
  @IsBoolean()
  confirm: boolean;
}

export class CreateEventDto {
  @IsString()
  @MaxLength(60)
  slug: string;

  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  story?: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  graceHours?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}

export class ActivateEventDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}

export class SeedTargetsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cardKeys?: string[];

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
