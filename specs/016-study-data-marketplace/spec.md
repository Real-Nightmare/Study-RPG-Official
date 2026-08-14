# Feature Specification: Study RPG — Data Marketplace & AI Effectiveness Benchmark

**Feature Branch**: `016-study-data-marketplace`

**Created**: 2026-08-14

**Status**: Implemented

**Input**: Owner brief — "integrate Ocean Protocol support so I can keep this
project sustainable by selling educational data … add proper limitations for
Ocean Protocol to not leak students credentials and add the ability for me to
benchmark students did to give accurate scores on why Study RPG is useful like
a special section for admins to go and start a AI benchmarking process."

## Problem

Study RPG needs a sustainable funding path that does **not** compromise its
100% Free-to-Win integrity: no pay-to-win, no monetisation of game progress,
and no exploitation of students. Selling *educational data* through the Ocean
Protocol ecosystem is the chosen path — but only if it is privacy-first to the
extreme: aggregates only, consent-only cohorts, and no credential/raw-data
leakage. Separately, the owner wants hard *evidence* of effectiveness: an
admin-only AI benchmarking pipeline that measures how much studying with
Study RPG improves real outcomes.

## Non-goals

- No pay-to-win or in-game monetisation of any kind (F2W integrity untouched).
- No raw-row / free-text / per-user data export — ever.
- No on-chain datatoken minting in this iteration (requires a funded wallet +
  the Ocean SDK); the metadata-first DDO publish is delivered, and the stored
  DDO is re-submittable/exportable for the on-chain step.

## User Stories & Acceptance Scenarios

### User Story 1 — Students control data sharing (P0)

A student can opt in/out of anonymised aggregate data sharing at any time from
Account Settings.

- **WHEN** a student toggles data sharing consent on/off
- **THEN** the change is persisted (`data_consent`), audited with a reason, and
  reflected immediately in consent status.

### User Story 2 — Privacy-guarded publish to Ocean (P0)

Admins publish datasets to the Ocean ecosystem as DDO metadata — and the
publish path is guarded so nothing but numeric aggregates over a sufficiently
large, consenting cohort can ever leave the module.

- **WHEN** an admin publishes a dataset
- **THEN** the aggregate is computed over consenting users only, every output
  field is validated by the privacy guard (aggregate-only + blocklist +
  minimum group size + consent coverage), the exact payload is SHA-256
  checksummed into the DDO, the DDO is POSTed to Aquarius (never blocking on
  network errors), and the action is audited with a reason.
- **WHEN** the cohort is too small, consent coverage is too low, or any output
  field is not a safe aggregate
- **THEN** publication is rejected with the guard's reasons.

### User Story 3 — Admin AI effectiveness benchmarking (P0)

Admins run an AI benchmark that compares two consecutive study windows and
scores how much Study RPG improved outcomes.

- **WHEN** an admin starts a benchmark with a window length (N days) and
  optional cohort filters
- **THEN** the same metrics are computed for windows [2N, N) and [N, today),
  per-metric deltas and a weighted 0–100 effectiveness score are derived, and
  an AI narrative grounded ONLY in those numbers (deterministic fallback when
  AI is unavailable) is stored with the run.
- **THEN** the report is admin-only, is never published to the marketplace,
  and never references individual students.

## Requirements

### Requirement: Consent management

Students SHALL have a revocable consent record (`data_consent`) and be able to
read and update it via `GET/PUT /data-marketplace/consent`; consent changes
SHALL be audited.

### Requirement: Dataset lifecycle

Admins SHALL create/update/delete draft datasets, publish them
(privacy-guarded → DDO → Aquarius), and revoke published datasets
(`POST/PATCH/DELETE /data-marketplace/datasets*`); every mutation SHALL be
audited with a reason. Students SHALL only ever see published datasets.

### Requirement: Aggregate-only publish path

Publication SHALL compute aggregates over the consenting cohort (with
allowlisted cohort filters: country/board/grade), run every output field
through `privacy-guard.ts` (`sanitizeAggregate` + `assertPublishable` with
minimum group size and consent-coverage threshold), checksum the exact payload,
and embed it in the Ocean DDO.

### Requirement: Ocean DDO publish

The module SHALL build a standard DDO (`did:op:` derived from the metadata
hash, OEP-08-style metadata with type `dataset`, price, cohort stats, and a
`files` entry carrying the sha256 checksum) and POST it to
`OCEAN_AQUARIUS_URL/api/aquarius/assets/ddo`. Unconfigured/disabled publishes
SHALL NOT throw — the DDO is stored so it can be re-submitted or exported.

### Requirement: Admin-only benchmark pipeline

`POST/GET /data-marketplace/benchmarks*` SHALL be admin-only. Each run SHALL
compare two windows, compute deltas + a weighted effectiveness score (pure
module `benchmark-metrics.ts`), attach an AI narrative grounded in the metrics
only, and persist `metrics`, `report`, `summary` on `benchmark_runs`.

## Testing Notes

- Unit tests: `privacy-guard.spec.ts` (existing), `benchmark-metrics.spec.ts`
  (delta math, score, bands, report), `ocean.service.spec.ts` (DID minting,
  DDO shape, publish guards), `marketplace.service.spec.ts` (consent, dataset
  CRUD + audit, publish blocked/passed, revoke).
- Backend suite green: **471 tests / 59 suites**. Frontend `tsc -b --noEmit` +
  lint (0 errors) + vitest (9 tests) green.
- Runtime publish to real Aquarius requires `OCEAN_AQUARIUS_URL` (+ optional
  publisher wallet); without it everything works in draft mode.
