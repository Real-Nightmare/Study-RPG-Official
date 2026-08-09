-- Phase 3 — Retrieval evaluation dataset (OpenSpec change: rag-retrieval-evaluation)
-- Extends rag_eval_cases (created in migration 017) with knowledge-base scoping,
-- distractor chunks, expected pages and attribution.

ALTER TABLE rag_eval_cases ADD COLUMN IF NOT EXISTS knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE;
ALTER TABLE rag_eval_cases ADD COLUMN IF NOT EXISTS distractor_chunk_ids JSONB NOT NULL DEFAULT '[]';
ALTER TABLE rag_eval_cases ADD COLUMN IF NOT EXISTS expected_pages JSONB NOT NULL DEFAULT '[]';
ALTER TABLE rag_eval_cases ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rag_eval_cases_kb ON rag_eval_cases(knowledge_base_id);
