import { createHash } from 'crypto';

/**
 * SHA-256 content hashing for RAG deduplication (master prompt §8.4).
 * Hashes are computed over the cleaned extracted text and per chunk so that:
 * - duplicate uploads are detected before re-parsing / re-embedding
 * - changed documents are detected (hash mismatch)
 * - identical chunks never produce duplicate Qdrant points
 */

export function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function hashText(text: string): string {
  return hashBuffer(Buffer.from(text, 'utf-8'));
}

/**
 * Normalised hash: lowercases and collapses whitespace before hashing so that
 * formatting-only differences (line breaks, extra spaces) do not defeat
 * duplicate detection.
 */
export function hashNormalizedText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
  return hashText(normalized);
}

export interface HashableChunk {
  content: string;
  index: number;
}

export interface ChunkHashes {
  chunks: Array<{ index: number; hash: string }>;
  documentHash: string;
}

export function hashChunks(chunks: HashableChunk[]): ChunkHashes {
  const hashed = chunks.map((chunk) => ({
    index: chunk.index,
    hash: hashNormalizedText(chunk.content),
  }));
  const documentHash = hashText(
    hashed
      .map((h) => h.hash)
      .sort()
      .join(':'),
  );
  return { chunks: hashed, documentHash };
}
