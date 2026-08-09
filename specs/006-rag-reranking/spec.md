# Feature Specification: RAG Hybrid Retrieval Reranking

**Feature Branch**: `006-rag-reranking`

**Created**: 2026-08-06

**Status**: Implemented

**Input**: Migrated from OpenSpec spec `openspec/specs/rag-reranking/spec.md` (PDF Phase 3 — Production RAG, hybrid retrieval quality).

## User Scenarios & Testing

### User Story 1 — Pluggable reranker providers (Priority: P1)

The reranker stage is backed by a provider abstraction supporting OpenRouter, OpenAI-compatible
endpoints, and local Ollama, selected by configuration, and reports whether it is available.

**Why this priority**: Reranking is opt-in and environment-dependent; the abstraction keeps the
search path clean regardless of provider availability.

**Independent Test**: Configure each provider and verify selection + availability reporting; verify
no-config behaves as pass-through.

**Acceptance Scenarios**:

1. **Given** reranker configuration names a provider and endpoint, **When** retrieval runs,
   **Then** the matching provider implementation is used and availability is reported.
2. **Given** no reranker configuration is present, **When** retrieval runs,
   **Then** results return in the reciprocal-rank-fusion order unchanged with no error.

---

### User Story 2 — Rerank stage in hybrid search (Priority: P2)

Hybrid search accepts a rerank option and reranks the top candidates when the provider is
available, returning the re-scored order.

**Acceptance Scenarios**:

1. **Given** a search specifies `rerank=true` and a provider is configured,
   **When** the search runs, **Then** the top candidates are re-scored and returned in the reranked
   order with scores.
2. **Given** a search specifies `rerank=true` but no provider is configured,
   **When** the search runs, **Then** the fusion-order results are returned unchanged without
   failing the request.

---

### Edge Cases

- Reranker provider times out or returns an error mid-search (fall back to fusion order).
- `rerankTopK` larger than the candidate pool.
- Provider configured but API key invalid.

## Requirements

### Functional Requirements

- **FR-001**: A `RerankerProvider` contract MUST support OpenRouter, OpenAI-compatible endpoints,
  and local Ollama, selected by configuration, and MUST report availability.
- **FR-002**: Hybrid search MUST accept a rerank option and rerank the top candidates when the
  provider is available, returning the re-scored order.
- **FR-003**: When reranking is requested but unavailable, results MUST return unchanged in
  fusion order without failing the request.
- **FR-004**: Reranker failures MUST degrade gracefully to the fusion order.

### Key Entities

- **RerankerProvider**: provider abstraction with availability reporting.
- **HybridRetriever**: dense + lexical fusion with optional rerank stage.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Configuring a reranker provider reorders top results with scores; removing the config
  restores fusion order instantly.
- **SC-002**: No search request fails due to a missing or failing reranker.
- **SC-003**: Provider selection follows configuration deterministically.

## Assumptions

- Reranking applies to the top-K fusion candidates only (bounded cost), not the full pool.
- Ollama deployments are operator-managed and out of the platform's install scope.
