## Why

Phase 4 (Study RPG) is the game layer on top of Studyield: Seekers repair damaged worlds by learning (§10). The master prompt specifies the foundations in detail: player stats and progression (§12), a **server-authoritative deterministic battle engine** with replayable logs (§13), an original card system with restricted deck rules (§13.2), an STP wallet with an immutable ledger (§14; STP is the single currency, also called SLC), and anti-farming reward rules. None of this exists yet — the only game scaffolding is the generic `user_xp_events` table and the frontend gamification store. This change lays the Phase 4 foundation: config-driven stats, the wallet, original cards + decks, and the battle engine — all testable without live services.

## What Changes

1. **Player stats & progression** — `player_profiles` (XP, level, STP, battle rating, study streak, puzzle streak, inventory/deck refs). Levels come from a config-driven threshold curve (`game_config`), not hardcoded constants; Player XP and Event EXP are separate fields.
2. **STP/SLC wallet with immutable ledger** (§14) — every balance mutation appends a `wallet_ledger` entry (txn uuid, user, currency, amount, balance before/after, type, reason, related entity, idempotency key, timestamp). Integer arithmetic only; no negative balances; database locking via `SELECT ... FOR UPDATE`.
3. **Original cards & decks** (§13.2) — data-driven `card_definitions` (key, name, category, description, mana cost, damage, healing, duration, cooldown, target, stack policy, status effect, trigger, restrictions, balance version) with an original starter set (no copyrighted content). `card_instances` = per-user ownership; `decks` + `deck_cards` = 5-card decks with restricted-ability validation (one Poison/Decay/Shield etc.), validated on save and before battle.
4. **Deterministic battle engine** (§13) — pure TypeScript module with an injectable seeded RNG; the server is authoritative and stores a complete replayable `battle_log`. Implements the §13.1 turn flow: start-of-turn effects, shield processing (shield lasts first two turns), status processing, optional study challenge (mana-recovery quiz: 5 questions, +4 mana each, max 20, no repeats; and the one-turn damage challenge: all 5 correct → +10 immediate damage for that turn), action selection, server validation, mana payment, target resolution, damage calculation, status application, defeat check, reward check, end-of-turn effects. Damage-over-time is logged separately from immediate damage (§13.6); abilities are data-driven, not per-card switch statements (§13.7).
5. **Battle rewards & anti-farming** (§6, §15-adjacent) — rewards (XP + STP) granted only on meaningful completion, with daily reward limits and idempotent claims; task completion remains possible without claiming.

## Capabilities

### New Capabilities
- `study-rpg-core`: Player stats/progression, STP wallet ledger (STP = SLC, a single currency), original card definitions + ownership + decks, and the deterministic server-authoritative battle engine with replayable logs and reward rules.

### Modified Capabilities
_(none — first Study RPG slice)_

## Impact

- `backend/migrations/021_study_rpg.sql` — `game_config`, `player_profiles`, `wallet_ledger`, `card_definitions`, `card_instances`, `decks`, `deck_cards`, `battles`, `battle_log`.
- New backend modules: `rpg` (engine + services + controller + module + barrel + `app.module.ts` registration), pure modules `battle-engine.ts` (seeded RNG, turn flow, damage calc), `card-definitions.ts` (original card data + ability schema), `level-curve.ts` (config-driven thresholds).
- Frontend: new `RpgPage` under `pages/dashboard/` (profile stats + deck builder + battle screen), `services/rpg.ts`, nav entry + locale keys in all 15 files.
- Unit tests: engine determinism (same seed → same result), deck restricted-ability rules, wallet ledger invariants (no negative, idempotency), level-threshold mapping.
