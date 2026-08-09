## Purpose

Manages versioned Qdrant vector collections for RAG retrieval so embedding-model changes are safe: collections are named by embedding provider version, the active version can be switched via configuration, and reindexing happens in the background while the previous index stays queryable.

## ADDED Requirements

### Requirement: Versioned collection naming

The system SHALL name each RAG vector collection from its content type and the embedding provider's version (model + vector dimensions), e.g. `knowledge_base_<model>_<dims>`, so that changing the embedding model or dimensions yields a distinct collection rather than reusing an incompatible one.

#### Scenario: New embedding model yields a new collection

- **WHEN** the embedding provider version changes (model or dimensions)
- **THEN** the active collection name differs from the previous one and the previous collection is left intact

### Requirement: Active collection resolution

The system SHALL resolve the active collection for a content type through a single resolution point, honoring a configured override (`QDRANT_COLLECTION_VERSION`) before falling back to the version derived from the embedding provider. All chunk upserts and hybrid searches SHALL target the resolved active collection.

#### Scenario: Default resolution uses embedding provider version

- **WHEN** no version override is configured
- **THEN** the active collection is derived from the current embedding provider version

#### Scenario: Configured override selects a different version

- **WHEN** an operator sets `QDRANT_COLLECTION_VERSION` to a specific version
- **THEN** the active collection resolves to that version's collection

### Requirement: Background reindex with old-index retention

The system SHALL provide a background reindex operation that re-embeds chunks from the current active collection into a target version collection, reports progress, and keeps the old collection queryable until the target collection has been fully populated. The active version SHALL switch to the target only after the reindex completes.

#### Scenario: Reindex into a new version

- **WHEN** a background reindex from version A to version B is requested
- **THEN** chunks are embedded with the target version's model and written to collection B, progress is reported, and collection A remains queryable until completion

#### Scenario: Reindex completes and switches active version

- **WHEN** the reindex has successfully populated collection B
- **THEN** the active version switches to B and subsequent searches use collection B

### Requirement: Stale-point cleanup after switch

The system SHALL allow deletion of points belonging to a superseded collection version after a successful switch, scoped to the version recorded on each point, and SHALL NOT delete points of the currently active version.

#### Scenario: Purge superseded points

- **WHEN** a reindexed version has been active and an operator purges the superseded version
- **THEN** only points recorded with the superseded version are removed and the active collection is unaffected
