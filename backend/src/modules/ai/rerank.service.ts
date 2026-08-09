import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RerankCandidate,
  RerankProvider,
  RerankProviderConfig,
  RerankResult,
} from './rerank-provider.interface';

/**
 * No-op provider used when no reranker is configured. Keeps retrieval
 * fully functional and returns fusion order unchanged (graceful degradation).
 */
class NoopRerankProvider implements RerankProvider {
  readonly name = 'none';
  isAvailable(): boolean {
    return false;
  }
  async rerank(): Promise<RerankResult[]> {
    return [];
  }
}

/** OpenRouter: POST /api/v1/rerank with model + query + documents. */
class OpenRouterRerankProvider implements RerankProvider {
  readonly name = 'openrouter';
  constructor(private readonly config: RerankProviderConfig) {}
  isAvailable(): boolean {
    return Boolean(this.config.apiKey && this.config.model);
  }
  async rerank(
    query: string,
    candidates: RerankCandidate[],
    topK?: number,
  ): Promise<RerankResult[]> {
    const base = this.config.apiUrl ?? 'https://openrouter.ai/api/v1';
    const response = await fetch(`${base}/rerank`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        query,
        documents: candidates.map((c) => c.content),
        top_n: topK ?? candidates.length,
      }),
    });
    if (!response.ok) {
      throw new Error(`Reranker HTTP ${response.status}: ${await response.text()}`);
    }
    const data = (await response.json()) as {
      results: Array<{ index: number; relevance_score: number }>;
    };
    return data.results.map((r) => ({
      id: candidates[r.index]?.id ?? String(r.index),
      score: r.relevance_score,
    }));
  }
}

/** OpenAI-compatible rerank endpoint (Jina/Cohere-style /v1/rerank). */
class OpenAiCompatRerankProvider implements RerankProvider {
  readonly name = 'openai';
  constructor(private readonly config: RerankProviderConfig) {}
  isAvailable(): boolean {
    return Boolean(this.config.apiKey && this.config.model);
  }
  async rerank(
    query: string,
    candidates: RerankCandidate[],
    topK?: number,
  ): Promise<RerankResult[]> {
    const base = this.config.apiUrl ?? 'https://api.openai.com/v1';
    const response = await fetch(`${base}/rerank`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        query,
        documents: candidates.map((c) => c.content),
        top_n: topK ?? candidates.length,
      }),
    });
    if (!response.ok) {
      throw new Error(`Reranker HTTP ${response.status}: ${await response.text()}`);
    }
    const data = (await response.json()) as {
      results: Array<{ index: number; relevance_score: number }>;
    };
    return data.results.map((r) => ({
      id: candidates[r.index]?.id ?? String(r.index),
      score: r.relevance_score,
    }));
  }
}

/** Local Ollama: POST /api/rerank (ollama >= 0.5). */
class OllamaRerankProvider implements RerankProvider {
  readonly name = 'ollama';
  constructor(private readonly config: RerankProviderConfig) {}
  isAvailable(): boolean {
    return Boolean(this.config.model);
  }
  async rerank(
    query: string,
    candidates: RerankCandidate[],
    topK?: number,
  ): Promise<RerankResult[]> {
    const base = this.config.apiUrl ?? 'http://localhost:11434';
    const response = await fetch(`${base}/api/rerank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        query,
        documents: candidates.map((c) => c.content),
        top_n: topK ?? candidates.length,
      }),
    });
    if (!response.ok) {
      throw new Error(`Reranker HTTP ${response.status}: ${await response.text()}`);
    }
    const data = (await response.json()) as {
      results: Array<{ index: number; relevance_score: number }>;
    };
    return data.results.map((r) => ({
      id: candidates[r.index]?.id ?? String(r.index),
      score: r.relevance_score,
    }));
  }
}

/**
 * Selects a reranker provider from env config:
 *   RERANKER_PROVIDER  = openrouter | openai | ollama
 *   RERANKER_MODEL     = model name
 *   RERANKER_API_URL   = base URL (optional)
 *   RERANKER_API_KEY   = API key (optional; required for openrouter/openai)
 * When RERANKER_PROVIDER is unset, a no-op provider is returned and the
 * retriever leaves fusion order untouched.
 */
@Injectable()
export class RerankService {
  private readonly logger = new Logger(RerankService.name);
  private readonly provider: RerankProvider;

  constructor(private readonly configService: ConfigService) {
    const providerName = this.configService.get<string>('RERANKER_PROVIDER') ?? 'none';
    const config: RerankProviderConfig = {
      provider: providerName,
      model: this.configService.get<string>('RERANKER_MODEL') ?? '',
      apiUrl: this.configService.get<string>('RERANKER_API_URL') ?? undefined,
      apiKey: this.configService.get<string>('RERANKER_API_KEY') ?? undefined,
    };

    switch (providerName) {
      case 'openrouter':
        this.provider = new OpenRouterRerankProvider(config);
        break;
      case 'openai':
        this.provider = new OpenAiCompatRerankProvider(config);
        break;
      case 'ollama':
        this.provider = new OllamaRerankProvider(config);
        break;
      default:
        this.provider = new NoopRerankProvider();
        this.logger.log(
          'Reranker not configured (set RERANKER_PROVIDER/MODEL/API_URL/API_KEY) — fusion order used',
        );
    }
  }

  isAvailable(): boolean {
    return this.provider.isAvailable();
  }

  async rerank(
    query: string,
    candidates: RerankCandidate[],
    topK?: number,
  ): Promise<RerankResult[]> {
    if (!this.provider.isAvailable()) {
      return [];
    }
    try {
      return await this.provider.rerank(query, candidates, topK);
    } catch (error) {
      this.logger.warn(
        `Reranker failed (${error instanceof Error ? error.message : error}) — returning fusion order`,
      );
      return [];
    }
  }
}
