# Feature Specification: Versioned Qdrant Vector Index

**Feature Branch**: `003-rag-vector-index`

**Created**: 2026-08-06

**Status**: Implemented

**Input**: Migrated from OpenSpec spec `openspec/specs/rag-vector-index/spec.md` (PDF Phase 3 — Production RAG, §8.9).

## User Scenarios & Testing

### User Story 1 — Safe embedding-model upgrades (Priority: P1)

An operator changes the embedding model (or dimensions) and the system automatically derives a new
collection name per content type, leaving the previous collection intact so retrieval never mixes
incompatible vectors.

**Why this priority**: Embedding-model changes are the highest-risk RAG operation; wrong-vector reuse
silently corrupts retrieval quality.

**Independent Test**: Change the embedding provider version and verify the active collection name
differs and the previous collection is untouched.

**Acceptance Scenarios**:

1. **Given** the embedding provider version changes (model or dimensions), **When** the active
   collection is resolved, **Then** its name differs from the previous one and the previous
   collection is left intact.

---

### User Story 2 — Single-point active collection resolution (Priority: P1)

All chunk upserts and hybrid searches resolve the active collection through one resolution point
that honors a configured override before falling back to the embedding-provider-derived version.

**Why this priority**: One resolution point prevents drift between write and read collections.

**Independent Test**: With and without `QDRANT_COLLECTION_VERSION` set, verify which collection is
used for upserts and searches.

**Acceptance Scenarios**:

1. **Given** no version override is configured, **When** the active collection is resolved,
   **Then** it is derived from the current embedding provider version.
2. **Given** an operator sets `QDRANT_COLLECTION_VERSION` to a specific version,
   **When** the active collection is resolved, **Then** it resolves to that version's collection.

---

### User Story 3 — Background reindex with old-index retention (Priority: P2)

An operator kicks off a reindex from version A to version B; chunks are re-embedded with the
target model and written to B with progress reported, while A stays queryable until B is fully
populated, then the active version switches.

**Why this priority**: Reindexing must not create downtime or a half-empty index.

**Independent Test**: Start a reindex, poll progress, and verify A stays queryable until switch.

**Acceptance Scenarios**:

1. **Given** a background reindex from version A to B is requested, **When** chunks are processed,
   **Then** they are embedded with the target model and written to B, progress is reported, and A
   remains queryable until completion.
2. **Given** the reindex has successfully populated B, **When** it finishes,
   **Then** the active version switches to B and subsequent searches use B.

---

### User Story 4 — Stale-point cleanup (Priority: P3)

After a successful switch, an operator can purge points belonging to the superseded version, scoped
by the version recorded on each point, without touching the currently active collection.

**Why this priority**: Hygiene and storage cost; not a correctness blocker.

**Acceptance Scenarios**:

1. **Given** a reindexed version has been active and an operator purges the superseded version,
   **When** the purge runs, **Then** only points recorded with the superseded version are removed
   and the active collection is unaffected.

---

### User Story 5 — Opt-in reranking (Priority: P3)

The hybrid search endpoint accepts `rerank` and `rerankTopK` to opt into the reranker stage without
changing default behavior.

**Acceptance Scenarios**:

1. **Given** `rerank=true` is passed to hybrid search, **When** the search runs,
   **Then** results pass through the reranker stage when available and the payload indicates
   whether reranking was applied.

---

### Edge Cases

- Reindex into an already-existing target version collection.
- Purge request for the currently active version (must be refused).
- Embedding provider becomes unavailable mid-reindex.

## Requirements

### Functional Requirements

- **FR-001**: Collections MUST be named from content type + embedding provider version (model and
  vector dimensions), e.g. `knowledge_base_<model>_<dims>`.
- **FR-002**: The active collection MUST be resolved through a single resolution point honoring
  `QDRANT_COLLECTION_VERSION` before the embedding-provider-derived fallback.
- **FR-003**: All chunk upserts and hybrid searches MUST target the resolved active collection.
- **FR-004**: A background reindex MUST re-embed chunks from the active collection into a target
  version collection, report progress, and keep the old collection queryable until the target is
  fully populated.
- **FR-005**: The active version MUST switch to the target only after reindex completion.
- **FR-006**: Superseded-version point cleanup MUST be scoped to the version recorded on each point
  and MUST NOT delete points of the active version.
- **FR-007**: Hybrid search MUST accept `rerank` and `rerankTopK` as opt-in parameters without
  changing default behavior.

### Key Entities

- **RagIndexState**: persisted active collection version per content type.
- **CollectionResolver**: single resolution point (override → provider version).
- **ReindexJob**: background reindex work item with progress.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Changing the embedding model/dimensions never reuses an incompatible collection.
- **SC-002**: Write and read paths always agree on the active collection.
- **SC-003**: A reindex completes with the old index queryable throughout and zero query downtime.
- **SC-004**: Purging a superseded version removes only that version's points.

## Assumptions

- Qdrant is the only vector store (no multi-store abstraction needed yet).
- Operators trigger reindexing explicitly (admin endpoint) rather than automatically on model change.
- Vector dimension is part of the provider version and therefore the collection name.
