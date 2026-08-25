import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateDeckDto {
  @ApiProperty({ description: 'Deck name' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @ApiProperty({ description: 'Card instance IDs (5 cards)', isArray: true, type: String })
  @IsArray()
  @IsUUID(undefined, { each: true })
  cardInstanceIds: string[];
}

export class UpdateDeckDto {
  @ApiPropertyOptional({ description: 'Deck name' })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ description: 'Card instance IDs (5 cards)', isArray: true, type: String })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  cardInstanceIds?: string[];
}

export class CreateBattleDto {
  @ApiPropertyOptional({ description: 'Monster key; random if omitted' })
  @IsString()
  @IsOptional()
  monsterKey?: string;

  @ApiPropertyOptional({ description: 'Subject being studied' })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({ description: 'Deck to use; active deck if omitted' })
  @IsUUID()
  @IsOptional()
  deckId?: string;
}

export class BattleActionDto {
  @ApiProperty({ description: 'Card instance ID to play' })
  @IsUUID()
  cardInstanceId: string;
}

export class ManaQuizDto {
  @ApiProperty({ description: 'Correct answers in the mana quiz (0-5)' })
  @IsInt()
  @Min(0)
  @Max(5)
  correctCount: number;
}

export class DamageChallengeDto {
  @ApiProperty({ description: 'Whether all damage-challenge questions were answered correctly' })
  @IsBoolean()
  allCorrect: boolean;
}

export class CreatePvpDuelDto {
  @ApiPropertyOptional({ description: 'Opponent email; omitted for random matchmaking' })
  @IsEmail()
  @IsOptional()
  opponentEmail?: string;

  @ApiPropertyOptional({ description: 'Deck to use; active deck if omitted' })
  @IsUUID()
  @IsOptional()
  deckId?: string;
}

export class SelectCharacterDto {
  @ApiProperty({
    description:
      'Archetype key (see GET /rpg/characters). Free on first pick; afterwards ' +
      'consumes a respec token.',
    example: 'lorekeeper',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  key: string;
}
