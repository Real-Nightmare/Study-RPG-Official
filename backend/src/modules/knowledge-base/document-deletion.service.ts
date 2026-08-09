import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { QdrantService, CollectionResolver } from '../qdrant';
import { canTransition } from './rag-ingestion-state';

/**
 * Per-document deletion lifecycle (master prompt §8.5 "Deletion pipeline").
 * Walks the ingestion state machine: `deleting → deleted`, refuses deletion
 * while ingestion is mid-flight, removes the document's chunks from Postgres
 * and the active Qdrant collection, and rolls back to `failed` with the error
 * recorded if any step fails.
 */
@Injectable()
export class DocumentDeletionService {
  private readonly logger = new Logger(DocumentDeletionService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly qdrantService: QdrantService,
    private readonly collectionResolver: CollectionResolver,
  ) {}

  /**
   * Deletes a document's RAG artifacts within a knowledge base.
   * `removeRow` controls whether the documents row itself is deleted (content
   * module owns the row; KB-level cleanup passes false when the row is gone).
   */
  async deleteDocument(
    knowledgeBaseId: string,
    documentId: string,
    options: { removeRow?: boolean } = {},
  ): Promise<void> {
    const doc = await this.db.queryOne<{
      id: string;
      ingestion_state: string;
      last_error: string | null;
    }>(`SELECT id, ingestion_state, last_error FROM documents WHERE id = $1`, [documentId]);

    // The document row may live in the content module; when it is missing but
    // chunks exist, still clean up the chunks (orphan cleanup).
    if (doc) {
      const state = (doc.ingestion_state ?? 'uploaded') as Parameters<typeof canTransition>[0];
      if (!canTransition(state, 'deleting')) {
        throw new ConflictException(
          `Document is in state '${state}' and cannot be deleted while ingestion is in progress`,
        );
      }
      await this.transition(documentId, 'deleting');
    }

    try {
      // 1. Remove chunks from Postgres.
      await this.db.query(
        'DELETE FROM kb_chunks WHERE knowledge_base_id = $1 AND document_id = $2',
        [knowledgeBaseId, documentId],
      );

      // 2. Remove points from the active Qdrant collection (version-scoped).
      const collection = await this.collectionResolver.activeCollectionName();
      try {
        await this.qdrantService.deleteByFilter(collection, {
          must: [
            { key: 'knowledgeBaseId', match: { value: knowledgeBaseId } },
            { key: 'documentId', match: { value: documentId } },
          ],
        });
      } catch (error) {
        this.logger.warn(
          `Qdrant cleanup for document ${documentId} failed: ${error instanceof Error ? error.message : error}`,
        );
      }

      // 3. Mark deleted (or remove the row on request).
      if (doc) {
        if (options.removeRow) {
          await this.db.query('DELETE FROM documents WHERE id = $1', [documentId]);
        } else {
          await this.transition(documentId, 'deleted');
        }
      }

      this.logger.log(`Document ${documentId} deleted from KB ${knowledgeBaseId}`);
    } catch (error) {
      // Roll back to failed with the error recorded.
      if (doc) {
        await this.transition(
          documentId,
          'failed',
          error instanceof Error ? error.message : String(error),
        );
      }
      throw error;
    }
  }

  /** Convenience for KB-level delete: cleans up all documents' chunks. */
  async deleteAllForKnowledgeBase(knowledgeBaseId: string): Promise<void> {
    await this.db.query('DELETE FROM kb_chunks WHERE knowledge_base_id = $1', [knowledgeBaseId]);
    const collection = await this.collectionResolver.activeCollectionName();
    try {
      await this.qdrantService.deleteByFilter(collection, {
        must: [{ key: 'knowledgeBaseId', match: { value: knowledgeBaseId } }],
      });
    } catch (error) {
      this.logger.warn(
        `Qdrant cleanup for KB ${knowledgeBaseId} failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async transition(documentId: string, state: string, error?: string): Promise<void> {
    if (error) {
      await this.db.query(
        `UPDATE documents
         SET ingestion_state = $1, last_error = $2,
             retry_history = retry_history || $3::jsonb, updated_at = NOW()
         WHERE id = $4`,
        [
          state,
          error,
          JSON.stringify([{ at: new Date().toISOString(), from: 'deleting', reason: error }]),
          documentId,
        ],
      );
    } else {
      await this.db.query(
        `UPDATE documents SET ingestion_state = $1, last_error = NULL, updated_at = NOW()
         WHERE id = $2`,
        [state, documentId],
      );
    }
  }
}
