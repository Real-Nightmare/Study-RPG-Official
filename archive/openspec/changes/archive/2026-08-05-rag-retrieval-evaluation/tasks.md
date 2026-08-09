## 1. Dataset + metrics core

- [x] 1.1 Migration `019_rag_eval_cases_extend.sql`: add `knowledge_base_id` (FK cascade), `distractor_chunk_ids`, `expected_pages`, `created_by` to `rag_eval_cases` + index
- [x] 1.2 Create pure metric helpers `rag-eval-metrics.ts`: recall@K, precision@K, f1@K, percentile, empty-rate, aggregate builder
- [x] 1.3 Unit tests for metric helpers (perfect/partial/empty/leak cases)

## 2. Evaluation service + endpoints

- [x] 2.1 Create `EvaluationService`: case add/list/delete (KB-scoped), `run(kbId, {k, limit})` using `HybridRetrieverService` with per-case latency, leak verification against `kb_chunks`, aggregate report
- [x] 2.2 Add admin endpoints: `POST /rag/eval-cases`, `GET /rag/eval-cases`, `DELETE /rag/eval-cases/:id`, `POST /rag/evaluate`
- [x] 2.3 Unit tests for `EvaluationService` with mocked retriever/db

## 3. Integration + docs

- [x] 3.1 Wire `EvaluationService` into `RagModule` (import `KnowledgeBaseModule` for the retriever export)
- [x] 3.2 Validate: backend build + lint + full `npm test` pass
- [x] 3.3 Update `IMPLEMENTATION_STATUS.md` (§8.10 row) and `CHANGELOG.md`
