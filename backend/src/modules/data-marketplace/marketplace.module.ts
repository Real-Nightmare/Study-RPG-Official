import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { OceanService } from './ocean.service';
import { OceanC2DService } from './ocean-c2d.service';
import { MarketplaceService } from './marketplace.service';
import { BenchmarkService } from './benchmark.service';
import { OceanNodeMonitorService } from './ocean-node-monitor.service';
import { C2dRunnerService } from './c2d-runner.service';
import { DataMarketplaceController } from './marketplace.controller';

/**
 * Data marketplace (owner policy: STRICT compute-to-data only — no PII is
 * ever for sale, no download/access path exists). Datasets are published as
 * on-chain C2D assets whose jobs run inside the isolated `c2d-runner`
 * container; researchers test that system via the admin test-compute route.
 * The whole marketplace is off by default (MARKETPLACE_ENABLED=false → 501).
 * Also hosts the internal admin AI benchmarking pipeline and the
 * idle-capacity Ocean Node monitor (which never starts while disabled).
 */
@Module({
  imports: [AiModule],
  controllers: [DataMarketplaceController],
  providers: [
    OceanService,
    OceanC2DService,
    MarketplaceService,
    BenchmarkService,
    OceanNodeMonitorService,
    C2dRunnerService,
  ],
  exports: [
    OceanService,
    OceanC2DService,
    MarketplaceService,
    BenchmarkService,
    OceanNodeMonitorService,
    C2dRunnerService,
  ],
})
export class DataMarketplaceModule {}
