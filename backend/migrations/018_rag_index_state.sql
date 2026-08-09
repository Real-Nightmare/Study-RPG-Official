-- Phase 3 — Versioned Qdrant collections (OpenSpec change: versioned-qdrant-collections)
-- Persisted active index version per content type (source of truth, master prompt §4.3).
-- Seeded with 'legacy' so the unversioned collection keeps working until the
-- first background reindex switches the active version.

CREATE TABLE IF NOT EXISTS rag_index_state (
    content_type VARCHAR(120) PRIMARY KEY,
    active_version VARCHAR(200) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO rag_index_state (content_type, active_version)
VALUES ('knowledge_base', 'legacy')
ON CONFLICT (content_type) DO NOTHING;
