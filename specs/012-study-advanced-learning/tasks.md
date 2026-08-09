# Tasks: Study RPG Advanced Learning (PDF Phase 8)

**Input**: spec.md (US1–US4), plan.md.

**Prerequisites**: spec.md, plan.md. Phase 7 (Events) green (build + tests).

## Phase 1: Schema (Foundational)

- [x] T001 Write migration `backend/migrations/026_study_advanced.sql` —
      `learning_paths.programme_id` FK + index; `programme_templates` table;
      `programmes.review_history` JSONB; seed 3 templates (Revision Centre,
      Competency Based Testing, Exam Sprint with concrete outlines). Unique
      prefix 026, ordered after 025.

## Phase 2: Pure helpers (unit-testable)

- [x] T002 `backend/src/modules/programmes/review-queue.ts` — predicate
      `needsReview(review)` (no verdict | score < 50 | reviewedBy !== admin)
      and `reviewHistoryAppend(history, event)` (cap 50).
- [x] T003 Unit tests `review-queue.spec.ts` (predicate matrix + cap).

## Phase 3: Templates (US2)

- [x] T004 [US2] `ProgrammesService` template methods — `listTemplates`,
      `createTemplate(actorId, dto)` (audited), `updateTemplate`, `deleteTemplate`
      (audited reason).
- [x] T005 [US2] `suggestFromTemplate(userId, templateId, opts)` — AI build using
      the template outline; fallback to safe default outline on AI failure;
      same building → active lifecycle as `suggest`.
- [x] T006 [US2] Template endpoints in `programmes.controller.ts` (list public;
      create/update/delete admin with reason).
- [x] T007 [US2] `programmes.service.spec.ts` — template CRUD + audit rows,
      suggest-from-template success + AI-failure fallback.

## Phase 4: Batch review + history (US3)

- [x] T008 [US3] `ProgrammesService.reviewQueue()` — programmes without a verdict
      or with score < 50 (uses `review-queue.ts`).
- [x] T009 [US3] `ProgrammesService.batchReview(actorId, items)` — per item
      verdict/reason/score, audited, appends to `review_history`; empty list →
      400; unknown programme → 404.
- [x] T010 [US3] `adminReview` + `reviewWithAi` now append review events to
      `review_history` (capped).
- [x] T011 [US3] Endpoints `GET /programmes/review-queue` + `POST /programmes/batch-review`
      (admin) in the controller.
- [x] T012 [US3] spec tests — queue filter, batch review + audit + history, empty
      batch 400.

## Phase 5: Programme → Learning Path (US1, US4)

- [x] T013 [US1] `LearningPathsService.generateFromProgramme(userId, programmeId)`
      — verify programme active; AI prompt from objectives/milestones → ordered
      steps (study/quiz/practice/review, estimatedMinutes); insert with
      `programme_id`; returns path.
- [x] T014 [US4] Path review — AI reviews the generated path (`review` JSONB with
      verdict/score/reasons + `needsRegeneration` when score < 60); AI failure →
      save without review, flag false (never blocks studying).
- [x] T015 [US1] `findById`/`findByUser` map `programme_id` + programme name.
- [x] T016 [US1] Controller `POST /programmes/:id/learning-path` (members; uses
      LearningPathsService) — needs ProgrammesModule → LearningPathsModule import
      wiring in `learning-paths.module.ts`.
- [x] T017 [US1] spec tests — from-programme builds linked path; non-active
      programme rejected; review/needsRegeneration present.

## Phase 6: Frontend (all stories)

- [x] T018 `frontend/src/config/api.ts` + `frontend/src/services/programmes.ts`
      (templates, suggest-from-template, review-queue, batch-review) +
      `frontend/src/services/learningPaths.ts` (`fromProgramme`).
- [x] T019 `frontend/src/types/index.ts` — `ProgrammeTemplate`, `ProgrammeReviewEvent`,
      `ReviewQueueItem`, `LearningPath` extensions (programmeId, programmeName,
      review, needsRegeneration).
- [x] T020 `ProgrammesPage` — templates browse/instantiate strip, admin template
      manager, admin review queue tab with batch review, review history in detail,
      "Start learning path" on active programmes.
- [x] T021 `LearningPathsPage` — programme badge on linked paths, regenerate CTA on
      needsRegeneration.
- [x] T022 Locales — extend `programmes` + `learningPaths` namespaces in ALL 15
      locale files.

## Phase 7: Verification & docs

- [x] T023 Backend: `npm run build` + `npm test` green.
- [x] T024 Frontend: `npx tsc -b --noEmit` clean; `npm run lint` no new errors.
- [x] T025 Update `IMPLEMENTATION_STATUS.md` (Phase 8 section), `MASTER_PLAN.md`
      §2/§4, `specs/README.md`.
