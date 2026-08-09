/**
 * Reranker provider abstraction (master prompt §8.8 "Reranking").
 * Supports OpenRouter, OpenAI-compatible endpoints, and local Ollama.
 * A provider reports availability; when unconfigured the system degrades
 * gracefully to fusion order (no reranking, no errors).
 */

export interface RerankCandidate {
  id: string;
  content: string;
  /** Pre-rerank score (e.g. from rank fusion) — provider may ignore it. */
  score?: number;
  documentId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RerankResult {
  id: string;
  score: number;
}

export interface RerankProvider {
  readonly name: string;
  isAvailable(): boolean;
  rerank(query: string, candidates: RerankCandidate[], topK?: number): Promise<RerankResult[]>;
}

export interface RerankProviderConfig {
  provider: string; // openrouter | openai | ollama
  model: string; // e.g. cohere/rerank-... , bge-reranker-v2-m3
  apiUrl?: string; // base URL for OpenAI-compatible / Ollama
  apiKey?: string; // OpenRouter / OpenAI key
}
