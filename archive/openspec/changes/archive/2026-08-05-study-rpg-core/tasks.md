## 1. Schema + config

- [x] 1.1 Migration `021_study_rpg.sql`: `game_config`, `player_profiles`, `wallet_ledger`, `card_definitions`, `card_instances`, `decks`, `deck_cards`, `battles`, `battle_log` (+ unique idempotency key, `SELECT FOR UPDATE` support)
- [x] 1.2 Seed `game_config`: battle defaults (§12) + level thresholds + daily reward limits

## 2. Pure engine + cards

- [x] 2.1 `seeded-rng.ts` (mulberry32) + `battle-engine.ts` (pure, deterministic: turn flow, shields, statuses, mana quiz grading, damage challenge, damage-over-time separation, defeat/reward checks, log builder)
- [x] 2.2 `card-definitions.ts` (original starter set, §13.7 ability schema) + `deck-rules.ts` (5-card size, restricted abilities, validate/repair)
- [x] 2.3 `level-curve.ts` (config-driven thresholds)

## 3. Services + API

- [x] 3.1 `WalletService` (single STP currency, locked mutations, ledger, idempotency, no negatives) + `PlayerService` (progression, stats, daily limits)
- [x] 3.2 `CardService` (starter pack, owned instances, decks CRUD + validation) + `BattleService` (create/action/quiz/challenge/log/rewards)
- [x] 3.3 `RpgModule` + `rpg.controller.ts` (profile, wallet, decks, battles endpoints) + `app.module.ts` registration

## 4. Tests

- [x] 4.1 Engine determinism (same seed → same log), turn flow, shields, status separation
- [x] 4.2 Deck restricted-ability rules, level curve mapping, wallet ledger invariants + idempotency
- [x] 4.3 Battle service flow with mocked db (quiz grading, rewards + daily limit)

## 5. Frontend + docs

- [x] 5.1 `services/rpg.ts` + types; `RpgPage` (Profile/Deck/Battle tabs) + router + nav
- [x] 5.2 Locale keys in all 15 files
- [x] 5.3 Validate backend build/lint/tests + frontend tsc/build/lint/tests; update `IMPLEMENTATION_STATUS.md` + `CHANGELOG.md`
