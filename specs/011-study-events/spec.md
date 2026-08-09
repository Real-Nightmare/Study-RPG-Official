# Feature Specification: Study RPG Events

**Feature Branch**: `011-study-events`

**Created**: 2026-08-06

**Status**: Draft

**Input**: Authorized from the owner's master prompt PDF Phase 7 (Events, §25–§30) and
`docs/implementation/MASTER_PLAN.md` §4: scheduler with always-active fallback, data-driven
quests, StudyPass (14 levels, 1750 EXP), Free/Gold tracks (1500 SLC), the Abstracted event
(unabstracting, Abstracted Errors, Limbo), and the Great Extinction event (targets + Extinction
Sigils). Reuses the faction monthly-IST settlement machinery already shipped in the community track.

## User Scenarios & Testing

### User Story 1 — Always-active event scheduler with Study Sprint fallback (Priority: P1)

One event is always active. Events are scheduled with start/end/grace/claim-deadline; when the
current event ends and nothing else is scheduled, the system automatically activates the safe
**Study Sprint** fallback event and warns administrators before it happens. A Postgres advisory
lock guarantees two processes can never start the same event twice.

**Why this priority**: The PDF §25 mandates "one event must always be active"; everything else
(StudyPass, quests, items) hangs off the current event.

**Independent Test**: With an expired event and no scheduled successor, resolving the active event
creates Study Sprint, notifies admins, and is idempotent under concurrent calls.

**Acceptance Scenarios**:

1. **Given** a scheduled event has started, **When** the active event is resolved,
   **Then** it transitions to `active` and is returned as the current event.
2. **Given** an event's end + grace period has passed, **When** the active event is resolved,
   **Then** it is marked `ended` (claim deadline expired).
3. **Given** no active event and no future scheduled event, **When** the active event is resolved,
   **Then** a `study-sprint` fallback event is created and activated atomically, and every admin
   receives a warning notification.
4. **Given** two processes resolve concurrently, **When** both call the resolver,
   **Then** only one Study Sprint event is ever created (advisory lock).

---

### User Story 2 — StudyPass with 14 levels and event EXP (Priority: P1)

Every normal event carries a StudyPass of 14 levels with cumulative EXP thresholds
0/100/200/300/400/550/700/900/1100/1300/1450/1550/1650/1750. Event EXP is tracked **separately**
from player XP and accrues only from real study activity (tasks completed, focus minutes, quizzes,
puzzles, battles won).

**Why this priority**: StudyPass is the heartbeat of every event and must be gated on studying
(constitution: study-first).

**Independent Test**: Accrue event EXP via study activities and verify the level/claimable-levels
computation against the 14 thresholds.

**Acceptance Scenarios**:

1. **Given** a user completes a study task during an active event, **When** the activity is
   recorded, **Then** the user's event EXP increases by the configured amount for that activity.
2. **Given** event EXP reaches 1750, **When** levels are computed, **Then** the user is at level 14
   (the max) and no further levels exist.
3. **Given** a user earns EXP outside any active event, **When** the activity is recorded,
   **Then** no event EXP is granted (no phantom accrual).

---

### User Story 3 — Free and Gold tracks (Priority: P1)

Each event offers a Free Pass and a Gold Pass (1500 SLC, purchased separately per event, never with
real money). A player uses exactly one track; the choice locks before the first reward claim; Gold
players cannot claim Free rewards and vice-versa; no level may be claimed twice.

**Why this priority**: Track integrity is the monetisation-by-studying core of the event system and
the PDF explicitly tests mutual exclusivity.

**Independent Test**: Purchase Gold, lock track, claim level rewards, and verify cross-track and
double-claim rejections.

**Acceptance Scenarios**:

1. **Given** a user has 1500+ SLC, **When** they purchase the Gold Pass,
   **Then** 1500 SLC is debited (idempotently), `track=gold` is set, and the choice is locked.
2. **Given** a user's track is locked to Gold, **When** they attempt to claim a Free-track reward,
   **Then** it is rejected; Free players cannot claim Gold rewards.
3. **Given** a level reward was already claimed, **When** the same claim is attempted again,
   **Then** it is rejected (no double claiming).
4. **Given** a user claims any reward, **When** they attempt to switch tracks,
   **Then** the switch is rejected (choice locks before the first reward claim).

---

### User Story 4 — Data-driven quests (daily / weekly / study / puzzle) (Priority: P1)

Events ship data-driven quests in four categories (Daily, Weekly, Study, Puzzle). Quests track
progress from real study activity, reset per period (day/week), and grant configurable rewards
(STP, event EXP, event items) once, on claim.

**Why this priority**: Quests are the daily study-loop driver and reuse the same activity feed as
StudyPass.

**Independent Test**: Seed a daily and a weekly quest, drive progress through study activities,
verify completion + single claim + period reset.

**Acceptance Scenarios**:

1. **Given** a daily quest targeting 3 completed tasks, **When** the user completes 3 tasks today,
   **Then** the quest reaches its target and can be claimed once for its rewards.
2. **Given** a claimed quest from a previous period, **When** a new day starts,
   **Then** progress starts fresh for the new period key.
3. **Given** a quest's objective type is `consume_sigil`, **When** the user presents an Extinction
   Sigil, **Then** one sigil is consumed and the quest completes (a Sigil can satisfy selected
   event objectives — §29.1).

---

### User Story 5 — Abstracted event: unabstracting, Abstracted Errors, Limbo (Priority: P2)

The first event, **Abstracted**, introduces Abstracted cards (an original third ability —
the 40-Mana Abstracted ability — reacting to battle conditions). Unabstracting an eligible card is
irreversible: the instance converts to a configured Legendary result, grants 1 **Abstracted Error**
and 500 STP, updates supply, and writes economy + card audit entries (reason required). Seven
Abstracted Errors redeem **Limbo** — a unique untradeable Legendary reward.

**Why this priority**: The Abstracted event is the showcase event with the final untradeable
Legendary rewards the PDF's DoD requires to work.

**Independent Test**: Unabstract with confirmation, verify the Legendary instance + Error + 500 STP
+ audit rows + supply updates, then redeem 7 Errors for Limbo.

**Acceptance Scenarios**:

1. **Given** an owned Abstracted instance, **When** the user confirms unabstracting,
   **Then** the instance is retired (`unabstracted`), a configured Legendary result is granted,
   1 Abstracted Error and 500 STP are awarded, supply is updated, and audited rows exist.
2. **Given** a user without confirmation, **When** they attempt to unabstract,
   **Then** it is rejected (explicit confirmation required — irreversible).
3. **Given** a user holds 7 Abstracted Errors, **When** they redeem Limbo,
   **Then** 7 Errors are consumed and the untradeable Limbo Legendary is granted (once).

---

### User Story 6 — Great Extinction: targets and Extinction Sigils (Priority: P2)

The second event, **The Great Extinction**, targets exactly ten active card definitions
(5 Common-to-Rare + 5 weaker/underused Legendaries). Burning a targeted card is strongly encouraged
but never literally unavoidable: players can earn a **tradeable Extinction Sigil** by burning a
targeted card, completing a difficult study quest, contributing to a global milestone, or receiving
one from a friend — and a Sigil can satisfy a preserve-a-card objective. Final event reward cards
remain untradeable.

**Why this priority**: It closes the economy loop (burning/extinction) with a player-agency
safety valve, exactly as the PDF specifies.

**Independent Test**: Verify the 10-target selection (5/5 split), sigil grants on targeted burns and
milestones, sigil transfer between friends, and sigil-objective completion.

**Acceptance Scenarios**:

1. **Given** the extinction event config, **When** targets are (re)seeded,
   **Then** exactly 10 active definitions are targeted — 5 Common-to-Rare and 5 underused
   Legendaries by official value.
2. **Given** a user burns a targeted card, **When** the removal is recorded,
   **Then** they receive 1 Extinction Sigil and the global milestone progress increments.
3. **Given** the global burn milestone reaches its target, **When** a user claims the milestone,
   **Then** they receive 1 Extinction Sigil once.
4. **Given** a user and a friend, **When** the user transfers a Sigil,
   **Then** ownership moves (quantity decremented/incremented) and the transfer is logged.
5. **Given** a preserve-a-card quest, **When** the user presents a Sigil,
   **Then** the quest completes and the targeted card is NOT required to be burned.

---

### Edge Cases

- Event EXP and quest progress with **no active event** are no-ops.
- Two concurrent resolver calls must not double-create Study Sprint (advisory lock).
- Gold purchase with insufficient SLC is rejected; double Gold purchase is idempotent.
- Claiming a reward for a level above the current level is rejected.
- Unabstracting a card that is not an Abstracted instance is rejected; unabstracting twice is
  rejected (instance already retired).
- Limbo redemption without 7 Errors is rejected; redeeming twice is rejected.
- Sigil transfer with insufficient quantity or to a non-friend is rejected.
- A quest that is not active (outside its window) records no progress.

## Requirements

### Functional Requirements

- **FR-001**: Exactly one event MUST be active at all times; when no scheduled event follows an
  ended event, a configurable **Study Sprint** fallback MUST activate automatically and admins
  MUST be warned first.
- **FR-002**: Event activation MUST be guarded by a Postgres advisory lock so two processes never
  start the same event twice.
- **FR-003**: StudyPass MUST have 14 levels with cumulative thresholds
  0/100/200/300/400/550/700/900/1100/1300/1450/1550/1650/1750; event EXP MUST be stored separately
  from player XP and MUST accrue only from study activities recorded during an active event.
- **FR-004**: Events MUST offer Free and Gold tracks; Gold MUST cost 1500 SLC (configurable, never
  real money), be purchased per event, lock before the first reward claim, and be mutually
  exclusive — Gold players MUST NOT claim Free rewards and vice-versa, and no level MUST be
  claimable twice.
- **FR-005**: Quests MUST be data-driven with categories daily/weekly/study/puzzle, period-aware
  progress (day/week keys), configurable rewards, and single-claim semantics.
- **FR-006**: Abstracted cards MUST carry an original 40-Mana Abstracted ability (data-driven);
  unabstracting MUST be irreversible, require explicit confirmation, produce a configured Legendary
  result, grant 1 Abstracted Error + 500 STP, update supply, and write audited entries with a
  reason.
- **FR-007**: Seven Abstracted Errors MUST redeem the Limbo reward exactly once.
- **FR-008**: The Great Extinction event MUST target exactly 10 active definitions (default 5
  Common-to-Rare + 5 underused Legendaries); burning a targeted card MUST grant an Extinction Sigil
  and advance a global milestone; Sigils MUST be transferable between friends and consumable to
  satisfy a preserve-a-card quest objective.
- **FR-009**: Event rewards (STP via the wallet ledger, event items, event cards via the card
  service) MUST be idempotent — no double-granting under retries.
- **FR-010**: All event configuration MUST live in `game_config` (`rpg.events`) with code defaults
  so the module always has a working configuration.
- **FR-011**: Study-first: every event reward MUST be gated on recorded study activity with
  anti-farming caps; the student dashboard's `hide-game-stats` toggle stays authoritative.

### Key Entities

- **Event**: scheduled window (start/end/grace/claim deadline), story, status, kind (normal /
  fallback), config (extinction targets, shop, quests).
- **UserEventState**: per-user per-event StudyPass state — track (free/gold), track lock, event
  EXP, claimed levels, gold purchase time.
- **Quest / UserQuest**: data-driven objectives (type + target + period) with per-period user
  progress and one-shot claims.
- **EventItem / UserEventItem**: Abstracted Errors and Extinction Sigils (counted inventory).
- **AbstractedInstance**: card instance bound to the Abstracted event with its configured
  Legendary result; unabstracted/retired markers.
- **EventExtinctionTarget**: the (up to) 10 targeted card definitions for the Great Extinction.
- **EventGlobalMilestone**: global burn objectives with per-user one-shot sigil claims.

## Success Criteria

### Measurable Outcomes

- **SC-001**: At any moment, `GET /events/current` returns an active event (never empty after the
  first boot) — verified by tests driving the scheduler.
- **SC-002**: Concurrent `ensureActiveEvent` calls never produce duplicate fallback events.
- **SC-003**: StudyPass level 14 is reachable only at 1750 event EXP; claim-level math matches the
  published thresholds exactly.
- **SC-004**: No double claims, no cross-track claims, no double Gold purchases (idempotency keys).
- **SC-005**: Study activity hooks (tasks, focus, quizzes, puzzles, battles) accrue event EXP and
  quest progress only during active events.
- **SC-006**: Unabstract and Limbo flows are irreversible, audited, and grant exactly the
  configured rewards once.
- **SC-007**: The Great Extinction targets exactly 10 definitions with the 5/5 default split and
  Sigil earning/preservation works end-to-end.

## Assumptions

- Loot-box rewards are implemented as a minimal weighted card grant (odds published in the API
  payload); the full loot-box economy (Phase 4 deferred slice) is out of scope here.
- Sigil "trading with another player" is implemented as a direct transfer between friends (a
  dedicated item marketplace is out of scope).
- "Epic" rewards from the PDF's Abstracted tracks map onto our three rarities
  (common/rare/legendary) — epic-chance boxes are weighted rare/legendary grants.
- The Abstracted event is seeded to start at migration time and run for a configurable duration;
  future events (incl. The Great Extinction) are scheduled by admins via the events API.
- Monthly faction settlements (already shipped) remain the mechanism for recurring event rewards;
  events reference factions only via existing faction/programme hooks.
