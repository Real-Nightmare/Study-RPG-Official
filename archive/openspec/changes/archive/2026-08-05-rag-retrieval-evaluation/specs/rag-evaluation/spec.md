## Purpose

Measures the quality of RAG retrieval against a per-knowledge-base test dataset, so embedding-model or collection-version changes can be compared with evidence (recall/precision, latency, empty results, and leakage) before switching the active index.

## ADDED Requirements

### Requirement: Evaluation case management

The system SHALL let an administrator create, list and delete evaluation cases, each scoped to a knowledge base and containing a query, expected source document ids, expected sections or pages, relevant chunk ids, and optional distractor chunk ids.

#### Scenario: Create an evaluation case

- **WHEN** an administrator submits a case with a query and relevant chunk ids for a knowledge base
- **THEN** the case is persisted against that knowledge base and appears in the case list for it

#### Scenario: Delete an evaluation case

- **WHEN** an administrator deletes an existing case
- **THEN** the case is removed and no longer appears in the case list

### Requirement: Retrieval metric computation

The system SHALL compute, for each case, recall at K, precision at K and F1 at K from the retrieved chunk ids versus the case's relevant chunk ids, and SHALL record the retrieval latency of each case query. Aggregate recall/precision/F1 and latency statistics (average and 95th percentile) SHALL be computed over the cases in a run.

#### Scenario: Run evaluation over cases

- **WHEN** an administrator runs an evaluation for a knowledge base with K specified
- **THEN** each case's query is run through retrieval and per-case recall@K, precision@K, F1@K and latency are reported alongside the aggregate metrics

#### Scenario: Perfect retrieval scores perfectly

- **WHEN** every retrieved chunk for a case is in its relevant chunk ids and K equals the number of relevant chunks
- **THEN** the case reports recall@K of 1 and precision@K of 1

### Requirement: Empty-result handling

The system SHALL count cases whose retrieval returns zero chunks and report the fraction of such cases in the run as the empty-result rate, without treating them as errors that abort the run.

#### Scenario: Some queries return nothing

- **WHEN** a case query retrieves no chunks while other cases do
- **THEN** the empty case is reported with zero scores, the empty-result rate reflects it, and the remaining cases are still scored

### Requirement: Cross-user leakage check

The system SHALL verify, for every retrieved chunk in an evaluation run, that it belongs to the target knowledge base, and SHALL report any retrieved chunk that does not as a leakage violation.

#### Scenario: Leakage is detected

- **WHEN** a retrieved chunk id is not owned by the target knowledge base
- **THEN** the run reports a leakage violation with the offending chunk id and the leak count is included in the report
