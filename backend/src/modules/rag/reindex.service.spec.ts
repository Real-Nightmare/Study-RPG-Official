import { Job } from 'bullmq';
import { ReindexService, ReindexJobData } from './reindex.service';
import { DatabaseService } from '../database/database.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { CollectionResolver, LEGACY_VERSION } from '../qdrant/collection-resolver.service';
import { EmbeddingService } from '../ai/embedding.service';

describe('ReindexService', () => {
  let service: ReindexService;
  let db: { queryMany: jest.Mock };
  let qdrant: {
    createCollection: jest.Mock;
    scrollPoints: jest.Mock;
    upsertBatch: jest.Mock;
    deletePointsByVersion: jest.Mock;
  };
  let resolver: {
    collectionNameFor: jest.Mock;
    setActiveVersion: jest.Mock;
    slugifyVersion: jest.Mock;
  };
  let embedding: {
    getVectorDimension: jest.Mock;
    getModel: jest.Mock;
    getVersion: jest.Mock;
    embedWithChunking: jest.Mock;
  };
  let job: Job<ReindexJobData>;

  beforeEach(() => {
    db = { queryMany: jest.fn().mockResolvedValue([]) };
    qdrant = {
      createCollection: jest.fn().mockResolvedValue(undefined),
      scrollPoints: jest.fn().mockResolvedValue([]),
      upsertBatch: jest.fn().mockResolvedValue(undefined),
      deletePointsByVersion: jest.fn().mockResolvedValue(undefined),
    };
    resolver = {
      collectionNameFor: jest.fn((ct, v) => (v === LEGACY_VERSION ? ct : `${ct}_${v}`)),
      setActiveVersion: jest.fn().mockResolvedValue(undefined),
      slugifyVersion: jest.fn((v) => `slug_${v}`),
    };
    embedding = {
      getVectorDimension: jest.fn().mockReturnValue(1536),
      getModel: jest.fn().mockReturnValue('openai/text-embedding-3-small'),
      getVersion: jest.fn().mockReturnValue('openai/text-embedding-3-small@1536'),
      embedWithChunking: jest.fn().mockResolvedValue([{ vector: [0.1, 0.2], tokens: 4 }]),
    };
    job = {
      data: { fromVersion: LEGACY_VERSION, toVersion: 'v2' },
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as unknown as Job<ReindexJobData>;
    service = new ReindexService(
      db as unknown as DatabaseService,
      qdrant as unknown as QdrantService,
      embedding as unknown as EmbeddingService,
      resolver as unknown as CollectionResolver,
    );
  });

  it('creates the target collection and switches only after upserting', async () => {
    qdrant.scrollPoints
      .mockResolvedValueOnce([
        { id: 'c1', payload: { knowledgeBaseId: 'kb1' } },
        { id: 'c2', payload: { knowledgeBaseId: 'kb1' } },
      ])
      .mockResolvedValueOnce([]);
    db.queryMany.mockResolvedValue([
      { id: 'c1', content: 'content one' },
      { id: 'c2', content: 'content two' },
    ]);
    embedding.embedWithChunking.mockResolvedValue([
      { vector: [0.1], tokens: 1 },
      { vector: [0.2], tokens: 1 },
    ]);

    const result = await service.reindex(job);

    expect(qdrant.createCollection).toHaveBeenCalledWith('knowledge_base_v2', 1536);
    expect(qdrant.upsertBatch).toHaveBeenCalledWith(
      'knowledge_base_v2',
      expect.arrayContaining([
        expect.objectContaining({
          id: 'c1',
          payload: expect.objectContaining({ embeddingVersion: 'v2' }),
        }),
      ]),
    );
    expect(resolver.setActiveVersion).toHaveBeenCalledWith('knowledge_base', 'v2');
    expect(qdrant.deletePointsByVersion).toHaveBeenCalledWith('knowledge_base', LEGACY_VERSION);
    expect(result).toEqual({ reindexed: 2 });
  });

  it('skips points whose content is missing from the database', async () => {
    qdrant.scrollPoints
      .mockResolvedValueOnce([
        { id: 'c1', payload: {} },
        { id: 'c2', payload: {} },
      ])
      .mockResolvedValueOnce([]);
    db.queryMany.mockResolvedValue([{ id: 'c1', content: 'exists' }]);

    await service.reindex(job);

    expect(qdrant.upsertBatch).toHaveBeenCalledWith(
      'knowledge_base_v2',
      expect.arrayContaining([expect.objectContaining({ id: 'c1' })]),
    );
    const points = qdrant.upsertBatch.mock.calls[0][1];
    expect(points).toHaveLength(1);
  });

  it('reports progress and switches active version even for a single page', async () => {
    qdrant.scrollPoints
      .mockResolvedValueOnce([{ id: 'c1', payload: {} }])
      .mockResolvedValueOnce([]);
    db.queryMany.mockResolvedValue([{ id: 'c1', content: 'x' }]);

    await service.reindex(job);

    expect(job.updateProgress).toHaveBeenCalled();
    expect(resolver.setActiveVersion).toHaveBeenCalledTimes(1);
  });
});
