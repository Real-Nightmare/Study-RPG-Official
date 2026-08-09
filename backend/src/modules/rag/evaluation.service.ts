import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { HybridRetrieverService } from '../knowledge-base/hybrid-retriever.service';
import { buildRunReport, EvalRunReport } from './rag-eval-metrics';

export interface EvalCaseRow {
  id: string;
  knowledge_base_id: string | null;
  query: string;
  expected_document_ids: string[];
  expected_sections: string[];
  expected_pages: string[];
  relevant_chunk_ids: string[];
  distractor_chunk_ids: string[];
  created_by: string | null;
}

export interface CreateEvalCaseInput {
  knowledgeBaseId: string;
  query: string;
  expectedDocumentIds?: string[];
  expectedSections?: string[];
  expectedPages?: string[];
  relevantChunkIds: string[];
  distractorChunkIds?: string[];
}

/**
 * Retrieval evaluation (master prompt §8.10): admin-maintained, per-knowledge-base
 * test dataset plus a metric runner over the hybrid retriever.
 */
@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly hybridRetriever: HybridRetrieverService,
  ) {}

  async addCase(createdBy: string, input: CreateEvalCaseInput) {
    const kb = await this.db.queryOne<{ id: string }>(
      'SELECT id FROM knowledge_bases WHERE id = $1',
      [input.knowledgeBaseId],
    );
    if (!kb) {
      throw new NotFoundException('Knowledge base not found');
    }

    const id = uuidv4();
    const now = new Date();
    await this.db.query(
      `INSERT INTO rag_eval_cases (
        id, knowledge_base_id, query, expected_document_ids, expected_sections,
        expected_pages, relevant_chunk_ids, distractor_chunk_ids, created_by, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        input.knowledgeBaseId,
        input.query,
        JSON.stringify(input.expectedDocumentIds ?? []),
        JSON.stringify(input.expectedSections ?? []),
        JSON.stringify(input.expectedPages ?? []),
        JSON.stringify(input.relevantChunkIds),
        JSON.stringify(input.distractorChunkIds ?? []),
        createdBy,
        now,
      ],
    );
    this.logger.log(`Evaluation case created: ${id}`);
    const created = await this.getCase(id);
    if (!created) {
      throw new NotFoundException('Evaluation case not found after creation');
    }
    return this.mapCase(created);
  }

  async listCases(knowledgeBaseId?: string) {
    const rows = knowledgeBaseId
      ? await this.db.queryMany<EvalCaseRow>(
          'SELECT * FROM rag_eval_cases WHERE knowledge_base_id = $1 ORDER BY created_at ASC',
          [knowledgeBaseId],
        )
      : await this.db.queryMany<EvalCaseRow>(
          'SELECT * FROM rag_eval_cases ORDER BY created_at ASC',
        );
    return rows.map((r) => this.mapCase(r));
  }

  async deleteCase(id: string): Promise<void> {
    const result = await this.db.queryOne<{ id: string }>(
      'SELECT id FROM rag_eval_cases WHERE id = $1',
      [id],
    );
    if (!result) {
      throw new NotFoundException('Evaluation case not found');
    }
    await this.db.query('DELETE FROM rag_eval_cases WHERE id = $1', [id]);
    this.logger.log(`Evaluation case deleted: ${id}`);
  }

  async run(
    knowledgeBaseId: string,
    options: { k?: number; limit?: number } = {},
  ): Promise<EvalRunReport> {
    const k = Math.min(Math.max(options.k ?? 5, 1), 50);
    const limit = options.limit ? Math.min(Math.max(options.limit, 1), 500) : undefined;

    const kb = await this.db.queryOne<{ id: string }>(
      'SELECT id FROM knowledge_bases WHERE id = $1',
      [knowledgeBaseId],
    );
    if (!kb) {
      throw new NotFoundException('Knowledge base not found');
    }

    const rows = limit
      ? await this.db.queryMany<EvalCaseRow>(
          'SELECT * FROM rag_eval_cases WHERE knowledge_base_id = $1 ORDER BY created_at ASC LIMIT $2',
          [knowledgeBaseId, limit],
        )
      : await this.db.queryMany<EvalCaseRow>(
          'SELECT * FROM rag_eval_cases WHERE knowledge_base_id = $1 ORDER BY created_at ASC',
          [knowledgeBaseId],
        );

    const caseResults: Array<{
      caseId: string;
      query: string;
      retrievedIds: string[];
      relevantIds: string[];
      latencyMs: number;
    }> = [];
    const allRetrieved: string[] = [];

    for (const row of rows) {
      const started = Date.now();
      const results = await this.hybridRetriever.retrieve(
        knowledgeBaseId,
        'evaluation',
        row.query,
        {
          limit: k,
        },
      );
      const latencyMs = Date.now() - started;
      const retrievedIds = results.map((r) => r.chunkId);
      allRetrieved.push(...retrievedIds);
      caseResults.push({
        caseId: row.id,
        query: row.query,
        retrievedIds,
        relevantIds: row.relevant_chunk_ids ?? [],
        latencyMs,
      });
    }

    // Cross-user leakage check: every retrieved chunk must belong to this KB.
    const leakageChunkIds = await this.detectLeakage(knowledgeBaseId, allRetrieved);

    const report = buildRunReport({ k, caseResults, leakageChunkIds });
    this.logger.log(
      `Evaluation run on ${knowledgeBaseId}: ${report.caseCount} cases, ` +
        `recall@${k} ${report.aggregateRecall?.toFixed(3)}, empty ${report.emptyCount}`,
    );
    return report;
  }

  private async detectLeakage(knowledgeBaseId: string, chunkIds: string[]): Promise<string[]> {
    if (chunkIds.length === 0) {
      return [];
    }
    const rows = await this.db.queryMany<{ id: string; knowledge_base_id: string }>(
      'SELECT id, knowledge_base_id FROM kb_chunks WHERE id = ANY($1)',
      [chunkIds],
    );
    const owned = new Set(
      rows.filter((r) => r.knowledge_base_id === knowledgeBaseId).map((r) => r.id),
    );
    return chunkIds.filter((id) => !owned.has(id));
  }

  private async getCase(id: string): Promise<EvalCaseRow | null> {
    return this.db.queryOne<EvalCaseRow>('SELECT * FROM rag_eval_cases WHERE id = $1', [id]);
  }

  private mapCase(row: EvalCaseRow) {
    return {
      id: row.id,
      knowledgeBaseId: row.knowledge_base_id,
      query: row.query,
      expectedDocumentIds: row.expected_document_ids ?? [],
      expectedSections: row.expected_sections ?? [],
      expectedPages: row.expected_pages ?? [],
      relevantChunkIds: row.relevant_chunk_ids ?? [],
      distractorChunkIds: row.distractor_chunk_ids ?? [],
      createdBy: row.created_by,
    };
  }
}
