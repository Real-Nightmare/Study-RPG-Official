import { Module } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { ChunkingService } from './chunking.service';
import { DocumentProcessorService } from './document-processor.service';
import { HybridRetrieverService } from './hybrid-retriever.service';
import { DocumentDeletionService } from './document-deletion.service';

@Module({
  controllers: [KnowledgeBaseController],
  providers: [
    KnowledgeBaseService,
    ChunkingService,
    DocumentProcessorService,
    HybridRetrieverService,
    DocumentDeletionService,
  ],
  exports: [KnowledgeBaseService, ChunkingService, HybridRetrieverService, DocumentDeletionService],
})
export class KnowledgeBaseModule {}
