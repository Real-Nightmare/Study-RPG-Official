-- Study RPG PvP — Phase 5 (master prompt Phase 5: PvP, ranked battle rating)
-- Async Seeker Duels: challenge a player or matchmake by battle rating; each
-- side fights a deterministic ghost avatar of the opponent's deck snapshot;
-- the duel settles into a winner + Elo rating change + STP/XP rewards.

-- ---------------------------------------------------------------------------
-- PvP duels
-- Deck snapshots capture the opponent's active deck at challenge time so a
-- duel is immutable once created. Ratings before/after make the ledger of
-- rating changes auditable. Margins record remaining HP% + turns for both
-- decisive and HP%-based outcomes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pvp_duels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    defender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'challenged', -- challenged | in_progress | settled | expired
    challenger_deck JSONB NOT NULL DEFAULT '[]',      -- [{ cardKey, rarity, ability }]
    defender_deck JSONB NOT NULL DEFAULT '[]',
    challenger_battle_id UUID REFERENCES battles(id) ON DELETE SET NULL,
    defender_battle_id UUID REFERENCES battles(id) ON DELETE SET NULL,
    challenger_rating_before INTEGER NOT NULL DEFAULT 1000,
    defender_rating_before INTEGER NOT NULL DEFAULT 1000,
    challenger_rating_after INTEGER,
    defender_rating_after INTEGER,
    winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    margins JSONB,                                    -- { challengerHpPct, defenderHpPct, challengerTurns, defenderTurns }
    rewards JSONB,                                    -- granted rewards: { xp, stp, limited }
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    settled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pvp_duels_challenger ON pvp_duels(challenger_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pvp_duels_defender ON pvp_duels(defender_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pvp_duels_status ON pvp_duels(status, expires_at);

-- Link PvP battles back to their duel (world 'pvp', monster 'pvp_ghost').
ALTER TABLE battles ADD COLUMN IF NOT EXISTS pvp_duel_id UUID REFERENCES pvp_duels(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_battles_pvp_duel ON battles(pvp_duel_id);

-- ---------------------------------------------------------------------------
-- Config seed: PvP defaults (§ Phase 5 — PvP)
--   ghostHpBase        base HP of a deck ghost
--   ghostHpPerRare     +HP per rare card in the deck
--   ghostHpPerLegendary +HP per legendary card in the deck
--   ghostAttackBase    base attack of a deck ghost
--   ratingK            Elo K-factor
--   winStp / winXp     winner rewards (STP + XP)
--   lossXp             consolation XP for the loser
--   dailyPvpWinLimit   anti-farming cap on rewarded PvP wins per day
--   expiryHours        how long a challenged duel stays open
--   ratingWindow       initial matchmaking rating window (±)
-- ---------------------------------------------------------------------------
INSERT INTO game_config (key, value, description) VALUES
  ('rpg.pvp', '{"ghostHpBase": 100, "ghostHpPerRare": 6, "ghostHpPerLegendary": 12, "ghostAttackBase": 6, "ratingK": 32, "winStp": 60, "winXp": 80, "lossXp": 20, "dailyPvpWinLimit": 10, "expiryHours": 48, "ratingWindow": 150}', 'PvP duel defaults: ghost avatar derivation, Elo K, rewards, anti-farming, expiry')
ON CONFLICT (key) DO NOTHING;
