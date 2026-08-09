import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { CollectionResolver, DEFAULT_CONTENT_TYPE } from '../qdrant/collection-resolver.service';
import { EmbeddingService } from '../ai/embedding.service';

export interface ReindexJobData {
  fromVersion: string;
  toVersion: string;
}

/**
 * Background reindex pipeline (master prompt §8.9): re-embeds chunks from the
 * current collection into a target version collection, keeps the old index
 * queryable until the target is fully populated, then switches the active
 * version and purges the superseded points.
 */
@Injectable()
export class ReindexService {
  private readonly logger = new Logger(ReindexService.name);
  private readonly batchSize = 100;

  constructor(
    private readonly db: DatabaseService,
    private readonly qdrantService: QdrantService,
    private readonly embeddingService: EmbeddingService,
    private readonly collectionResolver: CollectionResolver,
  ) {}

  async reindex(job: Job<ReindexJobData>): Promise<{ reindexed: number }> {
    const { fromVersion, toVersion } = job.data;
    const contentType = DEFAULT_CONTENT_TYPE;

    const fromName = this.collectionResolver.collectionNameFor(contentType, fromVersion);
    const toName = this.collectionResolver.collectionNameFor(contentType, toVersion);

    this.logger.log(`Reindex ${contentType} from '${fromVersion}' to '${toVersion}'`);
    await this.qdrantService.createCollection(toName, this.embeddingService.getVectorDimension());

    let offset: string | undefined;
    let reindexed = 0;
    let page = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch = await this.qdrantService.scrollPoints(fromName, this.batchSize, offset);
      if (batch.length === 0) {
        break;
      }
      offset = batch[batch.length - 1].id;
      page += 1;

      const rows = await this.db.queryMany<{ id: string; content: string }>(
        'SELECT id, content FROM kb_chunks WHERE id = ANY($1)',
        [batch.map((p) => p.id)],
      );
      const contentMap = new Map(rows.map((r) => [r.id, r.content]));
      const embeddable = batch.filter((p) => contentMap.has(p.id));

      if (embeddable.length > 0) {
        const embeddings = await this.embeddingService.embedWithChunking(
          embeddable.map((p) => contentMap.get(p.id)!),
        );
        const points = embeddable.map((p, index) => ({
          id: p.id,
          vector: embeddings[index].vector,
          payload: {
            ...p.payload,
            embeddingModel: this.embeddingService.getModel(),
            embeddingVersion: toVersion,
            contentType: this.collectionResolver.slugifyVersion(this.embeddingService.getVersion()),
          },
        }));
        await this.qdrantService.upsertBatch(toName, points);
        reindexed += points.length;
      }

      if (job.updateProgress) {
        // Progress is reported as pages consumed; batches are bounded so this
        // never blocks — the active version only flips at the end.
        await job.updateProgress(Math.min(page * this.batchSize, 100));
      }
      if (batch.length < this.batchSize) {
        break;
      }
    }

    // Old index was kept queryable the whole time — now switch and purge.
    await this.collectionResolver.setActiveVersion(contentType, toVersion);
    await this.qdrantService.deletePointsByVersion(fromName, fromVersion);

    this.logger.log(`Reindex complete: ${reindexed} chunks → '${toVersion}'`);
    return { reindexed };
  }
}
