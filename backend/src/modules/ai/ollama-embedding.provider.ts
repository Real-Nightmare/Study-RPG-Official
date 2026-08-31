import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider, EmbeddingResult } from './embedding-provider.interface';

/**
 * Ollama embedding adapter — uses the local Ollama /api/embed endpoint.
 * Default model: nomic-embed-text (768-dim, runs on CPU).
 *
 * Vector dimension is set at construction and must match the Qdrant
 * collection schema. When the model changes, the collection version
 * string changes too, triggering a safe re-index.
 */
@Injectable()
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  private readonly logger = new Logger(OllamaEmbeddingProvider.name);
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly vectorDimension: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('OLLAMA_BASE_URL', 'http://ollama:11434');
    this.model = this.configService.get<string>('OLLAMA_EMBEDDING_MODEL', 'nomic-embed-text');
    this.vectorDimension = this.configService.get<number>('OLLAMA_EMBEDDING_DIM', 768);
  }

  getVectorDimension(): number {
    return this.vectorDimension;
  }

  getModel(): string {
    return `ollama/${this.model}`;
  }

  getVersion(): string {
    return `ollama/${this.model}@${this.vectorDimension}`;
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: text }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Ollama embedding failed (${response.status}): ${err}`);
    }

    const data = await response.json() as { embeddings: number[][] };
    const vector = data.embeddings?.[0];
    if (!vector) throw new Error('Ollama returned empty embedding');
    return { vector, tokens: 0 };
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) return [];

    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: texts }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Ollama batch embedding failed (${response.status}): ${err}`);
    }

    const data = await response.json() as { embeddings: number[][] };
    return (data.embeddings || []).map((vector) => ({ vector, tokens: 0 }));
  }

  async embedWithChunking(texts: string[], batchSize = 100): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await this.embedBatch(batch);
      results.push(...batchResults);
    }
    return results;
  }
}
