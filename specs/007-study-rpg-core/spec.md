# Feature Specification: Study RPG Core

**Feature Branch**: `007-study-rpg-core`

**Created**: 2026-08-06

**Status**: Implemented

**Input**: Migrated from OpenSpec spec `openspec/specs/study-rpg-core/spec.md` (PDF Phase 4 — Game foundation).

## User Scenarios & Testing

### User Story 1 — Config-driven player stats and progression (Priority: P1)

Player progression is config-driven: `game_config` holds level thresholds and battle defaults
(max HP 100, max mana 100, deck size 5, ability mana costs), and `player_profiles` tracks XP,
level, STP, battle rating, study streak, puzzle streak, and Player XP / Event EXP values.

**Why this priority**: Tunable game math without code deploys is the foundation every other RPG
feature builds on.

**Independent Test**: Raise XP past a threshold and verify the level derives from config; change a
config default and verify battles read the new value.

**Acceptance Scenarios**:

1. **Given** a player's XP crosses the configured threshold for the next level,
   **When** the profile is evaluated, **Then** their level increases and the profile reflects it.
2. **Given** battle defaults are read (HP, mana, deck size, mana costs), **When** a battle starts,
   **Then** they come from `game_config` rather than scattered code constants.

---

### User Story 2 — Immutable STP wallet ledger (Priority: P1)

Every STP balance mutation appends an immutable `wallet_ledger` entry with transaction id, user,
currency, amount, balances before/after, type, reason, related entity, idempotency key, and
timestamp; balances use integer arithmetic, never go negative, and are locked during mutation.

**Why this priority**: The wallet is the economy's single currency spine — every downstream phase
(duels, marketplace, factions) trusts it.

**Independent Test**: Earn/spend STP and verify ledger rows with before/after balances; attempt an
over-spend and verify rejection; retry a reward claim with the same idempotency key and verify it
applies once.

**Acceptance Scenarios**:

1. **Given** STP is earned or spent, **When** the mutation commits, **Then** a ledger row records
   it with before/after balances.
2. **Given** a spend would exceed the balance, **When** the mutation is attempted,
   **Then** it is rejected and the balance is unchanged.
3. **Given** a reward claim is retried with the same idempotency key, **When** it is replayed,
   **Then** it is applied only once.

---

### User Story 3 — Original cards and restricted decks (Priority: P2)

Card definitions are data-driven (key, name, category, mana cost, damage, healing, duration,
cooldown, target, stack policy, status effect, trigger, restrictions, balance version) with
original content only; players own card instances; decks contain exactly 5 cards and are validated
against restricted-ability rules (one Poison, one Decay, one Shield, one per other restricted key)
on save and before battle.

**Acceptance Scenarios**:

1. **Given** a deck is saved or a battle is created, **When** validation runs,
   **Then** restricted-ability rules are enforced and invalid decks are rejected or marked invalid.
2. **Given** a new player opens the RPG, **When** they claim their starter pack,
   **Then** they receive an original starter card set as owned instances.

---

### User Story 4 — Deterministic server-authoritative battle engine (Priority: P1)

Battles resolve server-side by a deterministic engine with an injectable random seed; the server is
authoritative and stores a complete replayable `battle_log`, implementing the §13.1 turn flow
(shields for the first two turns, status processing, the 5-question mana-recovery study quiz
(+4 mana each, max 20, no repeats), the one-turn damage challenge (+10 immediate damage when all 5
correct), mana payment, damage calculation, defeat/reward checks, end-of-turn effects); damage-over-
time is logged separately from immediate damage.

**Acceptance Scenarios**:

1. **Given** the same battle inputs and seed are applied twice, **When** both battles run,
   **Then** the outcome and log are identical.
2. **Given** a player answers the 5-question mana quiz correctly, **When** mana is restored,
   **Then** mana restores by 4 per correct answer up to the configured maximum and cap.
3. **Given** a status like Poison deals damage, **When** it is logged,
   **Then** it is recorded separately from the immediate attack damage.

---

### User Story 5 — Battle rewards with anti-farming limits (Priority: P2)

Battle rewards (XP and STP) are granted on completion with daily reward limits; rewards are
claimable idempotently; study tools remain usable without claiming game rewards.

**Acceptance Scenarios**:

1. **Given** the daily reward limit for battles is reached, **When** further battles complete,
   **Then** they grant no game reward (or reduced reward) but still complete normally.
2. **Given** a reward claim repeats with the same idempotency key, **When** it is replayed,
   **Then** the reward is not granted twice.

---

### Edge Cases

- Battle with a deck marked invalid at battle start.
- Wallet mutation concurrency (two spends at once — lock ensures one wins).
- Player with no mana for any card in hand.

## Requirements

### Functional Requirements

- **FR-001**: Player stats/levels MUST be config-driven via `game_config` (level thresholds, max
  HP/mana, deck size, mana costs).
- **FR-002**: Every STP balance mutation MUST append an immutable wallet-ledger entry with
  idempotency key, before/after balances, and integer-only, non-negative, locked mutation.
- **FR-003**: Card definitions MUST be data-driven with original content only; players MUST own
  card instances; decks MUST contain exactly 5 cards and be validated against restricted-ability
  rules on save and before battle.
- **FR-004**: Battles MUST resolve server-side by a deterministic engine with an injectable seed,
  an authoritative stored replayable log, and the documented §13.1 turn flow; DoT MUST be logged
  separately from immediate damage.
- **FR-005**: Battle rewards MUST respect daily anti-farming limits and idempotent claims; study
  tools MUST remain usable without claiming game rewards.

### Key Entities

- **GameConfig**: thresholds and battle defaults.
- **PlayerProfile**: XP, level, STP, battle rating, streaks, Player XP / Event EXP.
- **WalletLedger**: immutable balance mutation records.
- **CardDefinition / CardInstance / Deck**: data-driven cards, ownership, restricted 5-card decks.
- **Battle / BattleLog**: deterministic server-authoritative battles with replay logs.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Level thresholds and battle defaults change via config with zero code deploys.
- **SC-002**: Every STP movement is traceable to a ledger row; balances never go negative; duplicate
  claims never double-pay.
- **SC-003**: Replaying the same battle input + seed reproduces an identical outcome and log.
- **SC-004**: Daily battle-reward caps hold; study tools work with game rewards fully ignored.

## Assumptions

- STP and SLC are the same single currency (ledger `currency` field records it).
- Cards are original IP; Blocktales is an inspiration only, never a source of copied content.
- The battle engine's mana quiz draws from study content (quiz questions) — studying powers the game.
