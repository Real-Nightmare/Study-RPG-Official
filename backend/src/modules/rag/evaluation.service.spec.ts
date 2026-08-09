jest.mock('uuid', () => ({ v4: jest.fn(() => 'case-1') }));

import { NotFoundException } from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import { DatabaseService } from '../database/database.service';
import { HybridRetrieverService } from '../knowledge-base/hybrid-retriever.service';

describe('EvaluationService', () => {
  let service: EvaluationService;
  let db: { query: jest.Mock; queryOne: jest.Mock; queryMany: jest.Mock };
  let retriever: { retrieve: jest.Mock };

  const kbId = 'kb-1';

  beforeEach(() => {
    db = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      queryOne: jest.fn().mockResolvedValue(null),
      queryMany: jest.fn().mockResolvedValue([]),
    };
    retriever = { retrieve: jest.fn().mockResolvedValue([]) };
    service = new EvaluationService(
      db as unknown as DatabaseService,
      retriever as unknown as HybridRetrieverService,
    );
  });

  describe('addCase', () => {
    it('throws NotFoundException when the knowledge base does not exist', async () => {
      await expect(
        service.addCase('admin-1', {
          knowledgeBaseId: kbId,
          query: 'q',
          relevantChunkIds: ['c1'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('inserts a case when the knowledge base exists', async () => {
      db.queryOne.mockResolvedValueOnce({ id: kbId }).mockResolvedValueOnce({
        id: 'case-1',
        knowledge_base_id: kbId,
        query: 'What is photosynthesis?',
        expected_document_ids: [],
        expected_sections: [],
        expected_pages: [],
        relevant_chunk_ids: ['c1', 'c2'],
        distractor_chunk_ids: ['d1'],
        created_by: 'admin-1',
      });

      const created = await service.addCase('admin-1', {
        knowledgeBaseId: kbId,
        query: 'What is photosynthesis?',
        relevantChunkIds: ['c1', 'c2'],
        distractorChunkIds: ['d1'],
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO rag_eval_cases'),
        expect.arrayContaining(['case-1', kbId, 'What is photosynthesis?']),
      );
      expect(created.relevantChunkIds).toEqual(['c1', 'c2']);
    });
  });

  describe('run', () => {
    it('produces a report with metrics from the retriever', async () => {
      db.queryOne.mockResolvedValueOnce({ id: kbId });
      db.queryMany
        .mockResolvedValueOnce([
          {
            id: 'case-1',
            knowledge_base_id: kbId,
            query: 'photosynthesis',
            expected_document_ids: [],
            expected_sections: [],
            expected_pages: [],
            relevant_chunk_ids: ['c1', 'c2'],
            distractor_chunk_ids: [],
            created_by: null,
          },
        ])
        .mockResolvedValueOnce([
          { id: 'c1', knowledge_base_id: kbId },
          { id: 'c2', knowledge_base_id: kbId },
        ]);
      retriever.retrieve.mockResolvedValue([
        { chunkId: 'c1', content: 'x', score: 0.9, documentId: null, metadata: {} },
        { chunkId: 'c2', content: 'y', score: 0.8, documentId: null, metadata: {} },
      ]);

      const report = await service.run(kbId, { k: 5 });

      expect(retriever.retrieve).toHaveBeenCalledWith(
        kbId,
        'evaluation',
        'photosynthesis',
        expect.objectContaining({ limit: 5 }),
      );
      expect(report.caseCount).toBe(1);
      expect(report.aggregateRecall).toBe(1);
      expect(report.aggregatePrecision).toBeCloseTo(0.4, 5); // 2 hits / k=5
      expect(report.leakage.count).toBe(0);
      expect(report.cases[0].latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('flags retrieved chunks not owned by the KB as leakage', async () => {
      db.queryOne.mockResolvedValueOnce({ id: kbId });
      db.queryMany
        .mockResolvedValueOnce([
          {
            id: 'case-1',
            knowledge_base_id: kbId,
            query: 'q',
            expected_document_ids: [],
            expected_sections: [],
            expected_pages: [],
            relevant_chunk_ids: [],
            distractor_chunk_ids: [],
            created_by: null,
          },
        ])
        .mockResolvedValueOnce([{ id: 'c1', knowledge_base_id: 'other-kb' }]);
      retriever.retrieve.mockResolvedValue([
        { chunkId: 'c1', content: 'x', score: 0.5, documentId: null, metadata: {} },
      ]);

      const report = await service.run(kbId);

      expect(report.leakage.count).toBe(1);
      expect(report.leakage.chunkIds).toEqual(['c1']);
    });

    it('throws NotFoundException for an unknown knowledge base', async () => {
      await expect(service.run('missing-kb')).rejects.toThrow(NotFoundException);
    });
  });
});
