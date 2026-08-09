## Context

Current state (see proposal.md — Why): one static collection name (`studyield_knowledge_base`) is hard-coded in `QdrantService` (`collectionPrefix`) and reused by `KnowledgeBaseService`/`HybridRetrieverService`. The embedding provider (`EmbeddingService`) already exposes `getVersion()` = `<model>@<dimensions>`, and indexed points already carry `embeddingModel`/`embeddingVersion` payload fields (previous Phase 3 slice). `QueueService` (BullMQ) is available for background jobs, and `QdrantService` already supports filter-based deletes.

## Goals / Non-Goals

**Goals:**
- Derive collection names from content type + embedding provider version so a model change creates a distinct collection.
- Centralize active-version resolution with a config override for canary/rollback.
- Reindex in the background via a BullMQ job, keeping the old collection queryable until the new one is ready.
- Scope point deletion by recorded version so superseded indexes can be purged safely.

**Non-Goals:**
- Per-user collections (explicitly disallowed by §8.6).
- Automatic reindex-on-startup; reindexing is an explicit, operator-triggered job.
- Reranking or evaluation changes (separate Phase 3 items).
- Backfilling legacy points into the new collection from object storage.

## Decisions

**D1. Collection name scheme: `<prefix>_<contentType>_<version-slug>`**
Derived as `studyield_knowledge_base_<model-slug>_<dims>` from `EmbeddingProvider.getVersion()` (slugified). Alternative considered: numeric-only version counter — rejected because it hides *what* changed; the spec wants embedding model + dimensions visible in the name (§8.6 examples).

**D2. Version resolution in `QdrantService` via a `CollectionResolver`**
`QdrantService` keeps the low-level client; a new `CollectionResolver` (registered in the knowledge-base or qdrant module) computes `activeCollection(contentType)`:
1. explicit `QDRANT_COLLECTION_VERSION` env override (if set and valid),
2. else derive from `EmbeddingService.getVersion()`.
Callers (`KnowledgeBaseService`, `HybridRetrieverService`) ask the resolver instead of holding a name constant. Alternative considered: env-only resolution — rejected because the derived default must track the embedding provider automatically.

**D3. Reindex as a BullMQ job (`rag-reindex`)**
A new `RagModule` exposes `POST /rag/reindex` (admin-guarded) that enqueues `rag-reindex` with `{fromVersion, toVersion}`. The worker (`ReindexService`):
1. reads chunks from the *old* collection (paginated `scroll`),
2. re-embeds each chunk with the current provider,
3. upserts into the target collection (creating it first with the provider's dimensions),
4. reports progress via `job.updateProgress`,
5. on completion marks the target as active by writing the version (persisted in a small `rag_index_state` row via DB, so resolution survives restarts) and purges superseded points.
Alternative considered: in-process reindex on boot — rejected: can be long, must not block startup, and §8.9 requires background reindex.

**D4. Active-version state persisted in PostgreSQL**
The active version per content type lives in a new `rag_index_state` table (source of truth per §4.3 — never Redis-only), read by the resolver and updated only by the completed reindex job. The env override wins over DB state when present (rollback path without code changes).

**D5. Collection creation is idempotent and lazy**
`createCollection` already tolerates existing collections; the resolver/reindex creates the target collection before writing points (matching §8.6 "create payload indexes before large ingestion").

## Risks / Trade-offs

- [Reindex doubles storage cost during migration] → Temporary; old collection is purged after switch (D3), so steady-state is one collection per version.
- [Version slug length / name collisions] → Slug is truncated + hashed suffix for stability; names remain unique per provider version.
- [Embedding provider outage mid-reindex] → Job fails, old collection untouched; operator retries; `last_error`/state recorded.
- [Env override pointing at a nonexistent collection] → Resolution falls back to derived version and logs a warning; searches return empty rather than erroring.

## Migration Plan

1. Deploy code (no DB migration required beyond the small `rag_index_state` table, added via migration `018_rag_index_state.sql`).
2. On first boot, resolver derives the active version from the current provider — this equals the legacy collection name shape for `text-embedding-3-small`/1536, so existing points remain reachable.
3. Optional: run reindex to a new embedding model, verify evaluation, then purge the old version.
4. Rollback: set `QDRANT_COLLECTION_VERSION` back to the previous version.

## Open Questions

None — the spec, approach, and task breakdown do not depend on any unresolved unknowns.
