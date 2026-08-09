## 1. Index state + version resolution

- [x] 1.1 Add migration `018_rag_index_state.sql` with `rag_index_state` table (content_type PK, active_version, updated_at) — seeded with `legacy` so existing points stay reachable
- [x] 1.2 Add `collection-resolver.service.ts`: slugify embedding provider version, compute/override active version per content type (env `QDRANT_COLLECTION_VERSION` wins), read/write `rag_index_state`
- [x] 1.3 Extend `QdrantService` with `scrollPoints` and version-scoped `deletePointsByVersion`

## 2. Wire versioned collections into RAG

- [x] 2.1 Update `KnowledgeBaseService` (onModuleInit create, upserts, delete) to resolve collections through the resolver
- [x] 2.2 Update `HybridRetrieverService` to search the resolved active collection
- [x] 2.3 Record `embeddingVersion`/`contentType` on every indexed point (processDocument, addText) so version-scoped purge works

## 3. Background reindex

- [x] 3.1 Create `RagModule` with `ReindexService`: scroll old collection, re-embed with current provider, upsert into target collection, update progress, mark active version, purge superseded points
- [x] 3.2 Register `rag-reindex` queue worker with `QueueService` and add admin-guarded `POST /rag/reindex` endpoint
- [x] 3.3 Register `RagModule` in `app.module.ts` — `QDRANT_COLLECTION_VERSION` documented (`.env.example` edit blocked by workspace secret guard; noted in status doc)

## 4. Tests + docs

- [x] 4.1 Unit tests: collection name derivation, override resolution, state persistence, reindex flow (mocked db/qdrant) — 11 new tests
- [x] 4.2 Validate: backend build + lint + full `npm test` pass (60/60)
- [x] 4.3 Update `IMPLEMENTATION_STATUS.md` (Phase 3 §8.6 row) and `CHANGELOG.md`
