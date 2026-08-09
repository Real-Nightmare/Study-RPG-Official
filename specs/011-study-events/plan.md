# Plan: Study RPG Events (PDF Phase 7)

**Prerequisites**: spec.md (user stories US1–US6), data-model (below), contracts (below).

## Design Overview

Phase 7 (master prompt §25–§30) is delivered as a new **Events** feature module
(`backend/src/modules/events/`) following the existing module conventions (raw SQL, dto/ +
service + controller + module + `index.ts` barrel, registration in `app.module.ts`). The module is
registered **`@Global()`** so the study-activity hook (`StudyEventsService.recordStudyActivity`) can
be injected into existing services (planner, focus-sessions, puzzles, quiz, battle, economy burner)
without introducing circular module imports — those modules never import Events; they consume the
globally-provided service.

### Architecture

```
┌─ EventsModule (@Global) ─────────────────────────────────────────────┐
│ providers:                                                           │
│  • StudyEventsService  — scheduler + current event + StudyPass +     │
│                          tracks + claims + event items (sigil)       │
│  • QuestsService       — data-driven quests, progress, claims        │
│  • AbstractedService   — unabstracting + Limbo                       │
│  • ExtinctionService   — target seeding, sigil grants, milestones    │
│ imports: RpgModule (WalletService, CardService), NotificationsModule,│
│          AdminModule (AuditService)                                  │
└──────────────────────────────────────────────────────────────────────┘
        ▲ consumed by (no import needed — @Global)
        │
  tasks.service · focus-sessions.service · puzzles.service ·
  quiz.service · battle.service · burner.service (burn → sigil)
```

### Pure modules (unit-tested, no DB)

- `study-pass.ts` — 14 level thresholds, `levelForExp`, `claimableLevels`, track lock rules,
  reward resolution for free/gold tracks from config.
- `event-scheduler.ts` — given events rows + now, decides `scheduled|active|ended` transitions and
  whether a fallback must be created.
- `quest-rules.ts` — period key computation (IST day `YYYY-MM-DD`, ISO week `YYYY-Www`),
  `progressDelta` for an activity against an objective, completion checks.
- `loot-boxes.ts` — weighted random card rarity pick with published odds (seeded RNG reuse).

### Data model (migration `025_study_events.sql`)

- `events` — slug (unique), name, story, kind (`normal|fallback`), starts_at/ends_at,
  grace_hours, claim_deadline, config JSONB, status.
- `user_event_state` — PK (user_id, event_id); track (`free|gold` nullable), track_locked,
  event_exp, claimed_levels JSONB, gold_paid_at.
- `quests` — event_id (nullable = evergreen), slug, category (`daily|weekly|study|puzzle`),
  title/story, objective JSONB `{type, activityType?, target, period?}`, rewards JSONB,
  window, period (`none|daily|weekly`), sort_order, active.
- `user_quests` — PK (user_id, quest_id, period_key) — period_key `''` for non-periodic.
- `event_items` — slug unique (`abstracted_error`, `extinction_sigil`), name, description,
  tradable, max_quantity nullable.
- `user_event_items` — PK (user_id, item_id), quantity.
- `abstracted_instances` — card_instance_id PK, event_id, legendary_result_key,
  unabstracted_at/unabstracted_by.
- `event_extinction_targets` — (event_id, card_key), target_order, reason.
- `event_global_milestones` — (event_id, slug unique), title, objective JSONB
  `{type:'targeted_burns', target}`, progress, completed_at, reward JSONB.
- `user_milestone_claims` — PK (user_id, milestone_id) — one-shot sigil claims.
- `game_config` seed `rpg.events` + event seeds (Abstracted active NOW→+30d, quests, items,
  StudyPass thresholds, free/gold tracks, loot-box weights, extinction targets 10/5-5).

### Study-activity feed

`StudyEventsService.recordStudyActivity(userId, { type, amount?, subject? })`:
1. Resolve the active event (lazy scheduler).
2. If none → no-op.
3. Add `expByActivity[type] × amount` to `user_event_state.event_exp` (upsert).
4. Update matching quest rows (`quest-rules.progressDelta`) with anti-farming caps.

Hook points (one line each, inside existing service methods):
- `tasks.service.complete` → `task_completed`
- `focus-sessions.service.complete` → `study_session` (amount = minutes)
- `puzzles.service.solve` → `puzzle_solved`
- `quiz.service.submitAttempt` → `quiz_attempt`
- `battle.service` victory branch → `battle_win` | `boss_win` (exam/world bosses)
- `burner.service.burnCard` (targeted card during extinction event) → sigil + milestone via
  `ExtinctionService.onCardBurned`

### API (contracts)

- `GET /events/current` — active event + StudyPass state + quests + items + odds
- `GET /events/:slug` — event detail + my state
- `POST /events/current/study-pass/track` `{ track: 'free'|'gold' }` — purchase/lock (idempotent)
- `POST /events/current/study-pass/claim` `{ level: number }` — claim level reward (idempotent)
- `GET /events/current/quests` · `POST /events/current/quests/:id/claim`
- `GET /events/current/items` · `POST /events/current/sigils/transfer` `{toUserId, quantity}`
- `POST /events/abstracted/unabstract` `{instanceId, confirm}` · `POST /events/abstracted/limbo`
- `GET /events/:slug/extinction/targets` · `POST /events/:slug/extinction/targets` (admin)
- `GET /events/:slug/milestones` · `POST /events/:slug/milestones/:id/claim`
- `POST /events` (admin create) · `POST /events/:id/activate` (admin)

### Frontend

- `config/api.ts` endpoints; `services/events.ts`; `types/index.ts` event types.
- `pages/dashboard/EventsPage.tsx` — current event banner + story, StudyPass progress bar with
  14 level pips, Free/Gold track picker (lock UI), claimable rewards, quest list with progress +
  claim, event items (Abstracted Errors / Sigils) with transfer + unabstract + Limbo actions,
  extinction targets + milestone progress. Route `/dashboard/events`, nav `nav.events`, locale
  namespace `events` in all 15 locales.

### Tests

Backend Jest unit tests: `study-pass.spec.ts`, `event-scheduler.spec.ts`, `quest-rules.spec.ts`,
`loot-boxes.spec.ts`, `study-events.service.spec.ts` (mocked db: scheduler + fallback + track +
claims), `quests.service.spec.ts`, `abstracted.service.spec.ts`, `extinction.service.spec.ts`.
Definition of Done: backend build + full suite green, frontend `tsc -b --noEmit` clean,
`IMPLEMENTATION_STATUS.md` + `MASTER_PLAN.md` + `specs/README.md` updated.
