import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { EmbeddingService } from './embedding.service';
import { RerankService } from './rerank.service';

@Global()
@Module({
  controllers: [AiController],
  providers: [AiService, EmbeddingService, RerankService],
  exports: [AiService, EmbeddingService, RerankService],
})
export class AiModule {}
