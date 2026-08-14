# Tasks: Study RPG — Data Marketplace & AI Effectiveness Benchmark

**Input**: spec.md (US1–US3), plan.md.

**Prerequisites**: build + tests green.

## Phase 1: Schema & foundation
- [x] T001 Migration `backend/migrations/030_study_data_marketplace.sql`
      (unique prefix 030, ordered after 029): `data_consent`,
      `marketplace_datasets`, `benchmark_runs` + indexes.
- [x] T002 `data-marketplace/marketplace-config.ts` — env-driven config with
      safe defaults.

## Phase 2: Pure modules (unit-tested)
- [x] T003 `benchmark-metrics.ts` — deltas, weighted 0–100 score, bands,
      report builder, helpers.
- [x] T004 Unit tests `benchmark-metrics.spec.ts` (33 suite-tests total in the
      module).
- [x] T005 `privacy-guard.ts` — `session` blocklist term narrowed to
      `session_id` so legitimate aggregates (`avg_session_minutes`,
      `count_user_session_days`) pass.

## Phase 3: Ocean service
- [x] T006 `ocean.service.ts` — deterministic `mintDid`, privacy-first DDO
      builder (checksummed `files`), Aquarius `publishMetadata` that never
      throws when disabled/unconfigured.
- [x] T007 Unit tests `ocean.service.spec.ts`.

## Phase 4: Marketplace service + controller
- [x] T008 `marketplace.service.ts` — consent (audited), dataset CRUD
      (audited), privacy-guarded publish, revoke; aggregate SQL restricted to
      the consenting cohort with allowlisted filters.
- [x] T009 Unit tests `marketplace.service.spec.ts`.
- [x] T010 Controller (`/data-marketplace/*`) + module + barrel + registration
      in `app.module.ts`; admin routes behind `@Roles(Role.ADMIN)`.

## Phase 5: Admin AI benchmark
- [x] T011 `benchmark.service.ts` — two-window comparison, pure score +
      report, AI narrative with deterministic fallback; list/get.
- [x] T012 Backend verify: `npm run build` ✅ · `npm test` ✅ (471 tests /
      59 suites) · `npx eslint "src/**/*.ts"` ✅ (0 errors).

## Phase 6: Frontend
- [x] T013 `types/index.ts` + `config/api.ts` + `services/dataMarketplace.ts`.
- [x] T014 `AdminPage.tsx` — Data & Benchmarks tab (benchmark runs + dataset
      management with publish/revoke/delete and privacy report).
- [x] T015 `AccountSettingsPage.tsx` — Data & Privacy consent toggle.
- [x] T016 Locale keys in all 15 locale files (`admin.tab.*`,
      `admin.benchmarks.*`, `admin.datasets.*`, `accountSettingsPage.*`).
- [x] T017 Frontend verify: `tsc -b --noEmit` ✅ · `npm run lint` ✅ (0 errors)
      · `npm test` ✅ (9 tests).

## Phase 7: Docs & status
- [x] T018 `docs/getting-started/configuration.md` — Ocean env vars.
- [x] T019 `IMPLEMENTATION_STATUS.md` + `CHANGELOG.md` + `specs/README.md`
      updated; tasks checked off.
