# Plan: Study RPG — Anti-Overstudy & Health-First Wellbeing

**Input**: `spec.md` (US1–US3).

**Prerequisites**: Owner brief Integrity (spec 014) green — build + tests.

## Strategy

Two coordinated workstreams. **(1) The AI must speak the philosophy:** one
canonical, shared philosophy block (`ai/study-rpg-philosophy.ts`) injected into
every AI surface — chat assistant, teach-back evaluator, campfire tutor,
programme architect, and learning-path coach — so every agent refuses to
encourage cramming, steers tired/late-night students toward rest, and judges
depth over length. **(2) Anti-overstudy dampening:** a pure `integrity/
overstudy.ts` module computes a study-health state (daily focus decay,
rest-cooldown gate, night-rest guard, exhaustion band) with zero DB
dependencies, unit-tested; `FocusSessionsService` enforces it (start gates,
completion dampening, wellbeing read model) and `StudyEventsService` scales
event EXP by the overstudy factor. The frontend gets a study-health meter +
cooldown gate + night nudge on the focus page. One migration seeds
`rpg.wellbeing` config; one locale namespace (`wellbeing`) across all 15 files.

## Phase 1 — Schema & foundation

- T001 `backend/migrations/029_study_wellbeing.sql` — `game_config` seed
  `rpg.wellbeing` (daily focus optimum, decay slope, rest cooldown hours,
  night window, exhaustion threshold).
- T002 `integrity-config.ts` — `wellbeing` config block (type + merge +
  defaults mirrored from the migration seed).

## Phase 2 — Pure module (unit-tested)

- T003 `integrity/overstudy.ts` — `decayFactor(totalMinutes, optimum, slope)`
  (exponential-ish decay with a `wellbeingFloor`), `restCooldownInfo` (daily
  optimum reset, forced rest interval), `isNightRestHours` (IST, configurable
  window), `evaluateStudyHealth` → bands (fresh/focused/sustained/strained/
  exhausted) + dampening multiplier, `buildStudyHealthView` read model.
- T004 Unit tests `overstudy.spec.ts` (decay curve, cooldown gate, night
  guard, band classification, view shape).

## Phase 3 — Wire into services

- T005 `FocusSessionsService` — start-gate checks (rest cooldown active /
  exhausted / night-rest nudge), `complete` dampens XP/minutes via the decay
  factor, `studyHealth` endpoint returns the read model.
- T006 `FocusSessionsController` — `GET /focus-sessions/study-health`;
  start DTO accepts `ackNightRest` for the night nudge.
- T007 `StudyEventsService.recordStudyActivity` — event EXP scaled by the
  overstudy decay factor (real study is still rewarded, grinding is
  dampened).

## Phase 4 — AI philosophy (US1)

- T008 `ai/study-rpg-philosophy.ts` — canonical philosophy block (depth over
  length, mastery over memorisation, health-first anti-overstudy guardian,
  Free-to-Win, game-to-reality framing, honest evidence-based tone, Socratic
  style) + `studyRpgPhilosophy()` helper.
- T009 Inject into `chat.service.ts` (assistant system prompt).
- T010 Inject into `teach-back.service.ts` (Feynman evaluator).
- T011 Inject into `campfire.service.ts` (tutor question + grading).
- T012 Inject into `programmes.service.ts` (programme architect).
- T013 Inject into `learning-paths.service.ts` (path coach).

## Phase 5 — Frontend (US2, US3)

- T014 `types/index.ts` (`StudyHealthView`, `StudyHealthBand`, start-gate
  payload) + `services/studyTools.ts` (`getStudyHealth`, start ack flag) +
  `api.ts` endpoint.
- T015 `FocusSessionsPage.tsx` — study-health meter (band colour + label +
  multiplier), rest-cooldown / exhausted start gate with forced rest copy,
  night-rest nudge (ack to proceed), dampened-reward notice.
- T016 `wellbeing` locale namespace in all 15 locale files (band labels,
  gate copy, night nudge, philosophy-framed notices).

## Phase 6 — Verify & ship

- T017 Backend build + `npm test`; frontend `tsc -b --noEmit` + lint.
- T018 `IMPLEMENTATION_STATUS.md` + `CHANGELOG.md` + `specs/README.md` +
  `docs/STUDY_RPG_PHILOSOPHY.md` updated; tasks checked off.
