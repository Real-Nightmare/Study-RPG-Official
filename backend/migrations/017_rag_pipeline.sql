-- Phase 3 — Production RAG pipeline (master prompt §8)
-- Ingestion state machine, content deduplication, lexical retrieval index,
-- and retrieval evaluation dataset.

-- Per-document ingestion state (master prompt §8.3)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ingestion_state VARCHAR(40) NOT NULL DEFAULT 'uploaded';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS retry_history JSONB NOT NULL DEFAULT '[]';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(120);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS embedding_version VARCHAR(40);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS chunk_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_documents_ingestion_state ON documents(ingestion_state);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);

-- Chunk-level metadata + lexical retrieval (master prompt §8.4, §8.7)
ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);
ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS section VARCHAR(255);
ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS page INTEGER;
ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX IF NOT EXISTS idx_kb_chunks_content_hash ON kb_chunks(content_hash);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_tsv ON kb_chunks USING GIN (tsv);

-- Retrieval evaluation dataset (master prompt §8.10)
CREATE TABLE IF NOT EXISTS rag_eval_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query TEXT NOT NULL,
    expected_document_ids JSONB NOT NULL DEFAULT '[]',
    expected_sections JSONB NOT NULL DEFAULT '[]',
    relevant_chunk_ids JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
