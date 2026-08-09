# Tasks: Study RPG Events (PDF Phase 7)

**Input**: spec.md (US1–US6), plan.md.

**Prerequisites**: spec.md, plan.md. PDF Phase 6 (Economy) green (build + tests).

## Phase 1: Schema & config (Foundational — blocks all stories)

- [ ] T001 Write migration `backend/migrations/025_study_events.sql` (events,
      user_event_state, quests, user_quests, event_items, user_event_items,
      abstracted_instances, event_extinction_targets, event_global_milestones,
      user_milestone_claims; `game_config` seed `rpg.events`; seed Abstracted event +
      quests + items + targets). Unique prefix 025, ordered after 024.
- [ ] T002 Create `backend/src/modules/events/events-config.ts` — `EventsConfig` interface +
      `DEFAULT_EVENTS_CONFIG` + `mergeEventsConfig` (mirrors `economy-config.ts`).

## Phase 2: Pure modules (unit-testable core)

- [ ] T003 `backend/src/modules/events/study-pass.ts` — 14 thresholds, levelForExp,
      claimableLevels, reward resolution for free/gold tracks.
- [ ] T004 `backend/src/modules/events/event-scheduler.ts` — status transitions +
      fallback decision.
- [ ] T005 `backend/src/modules/events/quest-rules.ts` — IST day/week period keys,
      progressDelta, completion.
- [ ] T006 `backend/src/modules/events/loot-boxes.ts` — weighted rarity pick with
      published odds (seeded).
- [ ] T007 Unit tests: `study-pass.spec.ts`, `event-scheduler.spec.ts`,
      `quest-rules.spec.ts`, `loot-boxes.spec.ts`.

## Phase 3: Services (US1 — scheduler & StudyPass)

- [ ] T008 [US1] `StudyEventsService.ensureActiveEvent(now?)` — lazy transitions,
      Study Sprint fallback under `pg_advisory_lock`, admin warning notification
      before activation; `getCurrentEvent`.
- [ ] T009 [US2] `StudyEventsService.recordStudyActivity(userId, {type, amount})` —
      event EXP upsert (idempotent per event+user) gated on active event.
- [ ] T010 [US3] StudyPass state: `studyPassState(userId)`, `purchaseGoldPass`
      (1500 SLC debit, idempotent), `lockTrack`, `claimLevel` (track exclusivity,
      lock-before-first-claim, no double claims).
- [ ] T011 `backend/src/modules/events/events.controller.ts` + `dto/` — current event,
      track, claim endpoints.
- [ ] T012 [US1–US3] `study-events.service.spec.ts` — scheduler fallback + advisory
      lock idempotency, EXP accrual, track purchase/lock, claims.

## Phase 4: Quests (US4)

- [ ] T013 [US4] `QuestsService` — list active quests for event, apply activity
      progress (period keys), `claim` (single-claim, rewards: STP/EXP/items).
- [ ] T014 [US4] Quests endpoints in `events.controller.ts` (list, claim) + spec
      tests in `quests.service.spec.ts`.

## Phase 5: Abstracted (US5)

- [ ] T015 [US5] `AbstractedService` — unabstract (retire instance, grant
      legendary_result_key, +1 abstracted_error, +500 STP, supply ledger update,
      AuditService entries with reason), Limbo redemption (7 errors → untradeable
      Limbo Legendary, once).
- [ ] T016 [US5] Unabstract + Limbo endpoints; `abstracted.service.spec.ts`.

## Phase 6: Great Extinction (US6)

- [ ] T017 [US6] `ExtinctionService` — seed 10 targets (5 common→rare by weakest
      value, 5 underused legendaries), milestone progress on targeted burns,
      sigil grants (burn / milestone claim / quest), friend transfer, sigil-objective
      quest completion.
- [ ] T018 [US6] Targets/milestones/sigil endpoints + `extinction.service.spec.ts`.

## Phase 7: Cards, loot boxes & hooks (cross-cutting)

- [ ] T019 `CardService.grantEventCard(userId, cardKey, source, opts)` —
      ensure-definition + instance insert in one transaction, untradeable support.
- [ ] T020 `CardService.openLootBox(userId, boxType)` — weighted grant via
      `loot-boxes.ts`, published odds.
- [ ] T021 Hook `recordStudyActivity` into `tasks.service.complete`,
      `focus-sessions.service.complete`, `puzzles.service` solve, `quiz.service`
      submitAttempt, `battle.service` victory branch.
- [ ] T022 Hook `ExtinctionService.onCardBurned` into `burner.service.burnCard`.
- [ ] T023 Register `EventsModule` (@Global) in `app.module.ts`; `index.ts` barrel.

## Phase 8: Frontend (all stories)

- [ ] T024 `frontend/src/config/api.ts` + `frontend/src/services/events.ts` +
      `frontend/src/types/index.ts` event types.
- [ ] T025 `frontend/src/pages/dashboard/EventsPage.tsx` — event banner, StudyPass
      progress + track picker + claims, quests, items/sigils, abstracted actions,
      extinction targets/milestones.
- [ ] T026 Route `/dashboard/events` in `App.tsx` + nav entry (`nav.events`) in
      `DashboardLayout.tsx`.
- [ ] T027 Add `events` locale namespace + `nav.events` to ALL 15 locale files.

## Phase 9: Verification & docs

- [ ] T028 Backend: `npm run build` + `npm test` (full suite) green.
- [ ] T029 Frontend: `npx tsc -b --noEmit` clean; `npm run lint` no new errors.
- [ ] T030 Update `IMPLEMENTATION_STATUS.md` (Phase 7 section), `MASTER_PLAN.md`
      §2/§4, `specs/README.md` (spec table + workflow status).
