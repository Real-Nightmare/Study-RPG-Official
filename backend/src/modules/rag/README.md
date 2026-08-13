# RAG Module

Retrieval-augmented generation — **retrieval, evaluation, reranking and deletion** over
versioned Qdrant collections.

- **HTTP**: `@Controller('rag')`
- **Key service**: `EvaluationService`, `RagService`
- **Store**: Qdrant (`qdrant` module) + ClickHouse evaluation analytics
