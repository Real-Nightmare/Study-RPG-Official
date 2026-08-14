import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/decorators/roles.decorator';
import { DATASET_TYPES, DatasetType } from './marketplace-config';
import { MarketplaceService } from './marketplace.service';
import { BenchmarkService } from './benchmark.service';
import { OceanNodeMonitorService } from './ocean-node-monitor.service';
import { OceanService } from './ocean.service';

class ConsentDto {
  @IsBoolean()
  consented: boolean;
}

class CreateDatasetDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(DATASET_TYPES)
  datasetType: DatasetType;

  @IsOptional()
  @IsObject()
  cohortFilters?: { country?: string; board?: string; grade?: string };

  @IsOptional()
  @IsString()
  @MaxLength(10)
  priceCurrency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceAmount?: number;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason: string;
}

class UpdateDatasetDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(DATASET_TYPES)
  datasetType?: DatasetType;

  @IsOptional()
  @IsObject()
  cohortFilters?: { country?: string; board?: string; grade?: string };

  @IsOptional()
  @IsString()
  @MaxLength(10)
  priceCurrency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceAmount?: number;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason: string;
}

class ReasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason: string;
}

class StartBenchmarkDto {
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(180)
  windowDays?: number;

  @IsOptional()
  @IsObject()
  cohortFilters?: { country?: string; board?: string; grade?: string };

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

@ApiTags('Data Marketplace')
@Controller('data-marketplace')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DataMarketplaceController {
  constructor(
    private readonly marketplace: MarketplaceService,
    private readonly benchmarks: BenchmarkService,
    private readonly oceanNode: OceanNodeMonitorService,
    private readonly ocean: OceanService,
  ) {}

  // ---------------------------------------------------------------------
  // Student consent
  // ---------------------------------------------------------------------

  @Get('consent')
  @ApiOperation({ summary: 'Current anonymised-data sharing consent' })
  consent(@CurrentUser() user: JwtPayload) {
    return this.marketplace.getConsent(user.sub);
  }

  @Put('consent')
  @ApiOperation({ summary: 'Opt in/out of anonymised aggregate data sharing (revocable)' })
  setConsent(@CurrentUser() user: JwtPayload, @Body() dto: ConsentDto) {
    return this.marketplace.setConsent(user.sub, dto.consented);
  }

  // ---------------------------------------------------------------------
  // Datasets (students see published; admins manage)
  // ---------------------------------------------------------------------

  @Get('datasets')
  @ApiOperation({ summary: 'List datasets (students see published only)' })
  listDatasets(@CurrentUser() user: JwtPayload) {
    return this.marketplace.listDatasets(user.role);
  }

  @Post('datasets')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a draft dataset (admin)' })
  createDataset(@CurrentUser() user: JwtPayload, @Body() dto: CreateDatasetDto) {
    return this.marketplace.createDataset(user.sub, dto);
  }

  @Patch('datasets/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a dataset (admin)' })
  updateDataset(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDatasetDto,
  ) {
    return this.marketplace.updateDataset(user.sub, id, dto);
  }

  @Delete('datasets/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a draft dataset (admin)' })
  deleteDataset(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ReasonDto) {
    return this.marketplace.deleteDataset(user.sub, id, dto.reason);
  }

  @Post('datasets/:id/publish')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Compute the privacy-guarded aggregate and publish it to the Ocean ecosystem (admin)',
  })
  publishDataset(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ReasonDto) {
    return this.marketplace.publishDataset(user.sub, id, dto.reason);
  }

  @Post('datasets/:id/revoke')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Revoke a published dataset (admin)' })
  revokeDataset(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ReasonDto) {
    return this.marketplace.revokeDataset(user.sub, id, dto.reason);
  }

  // ---------------------------------------------------------------------
  // Admin AI benchmarking
  // ---------------------------------------------------------------------

  @Post('benchmarks')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Start an AI effectiveness benchmark comparing two consecutive study windows (admin)',
  })
  startBenchmark(@CurrentUser() user: JwtPayload, @Body() dto: StartBenchmarkDto) {
    return this.benchmarks.start(user.sub, dto);
  }

  @Get('benchmarks')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List benchmark runs (admin)' })
  listBenchmarks(@CurrentUser() user: JwtPayload) {
    return this.benchmarks.list(user.sub);
  }

  @Get('benchmarks/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get one benchmark run with its full report (admin)' })
  getBenchmark(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.benchmarks.get(user.sub, id);
  }

  // ---------------------------------------------------------------------
  // Publish-mode status
  // ---------------------------------------------------------------------

  @Get('status')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Marketplace publish mode (wallet-optional metadata-first vs on-chain-ready)',
  })
  status() {
    return {
      ...this.ocean.getStatus(),
      oceanNode: this.oceanNode.status(),
    };
  }

  // ---------------------------------------------------------------------
  // Idle-capacity Ocean Node
  // ---------------------------------------------------------------------

  @Get('ocean-node')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Idle-capacity Ocean Node monitor status (admin)' })
  oceanNodeStatus() {
    return this.oceanNode.status();
  }
}
