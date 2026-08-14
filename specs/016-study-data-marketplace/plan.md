# Plan: Study RPG — Data Marketplace & AI Effectiveness Benchmark

**Input**: `spec.md` (US1–US3).

**Prerequisites**: none — build + tests green at start.

## Strategy

Three coordinated workstreams. **(1) Consent + dataset lifecycle:** one
migration (`030_study_data_marketplace.sql`) with `data_consent`,
`marketplace_datasets` and `benchmark_runs`; `MarketplaceService` owns consent,
dataset CRUD and the publish/revoke path, every mutation audited with a reason.
**(2) Privacy-first Ocean publish:** `privacy-guard.ts` (already present) is the
final gate — aggregates only, consent-only cohort, min group size + consent
coverage; `OceanService` builds the DDO (`did:op` from the metadata hash,
checksummed `files` entry) and POSTs to Aquarius, never throwing when
unconfigured (DDO stored for re-submission/export). **(3) Admin benchmark:**
`BenchmarkService` compares two consecutive windows (admin picks N days +
optional cohort filters), pure `benchmark-metrics.ts` computes deltas + a
weighted 0–100 effectiveness score + verdict band, and an AI narrative grounded
ONLY in those numbers (deterministic fallback) is attached. Frontend: a new
admin **Data & Benchmarks** tab (start/list benchmarks, dataset CRUD +
publish/revoke with privacy report) and a student consent toggle in Account
Settings; one locale namespace per surface across all 15 locale files.

## Phase 1 — Schema & foundation

- T001 Migration `backend/migrations/030_study_data_marketplace.sql` —
  `data_consent`, `marketplace_datasets`, `benchmark_runs` (+ indexes).
- T002 `marketplace-config.ts` — env-driven config (Aquarius URL, publisher
  wallet, chain id, publish switch, min group size, consent threshold,
  license, aggregate window) with safe defaults.

## Phase 2 — Pure modules (unit-tested)

- T003 `benchmark-metrics.ts` — `metricDelta`, `computeDeltas`,
  `effectivenessScore` (weighted, clamped), `effectivenessBand`,
  `buildEffectivenessReport`, `mean`, `pct`.
- T004 Unit tests `benchmark-metrics.spec.ts`.
- T005 `privacy-guard.ts` hardening: fix `session` blocklist term
  (`session_id` instead) so aggregate fields like `avg_session_minutes` pass.

## Phase 3 — Ocean service (guarded, never throws)

- T006 `ocean.service.ts` — `mintDid`, `buildDdo` (OEP-08-style, checksummed
  files), `publishMetadata` (Aquarius POST; disabled/unconfigured → no-op).
- T007 Unit tests `ocean.service.spec.ts`.

## Phase 4 — Marketplace service + controller

- T008 `marketplace.service.ts` — consent get/set (audited), dataset CRUD
  (audited), `publishDataset` (aggregate over consenting cohort → privacy
  guard → checksum → DDO → Aquarius; privacy report persisted), `revoke`.
- T009 Unit tests `marketplace.service.spec.ts`.
- T010 `marketplace.controller.ts` + `marketplace.module.ts` + `index.ts` +
  registration in `app.module.ts`; routes under `/data-marketplace`.

## Phase 5 — Admin AI benchmark

- T011 `benchmark.service.ts` — start (two-window metrics → report → AI
  narrative with fallback), list, get; admin-only.
- T012 Backend verify: `npm run build`, `npm test`, `npx eslint "src/**/*.ts"`.

## Phase 6 — Frontend

- T013 `types/index.ts` + `config/api.ts` endpoints + `services/dataMarketplace.ts`.
- T014 `AdminPage.tsx` — new **Data & Benchmarks** tab (admin): start/list
  benchmark runs with deltas/score/band/AI report; dataset CRUD with
  publish/revoke/delete (reason prompts) and privacy report.
- T015 `AccountSettingsPage.tsx` — Data & Privacy consent toggle.
- T016 Locale keys in all 15 locale files (`admin.tab.*`, `admin.benchmarks.*`,
  `admin.datasets.*`, `accountSettingsPage.*`).
- T017 Frontend verify: `tsc -b --noEmit`, `npm run lint`, `npm test`.

## Phase 7 — Docs & status

- T018 `docs/getting-started/configuration.md` — Ocean env vars.
- T019 `IMPLEMENTATION_STATUS.md` + `CHANGELOG.md` + `specs/README.md` +
  tasks checked off.
