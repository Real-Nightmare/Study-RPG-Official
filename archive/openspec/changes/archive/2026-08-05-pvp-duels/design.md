## Context

Phase 4 shipped the complete single-player RPG stack: deterministic engine, wallet, cards, decks, rewards. Phase 5's PvP pillar remains. The engine is a player-vs-monster model — true live synchronous PvP would need a new engine or websocket match loop. The prompt's own list ("PvP", "Ranked battle rating") is compatible with **async duels**: the deterministic engine already guarantees both players see identical, replayable outcomes for the same seed/deck/actions, so a duel where each side fights the other's deck as a ghost avatar is fair, cheap, and needs no new battle mechanics.

## Goals / Non-Goals

**Goals:**
- Challenge a specific player (by email) or be matchmade by battle rating.
- Ghost avatar built from the opponent's active-deck snapshot (rarity-weighted HP, damage-derived attack).
- Deterministic settlement: decisive win > remaining-HP% > turns; draws possible.
- Elo rating on `player_profiles.battle_rating` (configurable K, floor 0).
- STP/XP rewards via existing idempotent wallet + XP paths, under daily anti-farming limits.
- Expiry handling: unplayed side defaults to a loss; duel never hangs forever.
- Leaderboard by rating.

**Non-Goals (later phases):**
- Live/synchronous PvP, spectator mode, chat/taunts, wagers/stakes in STP (Phase 6 economy), tournaments/ladders, PvP achievements.
- Only one battle per side per duel (no best-of-N).

## Decisions

1. **Ghost avatar model.** `pvp-ghost.ts` (pure): given a deck snapshot (`{cardKey, rarity, ability}[]`) + `rpg.pvp` config, produce `{key:'pvp_ghost', name:<opponent display name>, hp, maxHp, attack}`. HP = base + rare×perRare + legendary×perLegendary; attack = base + floor(Σ damage / deckSize) (poison/decay DoT cards contribute nothing to burst attack — matches the engine's basic-attack-first design). The ghost fights through the **existing** `BattleService.create` via an optional custom monster, so quizzes/shields/statuses/logs/rewards all work unchanged.
2. **Matchmaking.** `findOpponent(challengerId, rating)`: candidates = players (≠ self) with an active validated deck within ±`ratingWindow` of the challenger's rating; if none, widen ×4; if still none, any player with an active validated deck; otherwise `ConflictException`. Ties broken by smallest rating distance, then random.
3. **Duel lifecycle.** `pvp_duels.status`: `challenged` → (either side starts) `in_progress` → `settled` | `expired`. `expires_at` = created + config expiry hours. Expiry is only evaluated lazily on read/list (`expireOverdue(userId)` settles any of the user's overdue duels first) — no cron needed.
4. **Settlement.** `pvp-settlement.ts` (pure): `settleDuel(challenger: {won, hpPct, turns}, defender: {...}) → {winner: 'challenger'|'defender'|null (draw), reason}`. Both-win/both-loss compare remaining HP% (higher wins), then fewer turns. One decisive win wins outright. Unplayed/expired side → `hpPct: 0, won: false`.
5. **Rating.** `pvp-rating.ts` (pure Elo): `expected(a,b) = 1/(1+10^((b-a)/400))`; winner delta `round(K(1−E))`, loser `round(−K·E)`, floored at 0. Applied in the settle transaction to both profiles.
6. **Rewards.** Winner: `WalletService.applyChange(+stp, 'pvp_win', idempotencyKey 'pvp_win:<duelId>')` + `PlayerService.addXp(winXp, 'pvp_win')`; loser: `addXp(lossXp, 'pvp_loss')`. Daily anti-farming: count today's `pvp_win` ledger rows vs `rpg.pvp.dailyPvpWinLimit` (0 when over, same pattern as battle rewards). Settle is a single transaction with `SELECT ... FOR UPDATE` on the duel row → idempotent.
7. **Notifications.** `NotificationsService.create` on challenge (defender) and settlement (both), linked to `/dashboard/rpg`.
8. **API.** New endpoints on `RpgController` under `/rpg/pvp/*`; `CreatePvpDuelDto { opponentEmail?, deckId? }` (email optional → matchmaking). Battle endpoints reuse existing `/rpg/battles` flow after `POST /rpg/pvp/duels/:id/battle` returns the created `BattleView`.

## Risks / Trade-offs

- **Ghost is a simplification** — the opponent's *deck* fights via derived stats, not a full second player brain. Acceptable for async PvP v1; a true mirror-engine duel is a possible later slice.
- **Email lookup** — only exact email match is exposed (no search/autocomplete); returns 404 for unknown/self email to avoid user enumeration.
- **Expiry is lazy** — duels settle on the next read; no background job. Fine at this scale; a `expired_at` sweep could be added with BullMQ later.
- **Rating is zero-sum-ish** — K constant; no provisional/unranked handling. Fine for v1.
