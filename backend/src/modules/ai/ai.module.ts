import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { EmbeddingService } from './embedding.service';
import { OllamaEmbeddingProvider } from './ollama-embedding.provider';
import { RerankService } from './rerank.service';

@Global()
@Module({
  controllers: [AiController],
  providers: [AiService, EmbeddingService, OllamaEmbeddingProvider, RerankService],
  exports: [AiService, EmbeddingService, OllamaEmbeddingProvider, RerankService],
})
export class AiModule {}
