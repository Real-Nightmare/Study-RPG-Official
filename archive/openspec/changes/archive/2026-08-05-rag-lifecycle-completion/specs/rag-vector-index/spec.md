## ADDED Requirements

### Requirement: Rerank option on hybrid search

The hybrid search endpoint SHALL accept a `rerank` boolean and `rerankTopK` limit that opt into the reranker stage without changing the default behavior.

#### Scenario: Opt-in reranking
- **WHEN** `rerank=true` is passed to hybrid search
- **THEN** the results pass through the reranker stage when available, and the payload indicates whether reranking was applied
