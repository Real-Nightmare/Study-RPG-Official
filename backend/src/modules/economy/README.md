# Economy Module

The Free-to-Win in-game economy — **marketplace**, **scraper/burner** for card supply,
and the supply ledger. Reward payouts are guarded by anti-cheese checks and the
exponential accuracy-based curve; nothing here is purchasable.

- **HTTP**: `@Controller('economy')`
- **Key service**: `BurnerService` (card supply), `EconomyService`
- **Related**: `integrity` (Campfire gates), `rpg` (STP ledger)
