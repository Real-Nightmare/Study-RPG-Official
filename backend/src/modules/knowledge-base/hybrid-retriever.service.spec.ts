import { HybridRetrieverService } from './hybrid-retriever.service';
import { DatabaseService } from '../database/database.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { CollectionResolver } from '../qdrant/collection-resolver.service';
import { EmbeddingService } from '../ai/embedding.service';
import { RerankService } from '../ai/rerank.service';

describe('HybridRetrieverService', () => {
  const kbId = 'kb-1';
  const userId = 'user-1';

  let service: HybridRetrieverService;
  let db: { queryMany: jest.Mock };
  let qdrant: {
    searchWithPayloadFilter: jest.Mock;
  };
  let embedding: { embed: jest.Mock };
  let resolver: { activeCollectionName: jest.Mock };
  let rerank: { isAvailable: jest.Mock; rerank: jest.Mock };

  beforeEach(() => {
    db = { queryMany: jest.fn().mockResolvedValue([]) };
    qdrant = { searchWithPayloadFilter: jest.fn().mockResolvedValue([]) };
    embedding = { embed: jest.fn().mockResolvedValue({ vector: [0.1, 0.2], tokens: 5 }) };
    resolver = { activeCollectionName: jest.fn().mockResolvedValue('knowledge_base') };
    rerank = {
      isAvailable: jest.fn().mockReturnValue(false),
      rerank: jest.fn().mockResolvedValue([]),
    };
    service = new HybridRetrieverService(
      db as unknown as DatabaseService,
      qdrant as unknown as QdrantService,
      embedding as unknown as EmbeddingService,
      resolver as unknown as CollectionResolver,
      rerank as unknown as RerankService,
    );
  });

  it('fuses dense and lexical results and hydrates content', async () => {
    qdrant.searchWithPayloadFilter.mockResolvedValue([
      { id: 'c1', score: 0.92, payload: { documentId: 'd1' } },
      { id: 'c2', score: 0.7, payload: { documentId: 'd1' } },
    ]);
    db.queryMany.mockImplementation(async (sql: string) => {
      if (sql.includes('websearch_to_tsquery')) {
        return [
          { id: 'c2', content: 'lexical hit', document_id: 'd1', score: 0.6 },
          { id: 'c3', content: 'another hit', document_id: 'd2', score: 0.5 },
        ];
      }
      if (sql.includes('FROM kb_chunks')) {
        return [
          { id: 'c1', content: 'dense hit a', document_id: 'd1' },
          { id: 'c2', content: 'lexical hit', document_id: 'd1' },
          { id: 'c3', content: 'another hit', document_id: 'd2' },
        ];
      }
      return [];
    });

    const results = await service.retrieve(kbId, userId, 'photosynthesis', { limit: 3 });

    expect(results).toHaveLength(3);
    expect(results.map((r) => r.chunkId)).toContain('c2'); // present in both lists
    expect(results[0].content).toBeDefined();
    expect(qdrant.searchWithPayloadFilter).toHaveBeenCalledWith(
      expect.any(String),
      [0.1, 0.2],
      expect.any(Number),
      expect.arrayContaining([{ key: 'knowledgeBaseId', match: { value: kbId } }]),
    );
  });

  it('falls back to lexical-only when dense retrieval fails', async () => {
    embedding.embed.mockRejectedValue(new Error('no API key'));
    db.queryMany.mockImplementation(async (sql: string) => {
      if (sql.includes('websearch_to_tsquery')) {
        return [{ id: 'c3', content: 'lexical hit', document_id: 'd2', score: 0.5 }];
      }
      if (sql.includes('FROM kb_chunks')) {
        return [{ id: 'c3', content: 'lexical hit', document_id: 'd2' }];
      }
      return [];
    });

    const results = await service.retrieve(kbId, userId, 'gravity', { mode: 'hybrid' });

    expect(results).toHaveLength(1);
    expect(results[0].chunkId).toBe('c3');
  });

  it('honours mode=lexical (no Qdrant call)', async () => {
    db.queryMany.mockResolvedValue([
      { id: 'c3', content: 'lexical hit', document_id: null, score: 0.5 },
    ]);

    const results = await service.retrieve(kbId, userId, 'gravity', { mode: 'lexical' });

    expect(qdrant.searchWithPayloadFilter).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
  });

  it('filters dense results below minScore before fusion', async () => {
    qdrant.searchWithPayloadFilter.mockResolvedValue([{ id: 'c1', score: 0.3, payload: {} }]);
    db.queryMany.mockResolvedValue([]);

    const results = await service.retrieve(kbId, userId, 'query', {
      mode: 'dense',
      minDenseScore: 0.5,
    });

    expect(results).toHaveLength(0);
  });

  it('returns empty when nothing matches', async () => {
    const results = await service.retrieve(kbId, userId, 'nothing relevant');
    expect(results).toEqual([]);
  });

  it('reranks candidates when requested and provider available', async () => {
    qdrant.searchWithPayloadFilter.mockResolvedValue([
      { id: 'c1', score: 0.9, payload: { documentId: 'd1' } },
      { id: 'c2', score: 0.8, payload: { documentId: 'd1' } },
    ]);
    db.queryMany.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM kb_chunks')) {
        return [
          { id: 'c1', content: 'one', document_id: 'd1' },
          { id: 'c2', content: 'two', document_id: 'd1' },
        ];
      }
      return [];
    });
    rerank.isAvailable.mockReturnValue(true);
    rerank.rerank.mockResolvedValue([
      { id: 'c2', score: 0.99 },
      { id: 'c1', score: 0.4 },
    ]);

    const result = await service.retrieveWithMeta(kbId, userId, 'query', {
      rerank: true,
      limit: 2,
    });

    expect(result.reranked).toBe(true);
    expect(result.chunks.map((c) => c.chunkId)).toEqual(['c2', 'c1']);
    expect(result.chunks[0].score).toBeCloseTo(0.99, 5);
    expect(rerank.rerank).toHaveBeenCalledWith('query', expect.any(Array), expect.any(Number));
  });

  it('keeps fusion order when rerank unavailable', async () => {
    qdrant.searchWithPayloadFilter.mockResolvedValue([
      { id: 'c1', score: 0.9, payload: { documentId: 'd1' } },
    ]);
    db.queryMany.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM kb_chunks')) {
        return [{ id: 'c1', content: 'one', document_id: 'd1' }];
      }
      return [];
    });
    rerank.isAvailable.mockReturnValue(false);

    const result = await service.retrieveWithMeta(kbId, userId, 'query', { rerank: true });

    expect(result.reranked).toBe(false);
    expect(result.chunks.map((c) => c.chunkId)).toEqual(['c1']);
    expect(rerank.rerank).not.toHaveBeenCalled();
  });
});
