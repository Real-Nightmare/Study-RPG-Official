# Feature Specification: RAG Document Deletion

**Feature Branch**: `005-rag-deletion`

**Created**: 2026-08-06

**Status**: Implemented

**Input**: Migrated from OpenSpec spec `openspec/specs/rag-deletion/spec.md` (PDF Phase 3 — Production RAG lifecycle).

## User Scenarios & Testing

### User Story 1 — State-walked per-document deletion (Priority: P1)

A user deletes a document they own; the system transitions it through `deleting` to `deleted`,
refuses deletion while ingestion is mid-flight, removes its chunks from Postgres and the active
Qdrant collection, and rolls back to `failed` with the error recorded if any step fails.

**Why this priority**: Leaving stale chunks behind corrupts retrieval and citations; mid-ingestion
deletion corrupts the ingestion state machine.

**Independent Test**: Delete an owned document with chunks and verify chunk removal in Postgres and
Qdrant, plus the recorded lifecycle.

**Acceptance Scenarios**:

1. **Given** an owned document with chunks is deleted, **When** the deletion lifecycle runs,
   **Then** its chunks are removed from Postgres and the active Qdrant collection, and the document
   row is removed with the lifecycle recorded.
2. **Given** a document in `parsing`, `embedding`, or `indexing` state is deleted,
   **When** the deletion is requested, **Then** it is refused with a conflict response.
3. **Given** a chunk or vector removal fails during deletion, **When** the failure occurs,
   **Then** the document state is set to `failed` with the error recorded and no partial deletion
   is reported as success.

---

### User Story 2 — Delete endpoint (Priority: P2)

Document deletion is reachable through the knowledge-base API per document, under ownership checks.

**Acceptance Scenarios**:

1. **Given** a caller issues `DELETE /knowledge-bases/:id/documents/:docId`,
   **When** ownership checks pass, **Then** the deletion lifecycle runs and a confirmation is
   returned.

---

### Edge Cases

- Deleting a document with no chunks.
- Deleting an already-deleted document (idempotent not-found).
- Deletion while a reindex job is touching the same collection.

## Requirements

### Functional Requirements

- **FR-001**: Deleting a document MUST transition it through `deleting` to `deleted`.
- **FR-002**: Deletion MUST be refused with a conflict while a document is in `parsing`,
  `embedding`, or `indexing`.
- **FR-003**: Deletion MUST remove the document's chunks from `kb_chunks` and the active Qdrant
  collection.
- **FR-004**: If any step fails, the document state MUST be set to `failed` with the error
  recorded, and partial deletion MUST NOT be reported as success.
- **FR-005**: Deletion MUST be reachable via `DELETE /knowledge-bases/:id/documents/:docId` under
  ownership checks.

### Key Entities

- **Document**: ingestion state machine row (parsing/embedding/indexing/deleting/deleted/failed).
- **DocumentDeletionService**: walks the state machine and coordinates chunk + vector removal.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Deleting a document removes all of its retrieval traces (Postgres chunks + Qdrant
  vectors) — verified by post-delete search.
- **SC-002**: Mid-ingestion delete attempts are rejected, never corrupting the state machine.
- **SC-003**: Failed deletions leave an explicit `failed` state with recorded error — no silent
  partial success.
- **SC-004**: Only the document owner can delete a document.

## Assumptions

- The active Qdrant collection is the single source of truth for vectors (per 003-rag-vector-index).
- Deletion is synchronous from the caller's perspective (no background deletion queue in v1).
