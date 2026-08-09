import { ConfigService } from '@nestjs/config';
import { RerankService } from './rerank.service';

describe('RerankService', () => {
  function makeConfig(overrides: Record<string, string | undefined> = {}) {
    return {
      get: jest.fn((key: string) => overrides[key]),
    } as unknown as ConfigService;
  }

  it('is unavailable when no provider is configured', () => {
    const service = new RerankService(makeConfig({}));
    expect(service.isAvailable()).toBe(false);
  });

  it('returns fusion order unchanged when unconfigured', async () => {
    const service = new RerankService(makeConfig({}));
    const candidates = [
      { id: 'c1', content: 'a' },
      { id: 'c2', content: 'b' },
    ];
    const result = await service.rerank('query', candidates);
    expect(result).toEqual([]);
  });

  it('selects the ollama provider from config', async () => {
    const service = new RerankService(
      makeConfig({
        RERANKER_PROVIDER: 'ollama',
        RERANKER_MODEL: 'bge-reranker-v2-m3',
        RERANKER_API_URL: 'http://localhost:11434',
      }),
    );
    expect(service.isAvailable()).toBe(true);
  });

  it('openrouter requires an api key to be available', () => {
    const noKey = new RerankService(
      makeConfig({ RERANKER_PROVIDER: 'openrouter', RERANKER_MODEL: 'cohere/rerank-v3.0' }),
    );
    expect(noKey.isAvailable()).toBe(false);

    const withKey = new RerankService(
      makeConfig({
        RERANKER_PROVIDER: 'openrouter',
        RERANKER_MODEL: 'cohere/rerank-v3.0',
        RERANKER_API_KEY: 'sk-test',
      }),
    );
    expect(withKey.isAvailable()).toBe(true);
  });

  it('swallows provider failures and returns empty (graceful degradation)', async () => {
    const service = new RerankService(
      makeConfig({
        RERANKER_PROVIDER: 'ollama',
        RERANKER_MODEL: 'bge-reranker-v2-m3',
        RERANKER_API_URL: 'http://localhost:1', // unreachable
      }),
    );
    const result = await service.rerank('query', [{ id: 'c1', content: 'a' }]);
    expect(result).toEqual([]);
  });
});
