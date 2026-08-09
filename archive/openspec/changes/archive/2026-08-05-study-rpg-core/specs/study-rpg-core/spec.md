## Purpose

Foundational Study RPG layer: config-driven player stats, an immutable STP wallet (STP is the single currency, also called SLC), original cards with restricted decks, and a deterministic server-authoritative battle engine with replayable logs.

## ADDED Requirements

### Requirement: Player stats and progression

Player progression SHALL be config-driven: `game_config` holds level thresholds and battle defaults (max HP 100, max mana 100, deck size 5, ability mana costs), and `player_profiles` tracks XP, level, STP, battle rating, study streak, puzzle streak, and separate Player XP / Event EXP values.

#### Scenario: Level derived from config thresholds
- **WHEN** a player's XP crosses the configured threshold for the next level
- **THEN** their level increases accordingly and the profile reflects the new level

#### Scenario: Config overrides constants
- **WHEN** battle defaults are read (HP, mana, deck size, mana costs)
- **THEN** they come from `game_config` rather than scattered code constants

### Requirement: Wallet ledger

Every STP balance mutation SHALL append an immutable `wallet_ledger` entry with transaction id, user, currency, amount, balances before/after, type, reason, related entity, idempotency key and timestamp; balances SHALL use integer arithmetic, SHALL never go negative, and SHALL be locked during mutation.

#### Scenario: Ledger entry per mutation
- **WHEN** STP is earned or spent
- **THEN** a ledger row records the mutation with before/after balances

#### Scenario: No negative balances
- **WHEN** a spend would exceed the balance
- **THEN** the mutation is rejected and the balance is unchanged

#### Scenario: Idempotent rewards
- **WHEN** a reward claim is retried with the same idempotency key
- **THEN** it is applied only once

### Requirement: Original cards and restricted decks

Card definitions SHALL be data-driven (key, name, category, mana cost, damage, healing, duration, cooldown, target, stack policy, status effect, trigger, restrictions, balance version) with original content only; players SHALL own card instances; decks SHALL contain exactly 5 cards and SHALL be validated against restricted-ability rules (only one Poison, one Decay, one Shield, one per other restricted key) on save and before battle.

#### Scenario: Deck validation
- **WHEN** a deck is saved or a battle is created
- **THEN** restricted-ability rules are enforced and invalid decks are rejected or marked invalid

#### Scenario: Starter ownership
- **WHEN** a new player opens the RPG
- **THEN** they receive an original starter card set as owned instances

### Requirement: Deterministic battle engine

Battles SHALL be resolved server-side by a deterministic engine with an injectable random seed; the server SHALL be authoritative, and SHALL store a complete replayable `battle_log`. The engine SHALL implement the §13.1 turn flow including shields (first two turns), status processing, the mana-recovery study quiz (5 questions, +4 mana each, max 20, no repeats within a battle), the one-turn damage challenge (all 5 correct → +10 immediate damage that turn), mana payment, damage calculation, defeat and reward checks, and end-of-turn effects; damage-over-time SHALL be logged separately from immediate damage.

#### Scenario: Deterministic replay
- **WHEN** the same battle inputs and seed are applied twice
- **THEN** the outcome and log are identical

#### Scenario: Mana recovery quiz
- **WHEN** a player answers the 5-question mana quiz correctly
- **THEN** mana restores by 4 per correct answer up to the configured maximum and the cap

#### Scenario: Damage-over-time separation
- **WHEN** a status like Poison deals damage
- **THEN** it is recorded in the log separately from the immediate attack damage

### Requirement: Battle rewards with anti-farming limits

Battle rewards (XP and STP) SHALL be granted on completion with daily reward limits; rewards SHALL be claimable idempotently, and study tools SHALL remain usable without claiming game rewards.

#### Scenario: Daily limit enforced
- **WHEN** the daily reward limit for battles is reached
- **THEN** further battles grant no game reward (or reduced reward) but still complete normally

#### Scenario: Idempotent claim
- **WHEN** a reward claim repeats with the same idempotency key
- **THEN** the reward is not granted twice
