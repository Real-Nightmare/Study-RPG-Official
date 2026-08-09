## 1. Schema + config

- [x] 1.1 Migration `022_study_pvp.sql`: `pvp_duels` (deck snapshots JSONB, battle refs, ratings before/after, winner, margins, expiry, status) + `battles.pvp_duel_id` FK + indexes
- [x] 1.2 Seed `game_config` `rpg.pvp` (ghost HP/attack derivation, Elo K, reward amounts, daily limit, expiry hours, rating window)

## 2. Pure modules

- [x] 2.1 `pvp-ghost.ts` (deck snapshot → ghost avatar stats)
- [x] 2.2 `pvp-rating.ts` (Elo expected score + deltas, floor 0)
- [x] 2.3 `pvp-settlement.ts` (winner decision matrix + margins)

## 3. Service + API

- [x] 3.1 `BattleService.create` accepts optional custom monster + `pvpDuelId` (persist FK, world `pvp`, monster `pvp_ghost`)
- [x] 3.2 `PvpService`: create (email challenge | matchmaking), list, get, startBattle (snapshot own deck, create ghost battle), settle (transactional, idempotent, rating + rewards), expireOverdue, leaderboard
- [x] 3.3 DTO `CreatePvpDuelDto`; `RpgController` `/rpg/pvp/*` endpoints; `RpgModule` + `NotificationsModule` wiring

## 4. Tests

- [x] 4.1 Ghost avatar stats (rarity HP, damage-derived attack, floor)
- [x] 4.2 Elo math (expected, symmetric deltas, floor 0)
- [x] 4.3 Settlement matrix (decisive, both-win HP%, both-loss, turn tiebreak, draw)
- [x] 4.4 PvpService flow with mocked db (create challenge/matchmake fallback, start battle, settle idempotent, rewards + daily limit, expiry default win, unknown email)

## 5. Frontend + docs

- [x] 5.1 `services/rpg.ts` PvP calls + `api.ts` endpoints + types
- [x] 5.2 `RpgPage` Duel tab (challenge by email / random, duel list, ghost battle via existing BattleScreen, leaderboard)
- [x] 5.3 Locale keys in all 15 files
- [x] 5.4 Validate backend build/lint/tests + frontend tsc/build/lint/tests; update `IMPLEMENTATION_STATUS.md` + `CHANGELOG.md`; archive change
