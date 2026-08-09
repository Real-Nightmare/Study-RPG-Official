## Why

Phase 3 (Production RAG) has two remaining lifecycle gaps flagged in `IMPLEMENTATION_STATUS.md`:

1. **Deletion pipeline** — the ingestion state machine defines `deleting → deleted`, and `documents.delete()` should walk it, but today the KnowledgeBaseService deletes a whole KB and the content module deletes a document row without removing its chunks from `kb_chunks` or Qdrant. Per-document deletion must remove chunks from Postgres and the active Qdrant collection and only then mark the document `deleted`.
2. **Reranker** — the master prompt (§8.8 Reranking; "Reranker" in the AI provider list) specifies reranking support across OpenRouter / OpenAI-compatible / local Ollama. The hybrid retriever stops at Reciprocal Rank Fusion; a reranker stage should optionally re-score the top candidates and only be active when configured, degrading gracefully to RRF order otherwise.

## What Changes

1. **Deletion pipeline** — `documents.service.delete()` (and the KB-level delete) walks the ingestion state machine: validate the row is not mid-ingestion (`parsing`/`embedding`/`indexing` are refused), transition to `deleting`, delete chunks from `kb_chunks` (by document id), remove the corresponding points from the active Qdrant collection (version-scoped via `CollectionResolver`), then transition to `deleted` and delete the row. Errors roll the state back to `failed` with `last_error` set. A `DELETE /knowledge-bases/:id/documents/:docId` endpoint is added alongside the existing content deletion.
2. **Reranker** — new `RerankerProvider` abstraction (OpenRouter / OpenAI-compatible / Ollama via the existing AI HTTP client conventions) exposed through a `RerankService`; the `HybridRetrieverService` gains an optional rerank stage after fusion — `POST /knowledge-bases/:id/search` accepts `rerank=true` and `rerankTopK`. When no `RERANKER_*` env config is present, reranking is skipped silently (RRF order preserved), so the system stays fully testable without live AI keys.

## Capabilities

### New Capabilities
- `rag-deletion`: Per-document deletion lifecycle for the RAG pipeline (state-walked, chunk cleanup in Postgres + Qdrant, failure rollback).
- `rag-reranking`: Optional reranker stage for hybrid retrieval with provider abstraction and graceful degradation.

### Modified Capabilities
- `rag-vector-index`: adds the rerank option to the hybrid search capability and ties document deletion into the ingestion lifecycle.

## Impact

- `backend/migrations/021_rag_lifecycle.sql` — no new tables required (uses existing `documents`/`kb_chunks`); if needed, indexes on `kb_chunks.document_id`.
- New backend modules/files: `modules/ai/rerank-provider.interface.ts`, `modules/rag/rerank.service.ts` (or `modules/ai/rerank.service.ts`), `modules/knowledge-base/document-deletion.service.ts`; edits to `hybrid-retriever.service.ts`, `knowledge-base.service.ts`, `knowledge-base.controller.ts`, `documents.service.ts`, `qdrant.service.ts`.
- Unit tests for deletion state walks (happy path, mid-ingestion refusal, failure rollback) and rerank pass-through/active ordering with mocks.
- Docs: status file + CHANGELOG.
