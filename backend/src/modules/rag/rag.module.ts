import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { ReindexService, ReindexJobData } from './reindex.service';
import { EvaluationService } from './evaluation.service';
import { RagController } from './rag.controller';
import { EvaluationController } from './evaluation.controller';

@Module({
  imports: [KnowledgeBaseModule],
  controllers: [RagController, EvaluationController],
  providers: [ReindexService, EvaluationService],
  exports: [ReindexService, EvaluationService],
})
export class RagModule implements OnModuleInit {
  private readonly logger = new Logger(RagModule.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly reindexService: ReindexService,
  ) {}

  async onModuleInit() {
    this.queueService.registerWorker<ReindexJobData>('rag-reindex', async (job) => {
      if (job.name === 'reindex') {
        return this.reindexService.reindex(job);
      }
      return { success: true };
    });
    this.logger.log('RAG reindex queue worker registered');
  }
}
