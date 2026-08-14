import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { OceanService } from './ocean.service';
import { MarketplaceService } from './marketplace.service';
import { BenchmarkService } from './benchmark.service';
import { OceanNodeMonitorService } from './ocean-node-monitor.service';
import { DataMarketplaceController } from './marketplace.controller';

/**
 * Data marketplace (owner brief): privacy-guarded aggregate datasets published
 * to the Ocean Protocol ecosystem, the admin AI benchmarking pipeline that
 * measures how much studying with Study RPG improves outcomes, and the
 * idle-capacity Ocean Node monitor that earns provider fees when the server
 * is fully idle.
 */
@Module({
  imports: [AiModule],
  controllers: [DataMarketplaceController],
  providers: [OceanService, MarketplaceService, BenchmarkService, OceanNodeMonitorService],
  exports: [OceanService, MarketplaceService, BenchmarkService, OceanNodeMonitorService],
})
export class DataMarketplaceModule {}
