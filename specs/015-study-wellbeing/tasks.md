# Tasks: Study RPG — Anti-Overstudy & Health-First Wellbeing

**Input**: spec.md (US1–US3), plan.md.

**Prerequisites**: spec.md, plan.md. Spec 014 (Integrity) green (build + tests).

## Phase 1: Schema & foundation
- [x] T001 Migration `backend/migrations/029_study_wellbeing.sql` —
      `game_config` seed `rpg.wellbeing` (daily focus optimum, decay slope,
      rest cooldown hours, night window, exhaustion threshold). Unique
      prefix 029, ordered after 028.
- [x] T002 `integrity-config.ts` — `wellbeing` config block (type + merge +
      defaults mirrored from the seed).

## Phase 2: Pure module (unit-tested)
- [x] T003 `integrity/overstudy.ts` — decay factor (exponential-ish with
      `wellbeingFloor`), rest-cooldown gate, IST night-rest guard,
      `evaluateStudyHealth` bands (fresh/focused/sustained/strained/
      exhausted) + dampening multiplier, `buildStudyHealthView` read model.
- [x] T004 Unit tests `overstudy.spec.ts` (decay curve, cooldown gate, night
      guard, band classification, view shape).

## Phase 3: Wire into services
- [x] T005 `FocusSessionsService` — start-gate checks (rest cooldown /
      exhausted / night-rest nudge), `complete` dampens via decay factor,
      `studyHealth` read model.
- [x] T006 `FocusSessionsController` — `GET /focus-sessions/study-health`;
      start DTO `ackNightRest`.
- [x] T007 `StudyEventsService.recordStudyActivity` — event EXP scaled by
      the overstudy decay factor.

## Phase 4: AI philosophy (US1)
- [x] T008 `ai/study-rpg-philosophy.ts` — canonical philosophy block +
      `studyRpgPhilosophy()` helper.
- [x] T009 Inject into `chat.service.ts` (assistant system prompt).
- [x] T010 Inject into `teach-back.service.ts` (Feynman evaluator).
- [x] T011 Inject into `campfire.service.ts` (tutor question + grading).
- [x] T012 Inject into `programmes.service.ts` (programme architect).
- [x] T013 Inject into `learning-paths.service.ts` (path coach).

## Phase 5: Frontend (US2, US3)
- [x] T014 `types/index.ts` + `services/studyTools.ts` + `api.ts` endpoint.
- [x] T015 `FocusSessionsPage.tsx` — study-health meter, start gates,
      night-rest nudge, dampened-reward notice.
- [x] T016 `wellbeing` locale namespace in all 15 locale files.

## Phase 6: Verify & ship
- [x] T017 Backend build + `npm test`; frontend `tsc -b --noEmit` + lint.
- [x] T018 `IMPLEMENTATION_STATUS.md` + `CHANGELOG.md` + `specs/README.md` +
      `docs/STUDY_RPG_PHILOSOPHY.md` updated; tasks checked off.
