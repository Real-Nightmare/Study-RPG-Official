## 1. Deletion pipeline

- [x] 1.1 `DocumentDeletionService`: state-validated per-document delete (refuse mid-ingestion, delete `kb_chunks` rows, scroll+delete Qdrant points in active collection via `CollectionResolver`, mark `deleted`, failure → `failed` + `last_error`)
- [x] 1.2 Wire into `KnowledgeBaseService` KB delete + `documents.service` delete path; add `DELETE /knowledge-bases/:id/documents/:docId`
- [x] 1.3 Unit tests: happy path, mid-ingestion refusal, failure rollback

## 2. Reranker

- [x] 2.1 `RerankProvider` interface + OpenRouter/OpenAI-compat/Ollama providers + `RerankService` (env-selected, no-op when unconfigured)
- [x] 2.2 Integrate rerank stage into `HybridRetrieverService` (`rerank`, `rerankTopK` options; payload `reranked` flag)
- [x] 2.3 Unit tests: unconfigured pass-through, active rerank ordering with mocked provider

## 3. Validation + docs

- [x] 3.1 Backend build/lint/tests pass
- [x] 3.2 Update `IMPLEMENTATION_STATUS.md` + `CHANGELOG.md`
