## Why

The RAG vector store currently uses a single, unversioned Qdrant collection (`studyield_knowledge_base`) tied to a hard-coded 1536-dimension embedding model. The embedding provider cannot change without breaking retrieval: dimension mismatches fail every query, and semantic drift would silently degrade results with no rollback path. The master implementation prompt (§8.6, §8.9) requires a small number of **versioned collections** (embedding model + dimensions + content type + schema version) with a **background reindex** that keeps the old index available until the new one is ready, switched through a feature flag.

## What Changes

- **Versioned collection naming**: collection names are derived from the embedding provider's `getVersion()` (model + dimensions) and content type, e.g. `studyield_knowledge_base_openai_te3s_1536` instead of a static name.
- **Active collection resolution**: a single place resolves the "current" collection for a content type; all upserts and searches use it, so callers never hard-code a name.
- **Background reindex pipeline**: a BullMQ job re-embeds chunks from the old collection into a new-version collection, reports progress, and only then flips the active version — the old index stays queryable until the switch.
- **Feature-flag switch + rollback**: the active collection version is overridable via config (`QDRANT_COLLECTION_VERSION`), enabling canary/rollback without code changes.
- **Index hygiene**: payload already carries `embeddingModel`/`embeddingVersion` (previous slice); points now also record their collection version so stale points can be purged after a successful switch.
- **BREAKING**: no — existing collections keep working; on first boot with versioning enabled, the active version is computed from the current embedding provider.

## Capabilities

### New Capabilities

- `rag-vector-index`: versioned Qdrant collection management for RAG — versioned naming, active-version resolution, background reindexing with old-index retention, and config-driven version switching/rollback.

### Modified Capabilities

<!-- No existing specs yet: openspec/specs/ has no archived capabilities. -->

## Impact

- `backend/src/modules/qdrant/qdrant.service.ts` — collection naming, version resolution, delete-by-version support.
- `backend/src/modules/knowledge-base/knowledge-base.service.ts` — use the resolved active collection for upsert/search.
- New `backend/src/modules/rag/reindex.service.ts` + queue job (`rag-reindex`) registered with `QueueService`.
- `backend/src/modules/knowledge-base/hybrid-retriever.service.ts` — search against the active collection.
- Env config: `QDRANT_COLLECTION_VERSION` (optional override), documented in `.env.example`.
- No database migration required.
