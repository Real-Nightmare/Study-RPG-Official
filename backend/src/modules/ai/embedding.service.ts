import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider, EmbeddingResult } from './embedding-provider.interface';

export { EmbeddingResult } from './embedding-provider.interface';

/**
 * Text-embedding adapter that delegates to either:
 *   - OpenRouter/OpenAI embeddings endpoint (EMBEDDING_PROVIDER=openrouter)
 *   - Local Ollama embeddings (EMBEDDING_PROVIDER=ollama)
 *
 * The vector dimension is fixed at construction and must match the Qdrant
 * collection schema; when the model changes, CollectionResolver triggers
 * a safe re-index automatically.
 */
@Injectable()
export class EmbeddingService implements EmbeddingProvider {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly provider: EmbeddingProvider;

  constructor(private readonly configService: ConfigService) {
    const providerName = this.configService.get<string>('EMBEDDING_PROVIDER', 'openrouter');

    if (providerName === 'ollama') {
      this.provider = this.createOllamaProvider();
    } else {
      this.provider = this.createOpenRouterProvider();
    }

    this.logger.log(`Embedding provider: ${this.provider.getModel()}`);
  }

  private createOpenRouterProvider(): EmbeddingProvider {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY', '');
    const baseUrl = this.configService.get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1');
    const embeddingModel = this.configService.get<string>('OPENROUTER_EMBEDDING_MODEL', 'openai/text-embedding-3-small');
    const vectorDimension = 1536;

    return {
      getVectorDimension: () => vectorDimension,
      getModel: () => embeddingModel,
      getVersion: () => `${embeddingModel}@${vectorDimension}`,

      async embed(text: string): Promise<EmbeddingResult> {
        const response = await fetch(`${baseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://studyrpg.app',
            'X-Title': 'Study RPG',
          },
          body: JSON.stringify({ model: embeddingModel, input: text }),
        });

        if (!response.ok) {
          throw new Error(`OpenRouter embedding failed: ${response.status} ${await response.text()}`);
        }

        const data = await response.json() as {
          data: Array<{ embedding: number[] }>;
          usage: { total_tokens: number };
        };

        return {
          vector: data.data[0].embedding,
          tokens: data.usage?.total_tokens || 0,
        };
      },

      async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
        if (texts.length === 0) return [];

        const response = await fetch(`${baseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://studyrpg.app',
            'X-Title': 'Study RPG',
          },
          body: JSON.stringify({ model: embeddingModel, input: texts }),
        });

        if (!response.ok) {
          throw new Error(`OpenRouter batch embedding failed: ${response.status}`);
        }

        const data = await response.json() as {
          data: Array<{ embedding: number[] }>;
          usage: { total_tokens: number };
        };

        const tokensPerInput = Math.ceil((data.usage?.total_tokens || 0) / texts.length);
        return data.data.map((item) => ({ vector: item.embedding, tokens: tokensPerInput }));
      },

      async embedWithChunking(texts: string[], batchSize = 100): Promise<EmbeddingResult[]> {
        const results: EmbeddingResult[] = [];
        for (let i = 0; i < texts.length; i += batchSize) {
          const batch = texts.slice(i, i + batchSize);
          const batchResults = await this.embedBatch(batch);
          results.push(...batchResults);
        }
        return results;
      },
    };
  }

  private createOllamaProvider(): EmbeddingProvider {
    const baseUrl = this.configService.get<string>('OLLAMA_BASE_URL', 'http://ollama:11434');
    const model = this.configService.get<string>('OLLAMA_EMBEDDING_MODEL', 'nomic-embed-text');
    const vectorDimension = this.configService.get<number>('OLLAMA_EMBEDDING_DIM', 768);

    return {
      getVectorDimension: () => vectorDimension,
      getModel: () => `ollama/${model}`,
      getVersion: () => `ollama/${model}@${vectorDimension}`,

      async embed(text: string): Promise<EmbeddingResult> {
        const response = await fetch(`${baseUrl}/api/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: text }),
        });

        if (!response.ok) {
          throw new Error(`Ollama embedding failed: ${response.status} ${await response.text()}`);
        }

        const data = await response.json() as { embeddings: number[][] };
        const vector = data.embeddings?.[0];
        if (!vector) throw new Error('Ollama returned empty embedding');
        return { vector, tokens: 0 };
      },

      async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
        if (texts.length === 0) return [];

        const response = await fetch(`${baseUrl}/api/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: texts }),
        });

        if (!response.ok) {
          throw new Error(`Ollama batch embedding failed: ${response.status}`);
        }

        const data = await response.json() as { embeddings: number[][] };
        return (data.embeddings || []).map((vector) => ({ vector, tokens: 0 }));
      },

      async embedWithChunking(texts: string[], batchSize = 100): Promise<EmbeddingResult[]> {
        const results: EmbeddingResult[] = [];
        for (let i = 0; i < texts.length; i += batchSize) {
          const batch = texts.slice(i, i + batchSize);
          const batchResults = await this.embedBatch(batch);
          results.push(...batchResults);
        }
        return results;
      },
    };
  }

  // ── Public API (delegates to selected provider) ──────────────────

  getVectorDimension(): number {
    return this.provider.getVectorDimension();
  }

  getModel(): string {
    return this.provider.getModel();
  }

  getVersion(): string {
    return this.provider.getVersion();
  }

  async embed(text: string): Promise<EmbeddingResult> {
    return this.provider.embed(text);
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    return this.provider.embedBatch(texts);
  }

  async embedWithChunking(texts: string[], batchSize = 100): Promise<EmbeddingResult[]> {
    return this.provider.embedWithChunking(texts, batchSize);
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimension');
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async findMostSimilar(
    query: string,
    candidates: Array<{ id: string; text: string }>,
    topK = 5,
  ): Promise<Array<{ id: string; text: string; similarity: number }>> {
    const queryEmbedding = await this.embed(query);
    const candidateEmbeddings = await this.embedBatch(candidates.map((c) => c.text));
    return candidates
      .map((candidate, index) => ({
        id: candidate.id,
        text: candidate.text,
        similarity: this.cosineSimilarity(queryEmbedding.vector, candidateEmbeddings[index].vector),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}
