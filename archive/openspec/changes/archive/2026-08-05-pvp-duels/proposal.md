## Why

Phase 5 (Battles) of the master prompt is nearly complete from Phase 4: worlds, monsters, bosses, the deterministic engine, quizzes, shields, statuses, and rewards all shipped. The one missing pillar is **PvP**. The prompt lists "PvP" and "Ranked battle rating" as Phase 5 items, and `player_profiles.battle_rating` has been reserved since Phase 4 with no system using it. This change ships async player-vs-player duels: challenge a friend or get matched by battle rating, fight a **ghost avatar** of the opponent's deck through the existing deterministic engine, and settle for rating + STP/SLC + XP — with the same anti-farming and idempotency guarantees as single-player battles.

## What Changes

1. **Seeker Duels** — a new `pvp_duels` table models a challenge between two players. Each side snapshots the opponent's active deck at challenge time and fights a deterministic **ghost avatar** (HP/attack derived from the deck's rarity mix and damage) through the existing `BattleService`/engine — no new battle mechanics, full replayable logs, quizzes, shields and statuses still apply.
2. **Matchmaking** — challenging by opponent email or by **random matchmaking** on battle rating (±150 window, widened fallback); only players with a validated active deck are eligible opponents.
3. **Settlement** — when both battles are terminal (or a duel expires with only one side played), a pure settlement function decides the winner: decisive win wins; both-win/both-loss compare remaining HP% then turns; ties draw. Winner + loser Elo rating deltas (configurable K) are applied to `player_profiles.battle_rating`.
4. **Rewards** — winner earns config STP + XP, loser earns consolation XP, all through the existing idempotent `WalletService` ledger (`pvp_win:<duelId>` key) and `PlayerService.addXp`, under the daily anti-farming limits from `game_config` `rpg.rewards` + a new `rpg.pvp` config block.
5. **Leaderboard** — `GET /rpg/pvp/leaderboard` exposes top players by battle rating (the prompt's "ranked battle rating" support).
6. **Notifications** — challenger/result notifications via the existing `NotificationsService`.

## Capabilities

### New Capabilities
- `pvp-duels`: async player-vs-player duels — challenge/matchmaking, deck-snapshot ghost battles, deterministic settlement, Elo battle rating, STP/XP rewards with anti-farming, leaderboard.

### Modified Capabilities
- `study-rpg-core`: `BattleService.create` accepts an optional custom monster + `pvpDuelId` so PvP battles reuse the whole engine; `player_profiles.battle_rating` becomes a live ranked metric.

## Impact

- `backend/migrations/022_study_pvp.sql` — `pvp_duels` table (deck snapshots, battle refs, ratings before/after, winner, margins, expiry), `battles.pvp_duel_id` FK, indexes, `game_config` seed `rpg.pvp`.
- Backend: new pure modules `pvp-ghost.ts`, `pvp-rating.ts`, `pvp-settlement.ts`; `pvp.service.ts` (create/matchmake/start/settle/expire/leaderboard); `CreatePvpDuelDto`; `rpg.controller.ts` PvP endpoints; `RpgModule` wiring (+ `NotificationsModule`).
- Frontend: `services/rpg.ts` PvP calls, `api.ts` endpoints, RPG types, a **Duel** tab in `RpgPage` (challenge / duel list / ghost battle / leaderboard), nav + locale keys in all 15 files.
- Unit tests: ghost avatar stats, Elo math, settlement matrix, PvP service flow (create, matchmake fallback, start battle, settle idempotent, rewards + daily limit, expiry default win) — all with mocked db, no live services.
