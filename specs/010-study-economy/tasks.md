# Tasks: Study RPG Economy

**Input**: Design documents from `/specs/010-study-economy/` (PDF Phase 6 — Economy, §16–§24).

**Status**: ✅ Complete — backend + frontend implemented and verified 2026-08-06 (54 unit tests, backend suite 256 total; frontend typecheck clean).

## Backend — implemented

- [x] `024_study_economy.sql` — card_definitions supply/value/tradability/extinction columns,
      card_instances location + removal state, `card_supply_ledger`, `card_price_history`,
      `marketplace_listings`, `marketplace_offers`, `card_burn_instalments`, `rpg.economy`
      game_config seed (unique prefix 024, after 023)
- [x] `economy-config.ts` — typed `EconomyConfig` merged over code defaults (listing/offer
      durations, fee, scrape 80% / burn 100% payouts, 4 instalments / 24h, rarity base values,
      supply multiplier floor 0.5 / cap 3.0, initial prints, inventory/vault capacity 50)
- [x] `card-value.ts` — pure official-value computation (rarity base × supply multiplier,
      floored/capped) — unit-tested
- [x] `supply.ts` — pure supply/extinction helpers (`shouldDeclareExtinction`,
      `replacementKey`) — unit-tested
- [x] `supply.service.ts` — supply report, price history, idempotent `reconcile()`
      (counters + values + extinction), `checkExtinction()` (mark extinct/retired/inactive, ledger
      event, activate "Echo of …" replacement with fresh print) — unit-tested
- [x] `burn-instalments.ts` — pure instalment schedule math — unit-tested
- [x] `burner.service.ts` — `scrapeCard` (immediate 80% payout), `burnCard` (4 instalments,
      first immediate, idempotency prefix), `burnStatus`, `processDueInstalments` — unit-tested
- [x] `economy.service.ts` — marketplace list/listCard/cancelListing/buyListing (atomic
      `FOR UPDATE` settlement), offers (make/accept/decline/cancel + myOffers), collection + vault
      (myCards, moveCard with capacity + deck/listing guards) — unit-tested
- [x] `economy.controller.ts` — `GET/POST/DELETE /economy/marketplace…`,
      `GET /economy/cards`, `POST /economy/cards/:id/move`, `POST /economy/cards/:id/scrape|burn`,
      `GET /economy/cards/:id/burn-status`, `GET /economy/supply`, `GET /economy/supply/:cardKey/history`,
      `POST /economy/admin/reconcile|process-burn-instalments` (admin-only)
- [x] `dto/economy.dto.ts` — ListCardDto, MakeOfferDto, MoveCardDto, ConfirmRemovalDto,
      MarketplaceQueryDto
- [x] `app.module.ts` wiring — `EconomyModule` registered (import + providers)
- [x] Unit tests: `economy.service.spec.ts`, `supply.service.spec.ts`, `burner.service.spec.ts`,
      `card-value.spec.ts`, `supply.spec.ts`, `burn-instalments.spec.ts`

## Frontend — pending (next slice)

- [ ] `frontend/src/types/index.ts` — economy types (Listing, Offer, CollectionCard, SupplyReport,
      BurnStatus, Extinction)
- [ ] `frontend/src/services/economy.ts` — API client for marketplace, cards, scrape/burn, supply
- [ ] Marketplace page/tab — browse/filter listings, list a card, buy, make/accept offers,
      cancellation + expiry UX
- [ ] Collection & vault — myCards grid with location toggle, deck/listed badges, move action
- [ ] Scrape/burn flows — confirmation dialog, payout preview, instalment progress
- [ ] Supply dashboard (admin) — reconcile button, supply report, price history chart
- [ ] Router + DashboardLayout nav + locale keys in all 15 files (economy namespace)

## Tests & validation

- [x] Backend unit tests for all pure + service modules
- [ ] backend `npm run build`, `npm test`, `npm run lint` — green
- [ ] frontend `tsc -b --noEmit`, `npm run lint`, `npm test` — green (after frontend slice)
- [ ] Live smoke test against running Postgres (Docker) — blocked on credentials/services in this
      workspace

## Docs

- [x] `specs/010-study-economy/spec.md` + `tasks.md` created (Spec Kit)
- [ ] `docs/implementation/MASTER_PLAN.md` §2 row 6 → update status to in-progress/complete
- [ ] `IMPLEMENTATION_STATUS.md` + `CHANGELOG.md` updated when the phase completes

## Notes

- Economy must never become a "study to get something" pressure: rewards/values are config-driven,
  anti-farmed, and the dashboard hide-game-stats toggle stays authoritative.
- PDF §17 active-card cap (§ inventory capacity) is enforced on buy and move.
