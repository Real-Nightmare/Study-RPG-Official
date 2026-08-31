-- Migration 032: Playable character archetypes
-- Schema-identical to upstream; comments and character definitions are original.

-- Add character_key column to player_profiles if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_profiles' AND column_name = 'character_key'
  ) THEN
    ALTER TABLE player_profiles ADD COLUMN character_key VARCHAR(50) DEFAULT NULL;
  END IF;
END $$;

-- Characters table
CREATE TABLE IF NOT EXISTS characters (
  key VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  lore TEXT NOT NULL,
  stat_modifiers JSONB NOT NULL DEFAULT '{}',
  starter_deck JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the 6 original Study RPG character archetypes
INSERT INTO characters (key, name, lore, stat_modifiers, starter_deck) VALUES
  (
    'lorekeeper',
    'The Lorekeeper',
    'Keeper of forgotten knowledge. Their memory is their weapon — flashcards hit harder, spaced repetition cuts deeper.',
    '{"memory_bonus": 1.2, "xp_per_review": 1.15, "flashcard_speed": 1.1}',
    '["recall_bolt", "mnemonic_shield", "focus_flare", "wisdom_drain", "lore_wall"]'
  ),
  (
    'focuser',
    'The Focuser',
    'Masters of sustained concentration. Longer sessions, calmer minds, fewer distractions. The mind is still water.',
    '{"session_stamina": 1.3, "rest_recovery": 1.2, "distraction_resist": 1.15}',
    '["deep_breath", "focus_beam", "calm_wave", "tireless_spirit", "quiet_mind"]'
  ),
  (
    'solver',
    'The Solver',
    'Born to untangle problems. Their algorithms are sharp and their logic is relentless. Every mistake is a lesson.',
    '{"problem_xp": 1.25, "quiz_accuracy": 1.1, "mistake_resolve": 1.2}',
    '["logic_strike", "proof_shield", "algorithm_burst", "deduction_drain", "theorem_wall"]'
  ),
  (
    'duelist',
    'The Duelist',
    'Thrives on competition. Higher starting battle rating, sharper opening moves, faster mana regeneration.',
    '{"battle_rating_start": 1200, "mana_regen": 1.15, "opening_move_bonus": 1.1}',
    '["quick_strike", "counter_guard", "duel_rush", "mana_surge", "riposte"]'
  ),
  (
    'alchemist',
    'The Alchemist',
    'Transforms knowledge into value. Card burns yield more, marketplace fees are lower, supply calculations are precise.',
    '{"burn_value": 1.3, "marketplace_fee_reduction": 0.9, "scrape_bonus": 1.2}',
    '["transmute", "value_shield", "market_burst", "supply_drain", "alchemic_wall"]'
  ),
  (
    'warden',
    'The Warden',
    'Protector of progress. Streaks are harder to break, rest is strategic, resilience is their armor.',
    '{"streak_shield": 1.25, "exhaustion_resist": 1.2, "rest_bonus": 1.15}',
    '["guardian_blessing", "streak_shield", "resilience_wave", "rest_aura", "warden_wall"]'
  )
ON CONFLICT (key) DO NOTHING;

-- Seed character data into game_config for RPG system
INSERT INTO game_config (key, value, updated_at)
VALUES (
  'rpg.characters',
  '{"archetypes": ["lorekeeper", "focuser", "solver", "duelist", "alchemist", "warden"], "respec_token_level": 10, "max_respec_tokens": 1}'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
