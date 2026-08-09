## Context

See proposal.md — Why. Existing pieces reused: `rag_eval_cases` table (migration 017, extended by migration 019 in this change), `HybridRetrieverService.retrieve(kbId, userId, query, {limit})` as the retrieval under test, the global `QdrantModule`/`AiModule`, and the `RagModule` from the previous change (adds `rag-reindex` worker + admin `POST /rag/reindex`).

## Goals / Non-Goals

**Goals:**
- Admin-managed evaluation dataset scoped per knowledge base.
- A metric runner that produces per-case + aggregate reports (recall@K, precision@K, F1@K, latency avg/p95, empty-result rate, leakage violations).
- Metrics as pure, unit-testable functions independent of DB/Qdrant.
- Reports comparable across retrieval versions (the same KB cases can be re-run after a reindex).

**Non-Goals:**
- LLM-judged unsupported-claim rate — reported as `null` (requires an LLM pass; not fabricated).
- Automatic evaluation runs or CI gating — evaluation stays an explicit admin action for now.
- UI — backend API only, consistent with the rest of Phase 3.

## Decisions

**D1. Cases scoped to a knowledge base via `knowledge_base_id`**
`rag_eval_cases` gains `knowledge_base_id` (FK, cascade) so runs target a concrete index with authorization already applied by the retriever. Alternative considered: global cases — rejected: retrieval is per-KB, and §8.10's dataset must map to real expected documents/chunks.

**D2. Relevance measured against `relevant_chunk_ids` (not document ids)**
Chunk-level matching makes recall/precision exact (retrieval returns chunks). Document/section ids remain in the case for reporting. Distractors are stored but only used for reporting context in this change — they inform future negative-precision work rather than being injected into retrieval.

**D3. Pure metric helpers in `rag-eval-metrics.ts`**
`recallAtK`, `precisionAtK`, `f1AtK`, `percentile`, and aggregate computation take plain arrays — fully unit-testable, matching the pattern of `hybrid-rank.ts`.

**D4. Runner lives in `RagModule` next to reindex**
`EvaluationService` injects `HybridRetrieverService` (importing `KnowledgeBaseModule` for its export) and reuses the retriever untouched. Admin endpoints on `RagController` (or a new `EvaluationController`) with `@Roles(Role.ADMIN)`.

**D5. Leakage = chunk not owned by the target KB**
After retrieval, chunk ids are checked against `kb_chunks` where `knowledge_base_id` = target; any hit not owned is a violation. The retriever already enforces ownership, so this is a verification pass that makes the guarantee observable (§8.10).

## Risks / Trade-offs

- [Proxy definitions (empty-grounding vs unsupported-claim)] → Explicitly reported as distinct, honestly-labeled metrics; no fabricated LLM judgment.
- [Eval cases drift from real data] → Cases are admin-maintained; docs note they must be refreshed when content changes.
- [Evaluation cost/time] → Runs are bounded (`limit` on cases, K capped); latency measured per case.

## Migration Plan

1. Deploy migration `019` (additive columns; existing rows get `knowledge_base_id` NULL and are excluded from KB-scoped runs until re-linked).
2. Deploy code; endpoints are admin-only.
3. Populate cases for a KB, run `POST /rag/evaluate`, capture a baseline report before any future embedding-model change.
4. Rollback: remove the endpoints/module; data table is additive and harmless.

## Open Questions

None — all unknowns are safely deferrable without changing specs, approach, or tasks.
