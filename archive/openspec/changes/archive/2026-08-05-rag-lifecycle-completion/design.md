## Context

The ingestion state machine (`rag-ingestion-state.ts`) already defines `deleting → deleted` and `failed` transitions. `documents.service.delete()` currently deletes the row without touching chunks; `knowledge-base.service.delete()` deletes a whole KB via Qdrant filter. The hybrid retriever ends at Reciprocal Rank Fusion (`hybrid-rank.ts`). The AI module has HTTP-client conventions and `EmbeddingService implements EmbeddingProvider` — the reranker follows the same provider pattern.

## Goals / Non-Goals

**Goals:**
- A deletion lifecycle that removes a document's chunks from `kb_chunks` and the active Qdrant collection (version-scoped via `CollectionResolver`), refusing mid-ingestion deletes, with failure rollback to `failed`.
- A `RerankerProvider` abstraction (OpenRouter / OpenAI-compatible / Ollama) + `RerankService` + optional stage in hybrid search (`rerank`, `rerankTopK`), fully functional but inert without config.

**Non-Goals:**
- Reindexing changes (already done in `versioned-qdrant-collections`).
- Training/evaluation of rerank models; we consume hosted endpoints.
- Deleting files from object storage is handled by the existing content module — the KB deletion endpoint only clears database + vector artifacts.

## Decisions

1. **New `DocumentDeletionService`** owns the lifecycle and is injected into both `knowledge-base.service` (KB-level delete reuses per-document cleanup) and the content `documents.service` path. It validates state via the existing machine (`canTransition(state,'deleting')`), refuses `parsing|embedding|indexing`, deletes chunks from `kb_chunks` by `document_id`, scrolls + deletes Qdrant points by `documentId` payload in the active collection, then marks `deleted`. Any throw → state `failed` + `last_error`.
2. **Delete endpoint** `DELETE /knowledge-bases/:id/documents/:docId` on the KB controller, ownership-scoped.
3. **Reranker provider**: `RerankProvider` interface (`rerank(query, candidates)` + `isAvailable()`); `RerankService` selects `OpenRouterRerankProvider` / `OpenAiCompatRerankProvider` / `OllamaRerankProvider` from `RERANKER_PROVIDER`, `RERANKER_MODEL`, `RERANKER_API_URL` (env), returning a no-op provider when unset — so `isAvailable()` is false and retrieval is untouched.
4. **Retriever integration**: after fusion, if `rerank=true` and `rerankService.isAvailable()`, rerank `rerankTopK` (default 20) candidates and merge scores (`reranked=true` in payload).
5. **Tests**: deletion happy path / mid-ingestion refusal / failure rollback (mocked db+qdrant); rerank pass-through (unconfigured) and active ordering (mocked provider).

## Risks / Trade-offs

- Reranker never exercises a real endpoint in CI (no keys) — provider HTTP layer is thin and mocked; real endpoint shape is documented in code.
- Deleting chunks then failing on Qdrant → rollback marks `failed`, but some chunks may already be gone from PG — acceptable; a re-upload reindexes cleanly, and `failed` surfaces the error.
- `document_id` payload on Qdrant points must exist for version-scoped deletes — upsert payloads already carry `documentId` metadata.
