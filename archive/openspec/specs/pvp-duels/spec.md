## Purpose

Async player-vs-player duels for Study RPG (Phase 5 — Battles: PvP). A player challenges an opponent (by email or battle-rating matchmaking); each side fights a deterministic ghost avatar of the other's deck through the existing battle engine; the duel settles into a winner, Elo battle-rating change, and STP/SLC + XP rewards with anti-farming and idempotent claims.

## Requirements

### Requirement: Seeker duels

The system SHALL support asynchronous player-vs-player duels between two players. A duel SHALL snapshot each side's active deck at challenge time, SHALL give each side one battle against a ghost avatar derived from the opponent's deck snapshot, and SHALL settle once both battles are terminal or the duel expires.

#### Scenario: Challenge a player by email
- **WHEN** a player creates a duel with a valid opponent email
- **THEN** a duel is created in `challenged` status with both deck snapshots stored and the opponent is notified

#### Scenario: Random matchmaking by battle rating
- **WHEN** a player creates a duel without an opponent email
- **THEN** an eligible opponent (≠ self, active validated deck) within the rating window is chosen, widening if needed, and a duel is created

#### Scenario: No eligible opponents
- **WHEN** no player with an active validated deck exists as an opponent
- **THEN** the create request is rejected with a conflict error

### Requirement: Ghost battle

Each side of a duel SHALL play one battle against a ghost avatar whose HP scales with the opponent deck's rare/legendary count and whose attack derives from the deck's card damage; the battle SHALL run through the existing deterministic server-authoritative engine with replayable logs, and SHALL be linked to the duel.

#### Scenario: Ghost avatar derived from deck snapshot
- **WHEN** a player starts their duel battle
- **THEN** the opponent's deck snapshot is converted into ghost HP (base + per-rare + per-legendary) and attack (base + floor of total damage / deck size)

#### Scenario: Battle is linked to the duel
- **WHEN** a PvP battle is created
- **THEN** it is stored in `battles` with `pvp_duel_id` set, world `pvp`, and the ghost as monster

### Requirement: Settlement and rating

A settled duel SHALL produce a winner deterministically — decisive win, else higher remaining HP%, else fewer turns, else a draw — and SHALL apply Elo battle-rating deltas (configurable K, floor 0) to both players' `player_profiles.battle_rating` inside a single locked, idempotent transaction.

#### Scenario: Decisive result
- **WHEN** one side wins their battle and the other loses
- **THEN** the winning side wins the duel and both ratings update by the Elo delta

#### Scenario: Both won or both lost
- **WHEN** both sides have the same win/loss outcome
- **THEN** the side with the higher remaining HP% wins, ties broken by fewer turns, otherwise the duel is a draw with no rating change

#### Scenario: Expiry defaults the unplayed side
- **WHEN** a duel expires and only one side has played
- **THEN** the played side wins the duel by default

#### Scenario: Settlement is idempotent
- **WHEN** a settled duel is read or listed again
- **THEN** rating and rewards are not applied twice

### Requirement: PvP rewards with anti-farming

The duel winner SHALL earn configurable STP and XP, and the loser consolation XP, granted idempotently through the existing wallet ledger and XP paths, subject to a daily PvP reward limit from `game_config`.

#### Scenario: Winner and loser rewards
- **WHEN** a duel settles
- **THEN** the winner receives STP (ledger `pvp_win`, key `pvp_win:<duelId>`) and XP, and the loser receives consolation XP

#### Scenario: Daily limit enforced
- **WHEN** the daily PvP reward limit is reached
- **THEN** further PvP wins grant no STP/XP but the duel still settles and ratings still update

### Requirement: Leaderboard

The system SHALL expose a battle-rating leaderboard of players.

#### Scenario: Top players by rating
- **WHEN** the leaderboard is requested
- **THEN** players are returned ordered by `battle_rating` descending with their rating and level
