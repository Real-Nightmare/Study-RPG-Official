/**
 * EmbeddingProvider interface (master prompt §8.9).
 *
 * Adapters can be implemented for any backend — OpenRouter/OpenAI-compatible
 * endpoints, Qdrant Cloud inference, a local embedding service (e.g. Ollama),
 * or administrator-configured providers. Each indexed point should store the
 * model + version returned here so indexes can be versioned and reindexed
 * safely when the embedding model changes.
 */
export interface EmbeddingResult {
  vector: number[];
  tokens: number;
}

export interface EmbeddingProvider {
  /** Dimensionality of the vectors produced by this provider. */
  getVectorDimension(): number;

  /** Identifier of the embedding model (e.g. `openai/text-embedding-3-small`). */
  getModel(): string;

  /** Version slug combining model + dimensions; changes when the model changes. */
  getVersion(): string;

  embed(text: string): Promise<EmbeddingResult>;

  embedBatch(texts: string[]): Promise<EmbeddingResult[]>;

  embedWithChunking(texts: string[], batchSize?: number): Promise<EmbeddingResult[]>;
}
