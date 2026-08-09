## Context

The repo has generic gamification scaffolding (`user_xp_events`, `GET /users/me/gamification`, frontend `useGamificationStore` + `XPProgressBar`) but no RPG layer. The master prompt §10–§14 specifies the design. No third-party game content may be used — all cards/lore must be original. The engine must be deterministic, server-authoritative, and replayable, and must live in testable pure modules.

## Goals / Non-Goals

**Goals:**
- Config-driven stats + battle defaults (from `game_config`).
- STP wallet (STP = SLC, single currency) with immutable ledger, integer math, locks, idempotency.
- Original data-driven card definitions + ownership + 5-card decks with restricted-ability validation.
- A pure deterministic battle engine implementing the §13.1 turn flow, shields, mana quiz, damage challenge, statuses (Poison/Decay/Shield etc.), defeat/reward checks, and a replayable log.
- Rewards with daily limits and idempotent claims.

**Non-Goals (later slices):**
- Worlds/events/StudyPass, marketplace/trades, loot boxes, card burning/extinction, async PvP matchmaking, mobile push. Data hooks (world id, event id) are reserved in the schema but not implemented.

## Decisions

1. **Pure engine modules**: `battle-engine.ts` exports pure functions `createBattleState`, `applyPlayerAction`, `applyStatusTick`, etc., taking `{ seed, rng }` — RNG injected as `(min,max)=>int` derived from a seeded PRNG (`mulberry32`). Deterministic by construction and unit-testable without DB.
2. **Config**: `game_config` (key/value JSON) seeded with battle defaults (§12) and level thresholds; `LevelCurve` pure helper reads thresholds from config.
3. **Wallet**: `WalletService.mutate(userId, {currency, amount, type, reason, entityId, idempotencyKey})` inside a `BEGIN ... SELECT FOR UPDATE` on `player_profiles`; rejects negatives; unique constraint on idempotency key prevents double application.
4. **Cards**: `card-definitions.ts` holds the original starter set as typed data (ability schema per §13.7). `CardService` seeds ownership on first visit (starter pack), provides `listOwned`, `createDeck`, `saveDeck` (validates via pure `validateDeck`), `repairDeck`.
5. **Battle flow (server-authoritative)**: `POST /rpg/battles` creates a battle from the player's current deck + a seeded engine; the client sends actions; the server validates (mana, cooldown, restricted use), applies via the pure engine, and persists each log entry. `POST /rpg/battles/:id/quiz` grades 5 non-repeating questions (from the quiz module's question pool for a chosen subject) restoring mana. `POST /rpg/battles/:id/challenge` grades the 5-question damage challenge. On defeat of the monster: reward check applies XP/STP via the wallet with daily limits (config `rpg.dailyBattleRewardLimit`).
6. **Frontend**: single `RpgPage` with three tabs (Profile stats + wallet, Deck builder, Battle) using the engine's public action contract; new `services/rpg.ts`; nav + 15 locales.
7. **Migrations**: `021_study_rpg.sql` creates the nine tables; `rpg` module registered in `app.module.ts`.

## Risks / Trade-offs

- Seeded RNG determinism depends on disciplined call ordering — engine functions are pure and sequence is explicit; tests assert same-seed replay.
- Mana quiz questions come from the user's quiz pool; sparse pools degrade to fewer questions gracefully (min 1).
- Original card set is small (starter); expansions are data-only later.
- Currency in one wallet row vs ledger-only accounting: row+ledger (with lock) matches §14.3 "wallet balances + ledger" guidance.
