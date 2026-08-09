## Purpose

Per-document deletion lifecycle for the RAG pipeline: state-walked deletion that removes chunks from Postgres and Qdrant before the document is marked deleted, with failure rollback.

## ADDED Requirements

### Requirement: State-walked per-document deletion

Deleting a document SHALL transition it through `deleting` to `deleted`, SHALL refuse deletion while ingestion is mid-flight, SHALL remove its chunks from `kb_chunks` and the active Qdrant collection, and SHALL roll back to `failed` with an error recorded if any step fails.

#### Scenario: Successful document deletion
- **WHEN** an owned document with chunks is deleted
- **THEN** its chunks are removed from Postgres and the active Qdrant collection, and the document row is removed with the lifecycle recorded

#### Scenario: Mid-ingestion refusal
- **WHEN** a document in `parsing`, `embedding` or `indexing` state is deleted
- **THEN** the deletion is refused with a conflict response

#### Scenario: Failure rollback
- **WHEN** a chunk or vector removal fails during deletion
- **THEN** the document state is set to `failed` with the error recorded, and no partial deletion is reported as success

### Requirement: Delete endpoint

Document deletion SHALL be reachable through the knowledge-base API per document.

#### Scenario: API surface
- **WHEN** a caller issues `DELETE /knowledge-bases/:id/documents/:docId`
- **THEN** the deletion lifecycle runs under ownership checks and returns a confirmation
