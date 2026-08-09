# Tasks: Study RPG Integrity (F2W Meritocracy & Anti-Cheese)

**Input**: spec.md (US1–US5), plan.md.

**Prerequisites**: spec.md, plan.md. Phase 9 (Hardening) green (build + tests).

## Phase 1: Schema & foundation
- [x] T001 Migration `backend/migrations/028_study_integrity.sql` —
      `campfire_reflections` table + `game_config` seed `rpg.integrity`
      (reward math, rate limits, focus caps, campfire thresholds). Unique
      prefix 028, ordered after 027.
- [x] T002 `integrity` module scaffold — `integrity-config.ts`, `index.ts`,
      registration in `app.module.ts`.

## Phase 2: Pure math (unit-testable)
- [x] T003 `integrity/reward-curve.ts` — accuracy/focus/difficulty factors +
      campfire multiplier + `computeReward`.
- [x] T004 `integrity/behavior-guard.ts` — rate limit, answer-time sanity,
      focus-session verification.
- [x] T005 Unit tests `reward-curve.spec.ts`, `behavior-guard.spec.ts`.

## Phase 3: Campfire loop (US5)
- [x] T006 `integrity/campfire.service.ts` — start/submit/status, AI tutor
      question + depth grading, lexical fallback, daily cap 3, idempotent.
- [x] T007 `integrity/campfire.controller.ts` + DTOs.
- [x] T008 `campfire.service.spec.ts` (mock db/AI, fallback, cap).

## Phase 4: Wire anti-cheese into reward paths (US1–US3)
- [x] T009 Focus sessions (FR-004) — server clock only, engagement
      verification, daily cap, unverified throttling.
- [x] T010 Quiz (FR-005) — accuracy-scaled XP + STP ≥90%, attempt rate limit,
      min time-per-question, mastery-oriented notifications.
- [x] T011 Exam-clone (FR-006) — accuracy-scaled XP + STP ≥80%, per-day cap,
      min time-per-question.
- [x] T012 Teach-back (FR-007) — level-aware XP, STP ≥70, min explanation
      length.
- [x] T013 Battles (FR-008) — integrity multiplier on claim; exam-boss gate.

## Phase 5: Frontend re-framing (US4, US5)
- [x] T014 `services/studyIntegrity.ts` + types.
- [x] T015 `components/rpg/CampfireReflectionModal.tsx`.
- [x] T016 Integrate into `StudySessionPage` + `RpgPage`.
- [x] T017 Locale keys (campfire/integrity + reframed rpg) in all 15 files.

## Phase 6: Verify & ship
- [x] T018 Backend build + `npm test`; frontend `tsc -b --noEmit` + lint.
- [x] T019 `IMPLEMENTATION_STATUS.md` + `CHANGELOG.md` + `specs/README.md`
      updated; tasks checked off.
