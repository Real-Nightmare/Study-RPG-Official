-- Study RPG foundation — Phase 4 (master prompt §10–§14)
-- Config-driven stats, STP/SLC wallet with immutable ledger, original cards,
-- 5-card decks with restricted abilities, and a deterministic battle engine.

-- ---------------------------------------------------------------------------
-- Configuration (levels, battle defaults, reward limits)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Player profiles (stats + wallet balance)
-- STP (StudyPoints) is the single internal fictional currency — also known as
-- SLC. One balance, one ledger; no conversion.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS player_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    event_exp INTEGER NOT NULL DEFAULT 0,
    stp INTEGER NOT NULL DEFAULT 0,
    battle_rating INTEGER NOT NULL DEFAULT 1000,
    study_streak INTEGER NOT NULL DEFAULT 0,
    best_puzzle_streak INTEGER NOT NULL DEFAULT 0,
    current_world VARCHAR(50) DEFAULT 'overworld',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Wallet ledger (immutable; every mutation appends a row)
-- Single currency: STP (a.k.a. SLC).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallet_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL DEFAULT 'STP' CHECK (currency = 'STP'),
    amount INTEGER NOT NULL,
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    transaction_type VARCHAR(40) NOT NULL,
    reason TEXT,
    related_entity_id VARCHAR(80),
    idempotency_key VARCHAR(120) NOT NULL,
    actor VARCHAR(40) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_ledger_idempotency ON wallet_ledger(user_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_created ON wallet_ledger(user_id, created_at);

-- ---------------------------------------------------------------------------
-- Card definitions (data-driven abilities, §13.7) + ownership
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS card_definitions (
    key VARCHAR(60) PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    rarity VARCHAR(20) NOT NULL DEFAULT 'common',  -- common | rare | legendary
    category VARCHAR(30) NOT NULL,                 -- attack | poison | decay | shield | heal | mana | buff | debuff | abstracted ...
    ability JSONB NOT NULL,                        -- full §13.7 ability object
    lore TEXT,
    balance_version VARCHAR(20) NOT NULL DEFAULT '1.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS card_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_key VARCHAR(60) NOT NULL REFERENCES card_definitions(key),
    source VARCHAR(30) NOT NULL DEFAULT 'starter', -- starter | reward | loot | trade | burn
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_instances_user ON card_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_card_instances_user_key ON card_instances(user_id, card_key);

-- ---------------------------------------------------------------------------
-- Decks (5 cards, restricted abilities)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'My Deck',
    is_active BOOLEAN NOT NULL DEFAULT false,
    validated BOOLEAN NOT NULL DEFAULT true,
    invalid_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id);

CREATE TABLE IF NOT EXISTS deck_cards (
    deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    card_instance_id UUID NOT NULL REFERENCES card_instances(id) ON DELETE CASCADE,
    slot INTEGER NOT NULL CHECK (slot BETWEEN 0 AND 4),
    PRIMARY KEY (deck_id, slot),
    UNIQUE (deck_id, card_instance_id)
);

-- ---------------------------------------------------------------------------
-- Battles (server-authoritative, deterministic, replayable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS battles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deck_id UUID REFERENCES decks(id) ON DELETE SET NULL,
    seed INTEGER NOT NULL,
    subject VARCHAR(120),
    world VARCHAR(50) DEFAULT 'overworld',
    monster_key VARCHAR(60),
    player_hp INTEGER NOT NULL,
    player_mana INTEGER NOT NULL,
    monster_hp INTEGER NOT NULL,
    turn INTEGER NOT NULL DEFAULT 1,
    shield_remaining INTEGER NOT NULL DEFAULT 0,
    statuses JSONB NOT NULL DEFAULT '[]',
    phase VARCHAR(30) NOT NULL DEFAULT 'active',  -- active | player_won | monster_won | forfeited
    state JSONB NOT NULL DEFAULT '{}',             -- full engine state for authoritative replay
    hand JSONB NOT NULL DEFAULT '[]',              -- deck cards in hand (instanceId, cardKey, ability)
    reward_claimed BOOLEAN NOT NULL DEFAULT false,
    reward_idempotency_key VARCHAR(120),
    used_question_ids JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_battles_user ON battles(user_id, created_at);

CREATE TABLE IF NOT EXISTS battle_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
    turn INTEGER NOT NULL,
    sequence INTEGER NOT NULL,
    event_type VARCHAR(40) NOT NULL,  -- start | action | damage | dot_damage | heal | shield | status | mana | quiz | challenge | defeat | reward | end
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_battle_log_battle ON battle_log(battle_id, turn, sequence);

-- ---------------------------------------------------------------------------
-- Config seed: battle defaults (§12) + level thresholds + reward limits
-- ---------------------------------------------------------------------------
INSERT INTO game_config (key, value, description) VALUES
  ('rpg.battle.defaults', '{"maxHp": 100, "maxMana": 100, "deckSize": 5, "normalAbilityManaCost": 20, "abstractedAbilityManaCost": 40, "shieldTurns": 2, "manaQuizQuestions": 5, "manaPerCorrect": 4, "manaQuizMaxRestore": 20, "damageChallengeQuestions": 5, "damageChallengeBonus": 10, "basicAttackDamage": 10, "poisonBonus": 10}', 'Battle engine defaults (§12, §13.4, §13.5, §13.6)'),
  ('rpg.levels', '{"thresholds": [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500, 10000, 13000, 16500, 20000, 24000, 28500, 33500, 39000, 45000, 52000]}', 'XP thresholds per player level'),
  ('rpg.rewards', '{"battleWinXp": 50, "battleWinStp": 40, "battleLossXp": 15, "dailyBattleRewardLimit": 10, "dailyRewardLimitStp": 200, "dailyRewardLimitXp": 300}', 'Battle reward amounts and anti-farming daily limits')
ON CONFLICT (key) DO NOTHING;
