import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { EmbeddingService } from '../ai/embedding.service';

/** Version marker for the original unversioned collection (migration 018 seed). */
export const LEGACY_VERSION = 'legacy';
export const DEFAULT_CONTENT_TYPE = 'knowledge_base';

/**
 * Resolves the active Qdrant collection for a content type (master prompt §8.6).
 *
 * Precedence: explicit `QDRANT_COLLECTION_VERSION` override > persisted state
 * in `rag_index_state` > derived from the embedding provider version.
 * The special 'legacy' version maps to the original unversioned collection name
 * so existing points remain reachable until the first background reindex.
 */
@Injectable()
export class CollectionResolver {
  private readonly logger = new Logger(CollectionResolver.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly embeddingService: EmbeddingService,
    private readonly db: DatabaseService,
  ) {}

  /** Deterministic, filesystem-friendly slug of an embedding provider version. */
  slugifyVersion(version: string): string {
    const slug = version
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (slug.length <= 60) {
      return slug || 'default';
    }
    const hash = createHash('sha256').update(version).digest('hex').slice(0, 8);
    return `${slug.slice(0, 60)}_${hash}`;
  }

  /** Active version for a content type (override > persisted > derived). */
  async resolveVersion(contentType = DEFAULT_CONTENT_TYPE): Promise<string> {
    const override = this.configService.get<string>('QDRANT_COLLECTION_VERSION');
    if (override && override.trim()) {
      return override.trim();
    }

    const row = await this.db.queryOne<{ active_version: string }>(
      'SELECT active_version FROM rag_index_state WHERE content_type = $1',
      [contentType],
    );
    if (row) {
      return row.active_version;
    }

    return this.slugifyVersion(this.embeddingService.getVersion());
  }

  /** Unprefixed collection name for a content type + version ('legacy' → unversioned). */
  collectionNameFor(contentType = DEFAULT_CONTENT_TYPE, version: string): string {
    if (!version || version === LEGACY_VERSION) {
      return contentType;
    }
    return `${contentType}_${this.slugifyVersion(version)}`;
  }

  /** Unprefixed active collection name for a content type. */
  async activeCollectionName(contentType = DEFAULT_CONTENT_TYPE): Promise<string> {
    const version = await this.resolveVersion(contentType);
    return this.collectionNameFor(contentType, version);
  }

  /** Persist the active version after a completed reindex (upsert). */
  async setActiveVersion(contentType = DEFAULT_CONTENT_TYPE, version: string): Promise<void> {
    await this.db.query(
      `INSERT INTO rag_index_state (content_type, active_version, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (content_type)
       DO UPDATE SET active_version = $2, updated_at = NOW()`,
      [contentType, version],
    );
    this.logger.log(`Active ${contentType} index version set to '${version}'`);
  }
}
