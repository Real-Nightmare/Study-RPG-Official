import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { NotImplementedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsIn,
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
import { OceanC2DService } from './ocean-c2d.service';
import { OceanService } from './ocean.service';
import { C2D_RUNNER_LANGUAGES, C2dRunnerLanguage, C2dRunnerService } from './c2d-runner.service';

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

class C2DPolicyDto {
  @IsOptional()
  @IsBoolean()
  allowRawAlgorithm?: boolean;

  /**
   * ACCEPTED FOR COMPATIBILITY BUT ALWAYS FORCED TO FALSE. Compute jobs can
   * never reach the network — the marketplace is strict compute-to-data with
   * zero exfiltration paths. Sending true is rejected outright.
   */
  @IsOptional()
  @IsBoolean()
  allowNetworkAccess?: boolean;

  @IsOptional()
  @IsString({ each: true })
  trustedAlgorithmPublishers?: string[];
}

class PublishDatasetDto extends ReasonDto {
  @IsOptional()
  @IsObject()
  c2d?: C2DPolicyDto;
}

class TestComputeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  code: string;

  @IsOptional()
  @IsIn(C2D_RUNNER_LANGUAGES as unknown as string[])
  language?: C2dRunnerLanguage;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  timeoutSeconds?: number;
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
    private readonly oceanC2d: OceanC2DService,
    private readonly runner: C2dRunnerService,
  ) {}

  /**
   * Master switch (owner policy): the data marketplace is strictly opt-in.
   * While MARKETPLACE_ENABLED=false every marketplace surface answers 501 —
   * only the internal benchmark pipeline keeps working. No dataset, consent
   * or publish route is reachable, and the idle-capacity node never starts.
   */
  private assertMarketplaceEnabled(): void {
    if (!this.oceanC2d.getConfig().enabled) {
      throw new NotImplementedException(
        'Data marketplace is disabled on this deployment (MARKETPLACE_ENABLED=false). ' +
          'Study RPG never sells or exposes study data — not even aggregates — unless an ' +
          'operator explicitly enables compute-to-data publishing.',
      );
    }
  }

  // ---------------------------------------------------------------------
  // Student consent
  // ---------------------------------------------------------------------

  @Get('consent')
  @ApiOperation({ summary: 'Current anonymised-data sharing consent' })
  consent(@CurrentUser() user: JwtPayload) {
    this.assertMarketplaceEnabled();
    return this.marketplace.getConsent(user.sub);
  }

  @Put('consent')
  @ApiOperation({ summary: 'Opt in/out of anonymised aggregate data sharing (revocable)' })
  setConsent(@CurrentUser() user: JwtPayload, @Body() dto: ConsentDto) {
    this.assertMarketplaceEnabled();
    return this.marketplace.setConsent(user.sub, dto.consented);
  }

  // ---------------------------------------------------------------------
  // Datasets (students see published; admins manage)
  // ---------------------------------------------------------------------

  @Get('datasets')
  @ApiOperation({ summary: 'List datasets (students see published only)' })
  listDatasets(@CurrentUser() user: JwtPayload) {
    this.assertMarketplaceEnabled();
    return this.marketplace.listDatasets(user.role);
  }

  @Post('datasets')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a draft dataset (admin)' })
  createDataset(@CurrentUser() user: JwtPayload, @Body() dto: CreateDatasetDto) {
    this.assertMarketplaceEnabled();
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
    this.assertMarketplaceEnabled();
    return this.marketplace.updateDataset(user.sub, id, dto);
  }

  @Delete('datasets/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a draft dataset (admin)' })
  deleteDataset(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ReasonDto) {
    this.assertMarketplaceEnabled();
    return this.marketplace.deleteDataset(user.sub, id, dto.reason);
  }

  @Post('datasets/:id/publish')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Publish a dataset as an on-chain COMPUTE-TO-DATA asset (admin). Strict C2D-only: ' +
      'there is no download/access path — buyers run algorithms on the sanitized aggregate ' +
      'inside an isolated, network-less compute environment. The dataset stays a draft ' +
      'unless the full on-chain compute asset was created.',
  })
  publishDataset(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: PublishDatasetDto,
  ) {
    this.assertMarketplaceEnabled();
    return this.marketplace.publishDataset(user.sub, id, dto.reason, dto.c2d);
  }

  @Post('datasets/:id/test-compute')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Run a researcher algorithm against the sanitized aggregate inside the isolated ' +
      'c2d-runner container (admin). This is how researchers test our compute-to-data ' +
      'system locally: the algorithm receives the privacy-guarded payload as JSON on stdin, ' +
      'has no network access and cannot reach Study RPG data outside the payload.',
  })
  async testCompute(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: TestComputeDto,
  ) {
    this.assertMarketplaceEnabled();
    return this.marketplace.testCompute(user.sub, id, dto.code, {
      language: dto.language,
      timeoutSeconds: dto.timeoutSeconds,
    });
  }

  @Post('datasets/:id/revoke')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Revoke a published dataset (admin)' })
  revokeDataset(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ReasonDto) {
    this.assertMarketplaceEnabled();
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
    summary:
      'Marketplace status: on-chain Compute-to-Data readiness, the isolated compute runner, ' +
      'and idle-capacity node state. Answers 501 while MARKETPLACE_ENABLED=false.',
  })
  async status() {
    this.assertMarketplaceEnabled();
    return {
      ...this.ocean.getStatus(),
      c2dOnly: true,
      c2d: this.oceanC2d.getStatus(),
      computeRunner: await this.runner.health(),
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
    this.assertMarketplaceEnabled();
    return this.oceanNode.status();
  }
}
