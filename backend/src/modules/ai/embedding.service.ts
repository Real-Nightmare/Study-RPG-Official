import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider, EmbeddingResult } from './embedding-provider.interface';

export { EmbeddingResult } from './embedding-provider.interface';

/**
 * Text-embedding adapter. Provider selection (`EMBEDDING_PROVIDER`):
 *   - `ollama-compatible` — local OpenAI-compatible embeddings endpoint
 *     (default for docker/self-host: Ollama `nomic-embed-text`, 768-dim).
 *     No API key, no external account.
 *   - default: OpenRouter's embeddings endpoint (openai/text-embedding-3-small,
 *     1536-dim) when OPENROUTER_API_KEY is configured.
 * The vector dimension is fixed at construction time and must match the
 * Qdrant collection schema (see the reindex pipeline / CollectionResolver,
 * which rebuilds indexes when the embedding version changes).
 */
@Injectable()
export class EmbeddingService implements EmbeddingProvider {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly embeddingModel: string;
  private readonly vectorDimension: number;

  constructor(private readonly configService: ConfigService) {
    const provider = (
      this.configService.get<string>('EMBEDDING_PROVIDER') ||
      (this.configService.get<string>('AI_BASE_URL') ? 'ollama-compatible' : 'openrouter')
    ).toLowerCase();

    if (provider === 'ollama-compatible') {
      this.apiKey = this.configService.get<string>('OLLAMA_EMBEDDING_API_KEY', 'local');
      this.baseUrl = this.configService.get<string>(
        'OLLAMA_EMBEDDING_BASE_URL',
        this.configService.get<string>('AI_BASE_URL', 'http://localhost:11434/v1'),
      );
      this.embeddingModel = this.configService.get<string>(
        'OLLAMA_EMBEDDING_MODEL',
        'nomic-embed-text',
      );
      // nomic-embed-text is a 768-dimension model.
      this.vectorDimension = Number(this.configService.get('EMBEDDING_DIMENSION', 768));
    } else {
      this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY', '');
      this.baseUrl = this.configService.get<string>(
        'OPENROUTER_BASE_URL',
        'https://openrouter.ai/api/v1',
      );
      this.embeddingModel = this.configService.get<string>(
        'OPENROUTER_EMBEDDING_MODEL',
        'openai/text-embedding-3-small',
      );
      this.vectorDimension = Number(this.configService.get('EMBEDDING_DIMENSION', 1536));
    }
  }

  getVectorDimension(): number {
    return this.vectorDimension;
  }

  getModel(): string {
    return this.embeddingModel;
  }

  getVersion(): string {
    return `${this.embeddingModel}@${this.vectorDimension}`;
  }

  private async request(input: string | string[]): Promise<{
    vectors: number[][];
    tokens: number;
  }> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://studyrpg.app',
        'X-Title': 'Study RPG',
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Embedding failed: ${error}`);
      throw new Error(`Embedding failed: ${response.status}`);
    }

    const data = await response.json();
    const inputs = Array.isArray(input) ? input : [input];
    const tokensPerInput = Math.ceil((data.usage?.total_tokens || 0) / inputs.length);

    return {
      vectors: data.data.map((item: { embedding: number[] }) => item.embedding),
      tokens: tokensPerInput,
    };
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const { vectors, tokens } = await this.request(text);
    return { vector: vectors[0], tokens };
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) return [];

    const { vectors, tokens } = await this.request(texts);
    return vectors.map((vector) => ({ vector, tokens }));
  }

  async embedWithChunking(texts: string[], batchSize = 100): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await this.embedBatch(batch);
      results.push(...batchResults);

      this.logger.debug(
        `Embedded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`,
      );
    }

    return results;
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

    const results = candidates.map((candidate, index) => ({
      id: candidate.id,
      text: candidate.text,
      similarity: this.cosineSimilarity(queryEmbedding.vector, candidateEmbeddings[index].vector),
    }));

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }
}
