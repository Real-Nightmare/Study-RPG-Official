## Why

The master prompt (§8.10) is explicit: *"RAG is not complete merely because Qdrant returns vectors."* We now have hybrid retrieval and versioned indexes, but no way to measure whether retrieval quality actually improves (or regresses) when the embedding model or collection version changes. Without a test dataset and metric runner there is no evidence for the §8.9 switch/rollback decision, and no regression safety net.

## What Changes

- **Evaluation dataset management**: `rag_eval_cases` (created in migration 017) is extended with KB scoping, distractor chunk ids and expected sections/pages, with admin CRUD endpoints to add/list/delete cases.
- **Metric runner**: an admin `POST /rag/evaluate` runs each case's query through the hybrid retriever and computes per-case and aggregate metrics: recall@K, precision@K, F1@K, average/percentile latency, empty-result rate, and a cross-user-leakage check (every retrieved chunk must belong to the target knowledge base).
- **Honest unsupported-claim handling**: cases with zero relevant chunks retrieved are counted as `emptyGroundingRate`; the LLM-judged unsupported-claim rate is reported as `null` (not fabricated) until an LLM-assisted pass is added.
- **BREAKING**: none — the existing `rag_eval_cases` table gains columns (migration `019`), old rows remain valid.

## Capabilities

### New Capabilities

- `rag-evaluation`: retrieval evaluation over a per-knowledge-base test dataset — case management, metric computation (recall@K, precision@K, F1@K, latency, empty-result, leakage checks), and aggregate reports for comparing retrieval versions.

### Modified Capabilities

<!-- None: rag-vector-index's requirements are unchanged; this is a separate observability capability. -->

## Impact

- `backend/migrations/019_rag_eval_cases_extend.sql` — extend `rag_eval_cases` (knowledge_base_id, distractor_chunk_ids, expected_pages, created_by).
- New `backend/src/modules/rag/evaluation.service.ts` + `evaluation.controller.ts` (admin) — case CRUD and run.
- `HybridRetrieverService` reused as the retrieval under test (no behavior change to it).
- New pure metric helpers in `rag-eval-metrics.ts` (fully unit-testable without services).
- Docs: `IMPLEMENTATION_STATUS.md` §8.10 row, `CHANGELOG.md`.
