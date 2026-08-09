import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListCardDto {
  @ApiProperty({ description: 'Owned card instance ID to list' })
  @IsUUID()
  cardInstanceId: string;

  @ApiProperty({ description: 'Fixed price in STP' })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  price: number;
}

export class MakeOfferDto {
  @ApiProperty({ description: 'Offer amount in STP' })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  amount: number;
}

export class MoveCardDto {
  @ApiProperty({ description: 'Target storage location', enum: ['inventory', 'vault'] })
  @IsIn(['inventory', 'vault'])
  location: 'inventory' | 'vault';
}

export class ConfirmRemovalDto {
  @ApiProperty({ description: 'Must be true — removal is permanent and irreversible' })
  @IsBoolean()
  confirm: boolean;
}

export class MarketplaceQueryDto {
  @ApiPropertyOptional({ description: 'Filter by rarity' })
  @IsString()
  @IsOptional()
  rarity?: string;

  @ApiPropertyOptional({ description: 'Filter by card key' })
  @IsString()
  @IsOptional()
  cardKey?: string;

  @ApiPropertyOptional({ description: 'Only my listings' })
  @IsBoolean()
  @IsOptional()
  mine?: boolean;
}
