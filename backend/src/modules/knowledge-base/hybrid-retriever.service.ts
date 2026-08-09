import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { QdrantService, CollectionResolver } from '../qdrant';
import { EmbeddingService } from '../ai/embedding.service';
import { RerankService } from '../ai/rerank.service';
import {
  RankedCandidate,
  reciprocalRankFusion,
  filterByMinScore,
  removeDuplicateContent,
  enforceSourceDiversity,
} from './hybrid-rank';

export type RetrievalMode = 'dense' | 'lexical' | 'hybrid';

export interface HybridRetrievalOptions {
  mode?: RetrievalMode;
  limit?: number;
  minDenseScore?: number;
  maxPerDocument?: number;
  dedupeContent?: boolean;
  rerank?: boolean;
  rerankTopK?: number;
}

export interface HybridRetrievalResult {
  chunks: RetrievedChunk[];
  reranked: boolean;
}

export interface RetrievedChunk {
  chunkId: string;
  content: string;
  score: number;
  documentId: string | null;
  metadata: Record<string, unknown>;
}

export interface LexicalCandidateRow {
  id: string;
  content: string;
  document_id: string | null;
  score: number;
}

/**
 * Hybrid retriever (master prompt §8.7): dense semantic retrieval via Qdrant,
 * lexical retrieval via PostgreSQL full-text search (GIN tsvector index added
 * by migration 017), fused with Reciprocal Rank Fusion. Ownership filters are
 * always applied — retrieval is scoped to the caller's knowledge base.
 */
@Injectable()
export class HybridRetrieverService {
  private readonly logger = new Logger(HybridRetrieverService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly qdrantService: QdrantService,
    private readonly embeddingService: EmbeddingService,
    private readonly collectionResolver: CollectionResolver,
    private readonly rerankService: RerankService,
  ) {}

  async retrieve(
    knowledgeBaseId: string,
    userId: string,
    query: string,
    options: HybridRetrievalOptions = {},
  ): Promise<RetrievedChunk[]> {
    const result = await this.retrieveWithMeta(knowledgeBaseId, userId, query, options);
    return result.chunks;
  }

  /** Same as retrieve but exposes whether the reranker was applied. */
  async retrieveWithMeta(
    knowledgeBaseId: string,
    userId: string,
    query: string,
    options: HybridRetrievalOptions = {},
  ): Promise<HybridRetrievalResult> {
    void userId; // authorisation is enforced by the caller (KnowledgeBaseService)
    const mode = options.mode ?? 'hybrid';
    const limit = Math.min(Math.max(options.limit ?? 5, 1), 50);
    const candidateLimit = limit * 3;

    // 1. Dense retrieval (Qdrant)
    let dense: RankedCandidate[] = [];
    if (mode !== 'lexical') {
      try {
        const queryEmbedding = await this.embeddingService.embed(query);
        const collection = await this.collectionResolver.activeCollectionName();
        const results = await this.qdrantService.searchWithPayloadFilter(
          collection,
          queryEmbedding.vector,
          candidateLimit,
          [{ key: 'knowledgeBaseId', match: { value: knowledgeBaseId } }],
        );
        dense = results.map((r) => ({
          id: r.id,
          score: r.score,
          documentId: (r.payload?.documentId as string) ?? null,
          payload: r.payload,
        }));
      } catch (error) {
        this.logger.warn(
          `Dense retrieval unavailable (${error instanceof Error ? error.message : 'unknown error'}) — falling back to lexical`,
        );
      }
    }

    // 2. Lexical retrieval (PostgreSQL full-text)
    let lexical: RankedCandidate[] = [];
    if (mode !== 'dense') {
      lexical = await this.lexicalSearch(knowledgeBaseId, query, candidateLimit);
    }

    // 3. Minimum dense relevance threshold
    const denseKept = filterByMinScore(dense, options.minDenseScore, 'dense');

    // 4. Rank fusion
    let fused = reciprocalRankFusion([denseKept, lexical]);

    // 5. Near-duplicate removal + source diversity
    if (options.dedupeContent !== false) {
      fused = removeDuplicateContent(fused);
    }
    fused = enforceSourceDiversity(fused, options.maxPerDocument);

    // 6. Hydrate content from the database
    const top = fused.slice(0, limit);
    if (top.length === 0) {
      return { chunks: [], reranked: false };
    }

    const chunkRows = await this.db.queryMany<{
      id: string;
      content: string;
      document_id: string | null;
    }>(`SELECT id, content, document_id FROM kb_chunks WHERE id = ANY($1)`, [top.map((c) => c.id)]);
    const chunkMap = new Map(chunkRows.map((c) => [c.id, c]));

    let results = top.map((candidate) => {
      const row = chunkMap.get(candidate.id);
      return {
        chunkId: candidate.id,
        content: row?.content ?? '',
        score: candidate.score ?? 0,
        documentId: row?.document_id ?? null,
        metadata: candidate.payload ?? {},
      };
    });

    // 7. Optional rerank stage (master prompt §8.8): re-score the top
    // candidates when requested and a provider is configured. Unconfigured
    // or failed reranking degrades gracefully to fusion order.
    let reranked = false;
    if (options.rerank && this.rerankService.isAvailable() && results.length > 0) {
      const rerankTopK = Math.min(Math.max(options.rerankTopK ?? 20, 1), 50);
      const rerankedResults = await this.rerankService.rerank(
        query,
        results.map((r) => ({
          id: r.chunkId,
          content: r.content,
          score: r.score,
          documentId: r.documentId,
          metadata: r.metadata,
        })),
        rerankTopK,
      );
      if (rerankedResults.length > 0) {
        const scoreMap = new Map(rerankedResults.map((r) => [r.id, r.score]));
        results = results
          .filter((r) => scoreMap.has(r.chunkId))
          .sort((a, b) => (scoreMap.get(b.chunkId) ?? 0) - (scoreMap.get(a.chunkId) ?? 0))
          .map((r) => ({ ...r, score: scoreMap.get(r.chunkId) ?? r.score }))
          .slice(0, limit);
        reranked = true;
        this.logger.log(
          `Reranked ${rerankedResults.length} candidates for query in KB ${knowledgeBaseId}`,
        );
      }
    }

    return { chunks: results.slice(0, limit), reranked };
  }

  private async lexicalSearch(
    knowledgeBaseId: string,
    query: string,
    limit: number,
  ): Promise<RankedCandidate[]> {
    try {
      const rows = await this.db.queryMany<LexicalCandidateRow>(
        `SELECT c.id, c.content, c.document_id, ts_rank_cd(c.tsv, q) AS score
         FROM kb_chunks c
         CROSS JOIN websearch_to_tsquery('english', $2) AS q
         WHERE c.knowledge_base_id = $1
           AND c.tsv @@ q
         ORDER BY score DESC
         LIMIT $3`,
        [knowledgeBaseId, query, limit],
      );
      return rows.map((row) => ({
        id: row.id,
        score: row.score,
        documentId: row.document_id,
        content: row.content,
        payload: { kbId: knowledgeBaseId },
      }));
    } catch (error) {
      this.logger.warn(
        `Lexical retrieval unavailable (${error instanceof Error ? error.message : 'unknown error'})`,
      );
      return [];
    }
  }
}
