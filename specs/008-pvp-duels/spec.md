# Feature Specification: PvP Duels

**Feature Branch**: `008-pvp-duels`

**Created**: 2026-08-06

**Status**: Implemented

**Input**: Migrated from OpenSpec spec `openspec/specs/pvp-duels/spec.md` (PDF Phase 5 — Battles: PvP).

## User Scenarios & Testing

### User Story 1 — Async seeker duels (Priority: P1)

A player challenges another player by email, or opts into battle-rating matchmaking; a duel
snapshots each side's active deck at challenge time, and gives each side one battle against a ghost
avatar of the opponent's deck snapshot.

**Why this priority**: Async play removes real-time scheduling friction and is the core PvP loop.

**Independent Test**: Create a duel by email and by matchmaking; verify `challenged` status, deck
snapshots, opponent notification, and rejection when no eligible opponent exists.

**Acceptance Scenarios**:

1. **Given** a player creates a duel with a valid opponent email, **When** the duel is created,
   **Then** it is created in `challenged` status with both deck snapshots stored and the opponent
   is notified.
2. **Given** a player creates a duel without an opponent email, **When** matchmaking runs,
   **Then** an eligible opponent (≠ self, active validated deck) within the rating window is
   chosen, widening if needed, and a duel is created.
3. **Given** no player with an active validated deck exists as an opponent, **When** the duel is
   created, **Then** the create request is rejected with a conflict error.

---

### User Story 2 — Ghost battle (Priority: P1)

Each side of a duel plays one battle against a ghost avatar whose HP scales with the opponent
deck's rare/legendary count and whose attack derives from the deck's card damage, run through the
existing deterministic engine with replayable logs, linked to the duel.

**Acceptance Scenarios**:

1. **Given** a player starts their duel battle, **When** the ghost is created,
   **Then** the opponent's deck snapshot is converted into ghost HP (base + per-rare +
   per-legendary) and attack (base + floor of total damage / deck size).
2. **Given** a PvP battle is created, **When** it is stored, **Then** it is stored in `battles`
   with `pvp_duel_id` set, world `pvp`, and the ghost as monster.

---

### User Story 3 — Settlement and Elo rating (Priority: P1)

A settled duel produces a winner deterministically — decisive win, else higher remaining HP%, else
fewer turns, else a draw — and applies Elo battle-rating deltas (configurable K, floor 0) to both
players inside a single locked, idempotent transaction.

**Acceptance Scenarios**:

1. **Given** one side wins their battle and the other loses, **When** the duel settles,
   **Then** the winning side wins the duel and both ratings update by the Elo delta.
2. **Given** both sides have the same win/loss outcome, **When** the duel settles,
   **Then** the side with the higher remaining HP% wins, ties broken by fewer turns, otherwise the
   duel is a draw with no rating change.
3. **Given** a duel expires and only one side has played, **When** the duel settles,
   **Then** the played side wins the duel by default.
4. **Given** a settled duel is read or listed again, **When** settlement is re-attempted,
   **Then** rating and rewards are not applied twice.

---

### User Story 4 — PvP rewards with anti-farming (Priority: P2)

The duel winner earns configurable STP and XP, the loser consolation XP, granted idempotently
through the wallet ledger and XP paths, subject to a daily PvP reward limit from `game_config`.

**Acceptance Scenarios**:

1. **Given** a duel settles, **When** rewards are granted, **Then** the winner receives STP (ledger
   `pvp_win`, key `pvp_win:<duelId>`) and XP, and the loser receives consolation XP.
2. **Given** the daily PvP reward limit is reached, **When** further duels settle,
   **Then** they grant no STP/XP but the duel still settles and ratings still update.

---

### User Story 5 — Battle-rating leaderboard (Priority: P2)

The system exposes a battle-rating leaderboard of players.

**Acceptance Scenarios**:

1. **Given** the leaderboard is requested, **When** it is built, **Then** players are returned
   ordered by `battle_rating` descending with their rating and level.

---

### Edge Cases

- Challenge to a user who has no active validated deck.
- Both players never play before expiry (both sides unplayed — settled as no-contest/draw).
- Duplicate challenge to the same opponent while a duel is pending.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST support async duels between two players, snapshotting each side's
  active deck at challenge time, giving each side one battle against a ghost of the opponent's
  snapshot, and settling once both battles are terminal or the duel expires.
- **FR-002**: Ghost avatars MUST derive HP from the opponent deck's rare/legendary count and attack
  from its card damage, and MUST run through the deterministic server-authoritative engine with
  replayable logs linked to the duel.
- **FR-003**: Settlement MUST determine a winner by decisive win → higher remaining HP% → fewer
  turns → draw, and MUST apply Elo deltas (configurable K, floor 0) inside a single locked,
  idempotent transaction.
- **FR-004**: Winner/loser rewards MUST be granted idempotently through the wallet ledger and XP
  paths with a daily PvP limit from `game_config`.
- **FR-005**: A battle-rating leaderboard MUST be exposed, ordered by `battle_rating` descending
  with rating and level.

### Key Entities

- **PvpDuel**: challenge, deck snapshots, battles, expiry, settlement.
- **GhostAvatar**: derived from the opponent's deck snapshot.
- **BattleRating**: Elo rating with floor, updated on settlement.
- **Leaderboard**: rating-ordered player list.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Two players can complete a fair, fully replayable async duel without being online
  simultaneously.
- **SC-002**: Elo updates are deterministic, idempotent, and never double-applied.
- **SC-003**: Daily PvP reward caps hold; ratings still move after the cap.
- **SC-004**: The leaderboard reflects settled duels accurately.
- **SC-005**: Duel outcomes are reproducible from stored inputs and seeds.

## Assumptions

- Email-challenge requires the opponent to have an account; username lookup is out of scope for v1.
- Matchmaking window widening is bounded to avoid pairing far-away ratings indefinitely.
- Duels have no entry fee (no STP stake) in v1.
