# Plan: Study RPG Integrity (F2W Meritocracy & Anti-Cheese)

**Input**: `spec.md` (US1–US5, FR-001–FR-010).

**Prerequisites**: Phase 9 (Hardening, spec 013) green — build + tests.

## Strategy

Ship a new `integrity` module that owns **pure reward math** and **behaviour
guards** (unit-tested, no DB), plus a **CampfireService** (AI tutor reflection
with deterministic fallback). Then wire the guards into the existing reward
paths (focus-sessions, quiz, exam-clone, teach-back, battles) with minimal
surgical edits, keeping all existing endpoint signatures intact. Frontend gets a
campfire modal + reframed copy through the i18n layer. One migration seeds the
`campfire_reflections` table and `rpg.integrity` config.

## Phase 1 — Schema & foundation

- T001 `backend/migrations/028_study_integrity.sql` — `campfire_reflections`
  table (user, question, answer, depth_score, multiplier, context JSONB,
  day key, idempotency unique) + `game_config` seed `rpg.integrity`.
- T002 `integrity/` module scaffold: `integrity-config.ts` (config type + merge
  + defaults), `index.ts`, registered in `app.module.ts`.

## Phase 2 — Pure math (unit-tested)

- T003 `integrity/reward-curve.ts` — `accuracyFactor` (exponential on
  accuracy), `focusFactor` (consistency 0–1), `difficultyFactor` (easy/medium/
  hard/material size), `campfireMultiplier(depth)` (1.0–1.5), `computeReward`.
- T004 `integrity/behavior-guard.ts` — `rateLimited(windowEvents, max, windowMs)`
  sliding window, `answerTimeSanity(totalMs, count, minMsPerQuestion)`,
  `verifyFocusSession(claimed, elapsed, engagementCount)`.
- T005 Unit tests `reward-curve.spec.ts`, `behavior-guard.spec.ts`.

## Phase 3 — Campfire loop (US5, FR-009)

- T006 `integrity/campfire.service.ts` — `start(userId, ctx)` (AI tutor asks ONE
  targeted synthesis question from recent study context; deterministic fallback
  question), `submit(userId, id, answer)` (AI depth grading 0–100 with lexical
  fallback → multiplier 1.0–1.5), daily cap 3, idempotent per session/day,
  `latestMultiplier(userId)` for reward wiring.
- T007 `integrity/campfire.controller.ts` + DTOs — `GET /study-integrity/
  campfire`, `POST /study-integrity/campfire/:id/answer`, `GET /study-integrity/
  campfire/status`.
- T008 `campfire.service.spec.ts` (mock db + mock AI; fallback path; cap).

## Phase 4 — Wire anti-cheese into reward paths (US1–US3)

- T009 Focus sessions (FR-004): server-clock minutes only (drop client
  override), engagement verification (quiz/exam activity in window), daily
  minute cap, unverified → reduced event EXP.
- T010 Quiz (FR-005): accuracy-scaled XP via `PlayerService.addXp`, STP for
  ≥90% (daily-capped), per-hour attempt rate limit + min time-per-question,
  mastery-oriented notification copy.
- T011 Exam-clone (FR-006): accuracy-scaled XP + STP for ≥80% (daily-capped),
  per-day attempt cap, min time-per-question.
- T012 Teach-back (FR-007): XP through `PlayerService.addXp`, STP for ≥70,
  min explanation length (anti-slop).
- T013 Battles (FR-008): `claimRewards` applies rolling 7-day academic
  integrity multiplier; exam-world boss creation requires recent verified
  mastery.

## Phase 5 — Frontend re-framing (US4, US5)

- T014 `services/studyIntegrity.ts` + types (`campfire.ts`).
- T015 `components/rpg/CampfireReflectionModal.tsx` — reflection question,
  answer textarea, multiplier preview, mandatory-before-cash-in flow.
- T016 Integrate modal into `StudySessionPage` (complete → reflect) and
  `RpgPage` (post-battle "Reflect & Boost").
- T017 Locale pass: `campfire` + `integrity` namespaces + reframed `rpg`
  level-up strings in all 15 locale files.

## Phase 6 — Verify & ship

- T018 Backend build + `npm test`; frontend `tsc -b --noEmit` + `npm run lint`.
- T019 Update `IMPLEMENTATION_STATUS.md`, `CHANGELOG.md`, `specs/README.md`;
  mark `tasks.md` complete.
