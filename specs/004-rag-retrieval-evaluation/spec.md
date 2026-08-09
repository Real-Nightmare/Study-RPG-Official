# Feature Specification: RAG Retrieval Evaluation

**Feature Branch**: `004-rag-retrieval-evaluation`

**Created**: 2026-08-06

**Status**: Implemented

**Input**: Migrated from OpenSpec spec `openspec/specs/rag-evaluation/spec.md` (PDF Phase 3 — Production RAG, §8 retrieval evaluation).

## User Scenarios & Testing

### User Story 1 — Evaluation case management (Priority: P1)

An administrator creates, lists, and deletes evaluation cases, each scoped to a knowledge base and
containing a query, expected source document ids, expected sections/pages, relevant chunk ids, and
optional distractor chunk ids.

**Why this priority**: Cases are the dataset for measuring retrieval quality; without them there is
nothing to evaluate.

**Independent Test**: Create, list, and delete a case for a knowledge base and verify it appears
and disappears from the case list.

**Acceptance Scenarios**:

1. **Given** an administrator submits a case with a query and relevant chunk ids for a knowledge
   base, **When** it is saved, **Then** it is persisted against that knowledge base and appears in
   the case list for it.
2. **Given** an administrator deletes an existing case, **When** the delete is issued,
   **Then** the case is removed and no longer appears in the case list.

---

### User Story 2 — Retrieval metric computation (Priority: P1)

An administrator runs an evaluation for a knowledge base with a specified K; each case's query runs
through retrieval and reports recall@K, precision@K, F1@K, and latency, with aggregate
recall/precision/F1 and latency statistics (average and 95th percentile) over the run.

**Why this priority**: The whole point of evaluation is evidence-based comparison when switching
embedding models or collection versions.

**Independent Test**: Run an evaluation over a small case set and verify per-case and aggregate
metrics.

**Acceptance Scenarios**:

1. **Given** an administrator runs an evaluation for a knowledge base with K specified,
   **When** each case's query runs through retrieval, **Then** per-case recall@K, precision@K,
   F1@K, and latency are reported alongside the aggregate metrics.
2. **Given** every retrieved chunk for a case is in its relevant chunk ids and K equals the number
   of relevant chunks, **When** the metrics are computed, **Then** the case reports recall@K of 1
   and precision@K of 1.

---

### User Story 3 — Empty-result handling (Priority: P2)

Cases whose retrieval returns zero chunks are counted and reported as the empty-result rate without
aborting the run or erroring.

**Acceptance Scenarios**:

1. **Given** a case query retrieves no chunks while other cases do, **When** the run completes,
   **Then** the empty case is reported with zero scores, the empty-result rate reflects it, and the
   remaining cases are still scored.

---

### User Story 4 — Cross-user leakage detection (Priority: P2)

Every retrieved chunk in a run is verified to belong to the target knowledge base; any chunk that
does not is reported as a leakage violation with its id and count.

**Why this priority**: Leakage silently inflates quality numbers and can leak content across
tenants — it must be surfaced in every report.

**Acceptance Scenarios**:

1. **Given** a retrieved chunk id is not owned by the target knowledge base, **When** the run
   checks ownership, **Then** the run reports a leakage violation with the offending chunk id and
   the leak count is included in the report.

---

### Edge Cases

- Run with zero cases.
- Case with no expected pages (section-only expectations).
- Retrieval service down (run fails cleanly with error, no partial report).

## Requirements

### Functional Requirements

- **FR-001**: Administrators MUST be able to create, list, and delete evaluation cases scoped to a
  knowledge base, with query, expected source document ids, expected sections/pages, relevant chunk
  ids, and optional distractor chunk ids.
- **FR-002**: The system MUST compute recall@K, precision@K, and F1@K per case from retrieved vs
  relevant chunk ids, and record per-query retrieval latency.
- **FR-003**: Aggregate recall/precision/F1 and latency statistics (average and 95th percentile)
  MUST be computed over the cases in a run.
- **FR-004**: Cases with zero retrieved chunks MUST be counted and reported as the empty-result
  rate without aborting the run.
- **FR-005**: Every retrieved chunk MUST be checked for ownership by the target knowledge base;
  violations MUST be reported with the offending chunk id and count.

### Key Entities

- **RagEvalCase**: query, expected docs/pages, relevant + distractor chunk ids, knowledge base scope.
- **EvaluationRun**: per-case metrics + aggregates (recall/precision/F1, latency, empty rate, leaks).

## Success Criteria

### Measurable Outcomes

- **SC-001**: An administrator can compare two embedding models or collection versions with a
  single run's evidence.
- **SC-002**: Perfect retrieval scores 1.0 recall@K and precision@K; empty cases score zero and are
  counted.
- **SC-003**: Every run reports leakage violations explicitly — never silently mixed-in data.
- **SC-004**: Runs complete for any case dataset without aborting on empty results.

## Assumptions

- Only administrators create/run evaluations (teacher/student read access is out of scope for v1).
- Evaluation runs use the current active collection unless overridden.
