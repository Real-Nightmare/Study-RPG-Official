# Implementation Plan: Study RPG Economy

**Branch**: `010-study-economy` | **Date**: 2026-08-06 | **Spec**: `specs/010-study-economy/spec.md`

**Input**: Feature specification from `/specs/010-study-economy/spec.md` (PDF Phase 6 — Economy, §16–§24).

**Status**: ✅ Implemented — backend and frontend shipped, 54 new unit tests, frontend typecheck clean.

## Summary

Give the Study RPG a trusted, deflationary card economy. Every card gets an **official STP value**
derived from its rarity base and active supply (floored/capped), backed by an immutable
`card_supply_ledger` and `card_price_history`. Players can **list cards** on a marketplace with
fixed prices and **make/accept/decline/cancel offers**; sales settle atomically against the wallet
ledger. Two permanent-removal sinks: **scrap** (immediate payout at the official value) and
**burn** (payout in instalments — first now, rest on a schedule), both idempotent. When a card's
active supply hits zero it goes **extinct** and an **"Echo of …"** replacement print run activates,
keeping the card alive while resetting value. Admins get reconcile + process-instalments
housekeeping endpoints.

## Technical Context

**Language/Version**: TypeScript (NestJS 10 backend, React 19 + Vite 7 frontend)

**Primary Dependencies**: `pg` (raw SQL, no ORM), class-validator DTOs, Swagger decorators,
`uuid`; frontend: axios, React Router, framer-motion, shadcn/Radix UI, i18next (15 locales)

**Storage**: PostgreSQL 15 — raw SQL in `backend/migrations/024_study_economy.sql`

**Testing**: Jest unit suites with in-memory fake `DatabaseService` (backend); Vitest (frontend,
unchanged)

**Target Platform**: Web (SPA behind NestJS API)

**Project Type**: Web service (feature slice of the Study RPG module)

**Performance Goals**: Marketplace list + supply report return < 300 ms p95 on 10k cards;
instalment processing bounded to 100 runs per invocation

**Constraints**: Integer-only STP; no negative balances; idempotent wallet mutations (unique
`(user, idempotency_key)`); atomic marketplace settlement in a single transaction; no copyrighted
third-party content in cards/lore

**Scale/Scope**: Small — 9 original card definitions, per-user instances, one marketplace; designed
to scale via supply/price aggregates

## Constitution Check

*GATE: Passed.* Original content only (cards/lore are Studyield-original, blocktales-inspired
naming); study-first framing preserved (economy rewards studying, never substitutes for it);
no secrets introduced (economy config is code + DB seed, no env vars); migrations unique and
ordered after `023`; AGPL-3.0 licence untouched.

## Project Structure

```text
specs/010-study-economy/
├── plan.md              # This file
├── spec.md              # Requirements + acceptance scenarios (§16–§24)
└── tasks.md             # Sequenced implementation checklist (backend + frontend)

backend/src/modules/economy/
├── card-value.ts            # pure: official value (rarity base × supply multiplier)
├── burn-instalments.ts      # pure: instalment schedule math
├── supply.ts                # pure: extinction declaration + replacement key
├── economy-config.ts        # typed config merged over code defaults
├── economy.service.ts       # marketplace, offers, buy/settle, collection, vault moves
├── burner.service.ts        # scrape, burn, burn-status, processDueInstalments
├── supply.service.ts        # supply report, price history, reconcile, checkExtinction
├── economy.controller.ts    # /economy/* routes (+ RolesGuard admin endpoints)
├── dto/economy.dto.ts
└── *.spec.ts                # 54 unit tests

frontend/src/
├── services/economy.ts      # economyService API client
├── config/api.ts            # ENDPOINTS.economy
├── types/index.ts           # Economy* types
└── pages/dashboard/EconomyPage.tsx  # Marketplace / My Cards / Supply tabs
```

## Design Decisions

1. **Official value = supply-tied, not market-tied** — value derives from rarity + active supply
   (floor 0.5×, cap 3.0×), so the marketplace price floats around a trusted anchor and scraper/burn
   payouts are always fair and auditable.
2. **Scrap vs burn** — scrap = immediate 80% payout (fast liquidity); burn = 100% payout spread
   over 4 instalments on a 24h schedule (deeper sink, anti-flood). Both are irreversible with an
   explicit `confirm: true`.
3. **Extinction + Echo replacements** — zero active supply retires the print run and mints
   `{key}__echo_{generation}` with a fresh print at base value, preventing dead economies while
   preserving scarcity signals.
4. **Atomic settlement** — `buyListing`/`acceptOffer` lock the buyer wallet row, debit, transfer
   ownership, credit the seller, mark the listing sold, and cancel sibling offers inside one
   transaction; every step uses idempotency keys (`economy:<type>:<listing>:<offer>`).
5. **Admin housekeeping** — `reconcile` recomputes counters/values; `processBurnInstalments` pays
   all due instalments; both RolesGuard(ADMIN) and audited by the existing audit trail.

## Implementation Notes

- `WalletService.applyChangeWithClient` was refactored to expose the atomic client-based mutation
  used inside settlement transactions (existing call sites unchanged, tests green).
- Instalment schedule is fixed at burn time from the official value (never a listing price).
- Marketplace listings expire after 24h (config `listingDurationHours`) and are lazily marked
  expired by `assertActive`.
- Frontend locale keys: `nav.economy` + full `economy.*` namespace added to **all 15 locale files**.
- Verification: `cd backend && npm test` → **256 tests passing** (54 economy); `npx tsc -p tsconfig.json --noEmit` clean; `cd frontend && npx tsc -b --noEmit` clean.
