# Feature Specification: Study RPG Economy

**Feature Branch**: `010-study-economy`

**Created**: 2026-08-06

**Status**: ✅ Implemented (backend + frontend shipped 2026-08-06, 54 unit tests, frontend typecheck clean)

**Input**: Authorized from the owner's master prompt PDF Phase 6 (Economy, §16–§24) and
`docs/implementation/MASTER_PLAN.md` §4; the first Spec Kit-authored feature.

## User Scenarios & Testing

### User Story 1 — Official card value and supply ledger (Priority: P1)

Every card has an official STP value derived from its rarity and active supply (base value × supply
multiplier, floored and capped), recalculated on demand; every supply event (mint, trade, burn,
scrape, extinction, replacement, seed) appends to an immutable `card_supply_ledger`, and value
changes append to `card_price_history`.

**Why this priority**: A trusted value + supply spine is what makes the marketplace, scraper, and
burner meaningful and fair.

**Independent Test**: Reconcile supply, verify per-card official values + price history, and verify
ledger rows for every supply event type.

**Acceptance Scenarios**:

1. **Given** supply changes (burns/scrapes), **When** the supply report is recomputed,
   **Then** active supply is derived from `card_instances` and official value moves with the supply
   multiplier within the configured floor/cap.
2. **Given** a value change occurs, **When** it is recorded, **Then** a `card_price_history` row is
   appended with the new value and reason.
3. **Given** any supply event occurs, **When** it is recorded, **Then** a `card_supply_ledger` row
   stores the event type, quantity, and detail.

---

### User Story 2 — Marketplace listings and offers (Priority: P1)

A player lists an owned, non-decked, tradable card at a fixed STP price; others can buy it
immediately or make offers; the seller can accept/decline/cancel; listings expire after a config
duration. Every sale is atomic: buyer debit + ownership transfer + seller credit in one locked,
idempotent transaction.

**Why this priority**: Player-to-player trading is the heart of the economy.

**Independent Test**: List → buy, list → offer → accept, expiry, and capacity enforcement; verify no
double-buy/double-pay under concurrent requests.

**Acceptance Scenarios**:

1. **Given** an owned card is listed at a positive integer price, **When** the listing is created,
   **Then** it appears as `active` with an expiry and cannot be double-listed.
2. **Given** a buyer buys an active listing, **When** the sale settles,
   **Then** buyer is debited, ownership transfers, seller is credited, the listing becomes `sold`,
   and pending offers are cancelled — atomically.
3. **Given** an offer is accepted, **When** the sale settles, **Then** the card sells at the offered
   price with the same atomic guarantees.
4. **Given** a listing reaches its expiry, **When** it is listed or read,
   **Then** it is marked `expired` and can no longer be bought.
5. **Given** a buyer's inventory would exceed capacity, **When** they buy,
   **Then** the purchase is rejected with a clear message.

---

### User Story 3 — Scraper and burner with instalments (Priority: P1)

A player can permanently remove a card: **scrape** (immediate payout at a config percentage of
official value) or **burn** (payout at a config percentage spread over 4 instalments at 24-hour
intervals, first payment immediate). Removal is permanent, recorded on the instance, and reflected
in supply.

**Acceptance Scenarios**:

1. **Given** a player scraps a scrapable card with confirmation, **When** the scrape runs,
   **Then** the card is removed permanently and the player is paid immediately at the configured
   scrape percentage.
2. **Given** a player burns a burnable card with confirmation, **When** the burn runs,
   **Then** the card is removed permanently and the payout is scheduled in instalments
   (first immediate), tracked by `card_burn_instalments` with an idempotency prefix.
3. **Given** a due instalment is processed, **When** the admin processes due instalments,
   **Then** the payment is applied idempotently and the instalment advances until `completed`.

---

### User Story 4 — Inventory and vault (Priority: P2)

Cards live in an inventory or a vault (both capacity-capped by config); a card in a deck or listed
on the marketplace cannot be moved until removed.

**Acceptance Scenarios**:

1. **Given** a card is in the inventory, **When** it is moved to the vault,
   **Then** the move succeeds only if capacity allows and the card is not in a deck or listed.
2. **Given** a card is listed on the marketplace, **When** a move is attempted,
   **Then** the move is rejected until the listing is cancelled.

---

### User Story 5 — Extinction and replacement (Priority: P2)

When a card's active supply reaches zero, the card goes extinct: locked, retired, marked inactive,
recorded in the ledger, and a replacement with a new identity ("Echo of …") and a fresh print is
activated.

**Acceptance Scenarios**:

1. **Given** a card's active supply reaches zero, **When** the extinction check runs,
   **Then** the card is marked extinct/retired/inactive and an extinction ledger event is recorded.
2. **Given** a card goes extinct, **When** the replacement is created,
   **Then** a new card key (`<key>_<generation>`), name "Echo of <name>", fresh print, and base
   value are activated and ledgered as a replacement.

---

### User Story 6 — Admin reconciliation and reporting (Priority: P3)

Admins can reconcile supply counters and official values from authoritative data and process due
burn instalments; everyone can view the supply report and per-card price history.

**Acceptance Scenarios**:

1. **Given** an admin runs reconcile, **When** it completes,
   **Then** supply counters and official values are recomputed idempotently and the result reports
   cards checked, value changes, and extinct cards.
2. **Given** the supply report is requested, **When** it is built, **Then** it shows
   original/active/burned/scraped/listed counts, official value, and extinction state per card.

---

### Edge Cases

- Burning/scraping the last copy of a card triggers extinction with a replacement.
- Instalment payment when the wallet lacks funds (payment is skipped/retried, not lost).
- Buying your own listing (rejected).
- Marketplace fee configuration (currently 0%) applied when nonzero.
- Extinction of a card that already has a replacement (generation counter).

## Requirements

### Functional Requirements

- **FR-001**: Official card value MUST be computed from rarity base values and active supply
  (multiplier floored and capped by config) and persisted with price history.
- **FR-002**: Every supply event MUST append an immutable `card_supply_ledger` row; counters on
  `card_definitions` MUST be maintained transactionally and reconcilable from `card_instances`.
- **FR-003**: Players MUST be able to list owned, non-decked, tradable cards at positive integer
  STP prices; listings MUST expire; buyers MUST be able to buy or offer; sellers MUST be able to
  accept/decline/cancel.
- **FR-004**: Every sale MUST settle atomically (buyer debit + ownership transfer + seller credit,
  listing locked `FOR UPDATE`, idempotent wallet keys) — no double-buys, no double-pays.
- **FR-005**: Scraping MUST remove a card permanently with immediate config-percentage payout;
  burning MUST remove it permanently with config-percentage payout in idempotent instalments.
- **FR-006**: Inventory and vault MUST be capacity-capped; decked or listed cards MUST NOT be
  movable.
- **FR-007**: At zero active supply, a card MUST go extinct (locked/retired/inactive, ledgered) and
  a fresh-print replacement with a new identity MUST be activated.
- **FR-008**: Admins MUST be able to reconcile supply/values and process due burn instalments; the
  supply report and price history MUST be publicly viewable.
- **FR-009**: All economy configuration MUST live in `game_config` (`rpg.economy`) with code
  defaults so the module always has a working configuration.

### Key Entities

- **CardDefinition**: supply counters, official value, tradable/burnable/scrapable/active/extinct/
  retired flags, replacement_of.
- **CardInstance**: user ownership, location (inventory/vault), removed_at/removed_reason.
- **CardSupplyLedger**: immutable supply events (mint/trade/burn/scrape/extinction/replacement/seed).
- **CardPriceHistory**: official value changes with reasons.
- **MarketplaceListing / MarketplaceOffer**: fixed-price listings, offers, expiry, settlement.
- **CardBurnInstalment**: burn payout schedule with idempotency prefix.
- **EconomyConfig**: `rpg.economy` game_config row merged over defaults.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every card has a transparent official value that moves with supply and is explained
  by history.
- **SC-002**: Concurrent marketplace activity never double-spends, double-pays, or duplicates
  ownership.
- **SC-003**: Scrape and burn flows are permanent, tracked, and idempotent across retries.
- **SC-004**: Zero-supply cards extinct and are replaced with fresh prints automatically.
- **SC-005**: Supply counters always reconcile to the authoritative instances table.
- **SC-006**: The whole economy remains a celebration of study — anti-farming caps and study-first
  reward rules from the constitution still hold.

## Assumptions

- STP is the only marketplace currency (no USD/cash).
- Marketplace fee is configurable and currently 0%.
- Extinction replacement prints are sized per rarity from config.
- Frontend UI (marketplace, collection/vault, burn/scrape flows, supply dashboard) is the next
  implementation slice — see `tasks.md`.
