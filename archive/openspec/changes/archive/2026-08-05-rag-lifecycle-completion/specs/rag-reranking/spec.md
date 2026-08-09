## Purpose

Optional reranker stage for hybrid retrieval backed by a provider abstraction (OpenRouter, OpenAI-compatible, or local Ollama) that degrades gracefully to fusion order when not configured.

## ADDED Requirements

### Requirement: Reranker provider abstraction

A `RerankerProvider` contract SHALL support OpenRouter, OpenAI-compatible endpoints, and local Ollama, selected by configuration, and SHALL report whether it is available.

#### Scenario: Provider selection
- **WHEN** reranker configuration names a provider and endpoint
- **THEN** the matching provider implementation is used and availability is reported

#### Scenario: Unconfigured pass-through
- **WHEN** no reranker configuration is present
- **THEN** retrieval returns the reciprocal-rank-fusion order unchanged with no error

### Requirement: Rerank stage in hybrid search

Hybrid search SHALL accept a rerank option and SHALL rerank the top candidates when the provider is available, returning the re-scored order.

#### Scenario: Rerank requested and available
- **WHEN** a search specifies `rerank=true` and a provider is configured
- **THEN** the top candidates are re-scored and returned in the reranked order with scores

#### Scenario: Rerank unavailable
- **WHEN** a search specifies `rerank=true` but no provider is configured
- **THEN** the fusion-order results are returned unchanged without failing the request
