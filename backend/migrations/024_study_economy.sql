-- Study RPG Economy — PDF Phase 6 (master prompt §16–§24)
-- Official card value, supply ledger, marketplace & trades, scraper,
-- burner with instalments, and extinction with replacements.
-- Unique prefix 024, ordered after 023.

-- ---------------------------------------------------------------------------
-- 1. Card definitions: supply, value, tradability, extinction state
-- ---------------------------------------------------------------------------
ALTER TABLE card_definitions ADD COLUMN IF NOT EXISTS original_supply INTEGER NOT NULL DEFAULT 0;
ALTER TABLE card_definitions ADD COLUMN IF NOT EXISTS active_supply INTEGER NOT NULL DEFAULT 0;
ALTER TABLE card_definitions ADD COLUMN IF NOT EXISTS burned_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE card_definitions ADD COLUMN IF NOT EXISTS scraped_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE card_definitions ADD COLUMN IF NOT EXISTS official_value INTEGER NOT NULL DEFAULT 0;
ALTER TABLE card_definitions ADD COLUMN IF NOT EXISTS tradable BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE card_definitions ADD COLUMN IF NOT EXISTS burnable BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE card_definitions ADD COLUMN IF NOT EXISTS scrapable BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE card_definitions ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE card_definitions ADD COLUMN IF NOT EXISTS extinct BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE card_definitions ADD COLUMN IF NOT EXISTS extinct_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE card_definitions ADD COLUMN IF NOT EXISTS retired_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE card_definitions ADD COLUMN IF NOT EXISTS replacement_of VARCHAR(60) REFERENCES card_definitions(key);

-- ---------------------------------------------------------------------------
-- 2. Card instances: storage location (inventory/vault) + removal state
-- ---------------------------------------------------------------------------
ALTER TABLE card_instances ADD COLUMN IF NOT EXISTS location VARCHAR(20) NOT NULL DEFAULT 'inventory'
  CHECK (location IN ('inventory', 'vault'));
ALTER TABLE card_instances ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE card_instances ADD COLUMN IF NOT EXISTS removed_reason VARCHAR(30); -- burn | scrape

CREATE INDEX IF NOT EXISTS idx_card_instances_removed ON card_instances(removed_at) WHERE removed_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Immutable supply ledger (mint | trade | burn | scrape | extinction | replacement | seed)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS card_supply_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_key VARCHAR(60) NOT NULL REFERENCES card_definitions(key),
    event_type VARCHAR(30) NOT NULL,
    quantity INTEGER NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_supply_ledger_card ON card_supply_ledger(card_key, created_at);

-- ---------------------------------------------------------------------------
-- 4. Official value history (§21)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS card_price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_key VARCHAR(60) NOT NULL REFERENCES card_definitions(key),
    value INTEGER NOT NULL,
    reason VARCHAR(120),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_price_history_card ON card_price_history(card_key, created_at);

-- ---------------------------------------------------------------------------
-- 5. Marketplace: fixed-price listings (§20)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketplace_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_instance_id UUID NOT NULL REFERENCES card_instances(id) ON DELETE CASCADE,
    price INTEGER NOT NULL CHECK (price > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | sold | cancelled | expired
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sold_at TIMESTAMP WITH TIME ZONE,
    buyer_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_listing_active_instance
  ON marketplace_listings(card_instance_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_listings_status ON marketplace_listings(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON marketplace_listings(seller_id, status);

-- ---------------------------------------------------------------------------
-- 6. Buyer offers on listings (§20 "offers")
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketplace_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | accepted | declined | cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_offers_listing ON marketplace_offers(listing_id, status);
CREATE INDEX IF NOT EXISTS idx_offers_buyer ON marketplace_offers(buyer_id, status);

-- ---------------------------------------------------------------------------
-- 7. Burn instalments (§23: four payments, first immediate)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS card_burn_instalments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_instance_id UUID NOT NULL REFERENCES card_instances(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_key VARCHAR(60) NOT NULL,
    total INTEGER NOT NULL CHECK (total > 0),
    instalments INTEGER NOT NULL CHECK (instalments > 0),
    paid_amount INTEGER NOT NULL DEFAULT 0,
    paid_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | completed | failed
    next_instalment_at TIMESTAMP WITH TIME ZONE,
    idempotency_prefix VARCHAR(160) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_burn_instalments_due ON card_burn_instalments(status, next_instalment_at);
CREATE INDEX IF NOT EXISTS idx_burn_instalments_user ON card_burn_instalments(user_id);

-- ---------------------------------------------------------------------------
-- 8. Economy configuration seed (§17, §21, §22, §23)
-- ---------------------------------------------------------------------------
INSERT INTO game_config (key, value, description) VALUES
  ('rpg.economy', '{
    "listingDurationHours": 168,
    "offerDurationHours": 72,
    "marketplaceFeePercent": 0,
    "burnInstalments": 4,
    "burnInstalmentIntervalHours": 24,
    "scrapePayoutPercent": 80,
    "burnPayoutPercent": 100,
    "rarityBaseValues": {"common": 25, "rare": 120, "legendary": 600},
    "supplyMultiplierFloor": 0.5,
    "supplyMultiplierCap": 3.0,
    "supplyInitialPrint": {"common": 1500, "rare": 400, "legendary": 100},
    "inventoryCapacity": 50,
    "vaultCapacity": 50
  }', 'Economy defaults (§17 active-card cap, §21 card value, §22 scraper, §23 burner, §24 extinction)')
ON CONFLICT (key) DO NOTHING;
