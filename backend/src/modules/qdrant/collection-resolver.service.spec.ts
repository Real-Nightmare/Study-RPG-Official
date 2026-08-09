import { CollectionResolver, LEGACY_VERSION } from './collection-resolver.service';
import { DatabaseService } from '../database/database.service';
import { EmbeddingService } from '../ai/embedding.service';

describe('CollectionResolver', () => {
  let resolver: CollectionResolver;
  let config: { get: jest.Mock };
  let db: { query: jest.Mock; queryOne: jest.Mock };
  let embedding: { getVersion: jest.Mock };

  beforeEach(() => {
    config = { get: jest.fn().mockReturnValue(undefined) };
    db = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      queryOne: jest.fn().mockResolvedValue(null),
    };
    embedding = {
      getVersion: jest.fn().mockReturnValue('openai/text-embedding-3-small@1536'),
    };
    resolver = new CollectionResolver(
      config as never,
      embedding as unknown as EmbeddingService,
      db as unknown as DatabaseService,
    );
  });

  describe('slugifyVersion', () => {
    it('slugs a provider version deterministically', () => {
      const a = resolver.slugifyVersion('openai/text-embedding-3-small@1536');
      const b = resolver.slugifyVersion('openai/text-embedding-3-small@1536');
      expect(a).toBe('openai_text_embedding_3_small_1536');
      expect(a).toBe(b);
    });

    it('truncates very long versions with a hash suffix', () => {
      const long = `${'model'.repeat(30)}@2048`;
      const slug = resolver.slugifyVersion(long);
      expect(slug.length).toBeLessThanOrEqual(69);
    });
  });

  describe('resolveVersion precedence', () => {
    it('env override wins', async () => {
      config.get.mockReturnValue('canary-v2');
      db.queryOne.mockResolvedValue({ active_version: 'legacy' });
      await expect(resolver.resolveVersion()).resolves.toBe('canary-v2');
    });

    it('falls back to persisted state when no override', async () => {
      db.queryOne.mockResolvedValue({ active_version: 'v2' });
      await expect(resolver.resolveVersion()).resolves.toBe('v2');
    });

    it('derives from the embedding provider when no state exists', async () => {
      await expect(resolver.resolveVersion()).resolves.toBe('openai_text_embedding_3_small_1536');
    });
  });

  describe('collectionNameFor', () => {
    it('maps legacy to the unversioned name', () => {
      expect(resolver.collectionNameFor('knowledge_base', LEGACY_VERSION)).toBe('knowledge_base');
    });

    it('appends a versioned suffix otherwise', () => {
      expect(resolver.collectionNameFor('knowledge_base', 'v2')).toBe('knowledge_base_v2');
    });
  });

  describe('setActiveVersion', () => {
    it('upserts the active version', async () => {
      await resolver.setActiveVersion('knowledge_base', 'v2');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'), [
        'knowledge_base',
        'v2',
      ]);
    });
  });
});
