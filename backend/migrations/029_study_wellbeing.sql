-- 029_study_wellbeing.sql
-- Study RPG Anti-Overstudy / Health-First rules (spec 015).
--
-- The reward economy deliberately makes excess studying *less* rewarding so the
-- game teaches smarter studying — spaced, bounded, rested — instead of grind.
-- Every value has a code default in `integrity-config.ts` (`overStudy` block);
-- this seed is the tunable override.
--
-- Unique prefix 029, ordered after 028_study_integrity.sql. The overStudy block
-- lives INSIDE the existing `rpg.integrity` config row (the integrity module
-- already reads and merges it), so we merge rather than create a new key.

-- Merge the overStudy block into the existing rpg.integrity row (idempotent:
-- never overwrites a tuned overStudy config).
UPDATE game_config
SET value = value || '{
  "overStudy": {
    "optimalDailyMinutes": 120,
    "decayStartMinutes": 120,
    "hardDailyCapMinutes": 240,
    "minFactor": 0.10,
    "sessionCooldownMinutes": 20,
    "cooldownAfterMinutes": 60,
    "nightStartHour": 22,
    "nightEndHour": 6,
    "nightFactor": 0.50
  }
}'::jsonb,
    updated_at = NOW()
WHERE key = 'rpg.integrity'
  AND NOT (value ? 'overStudy');

-- Belt-and-braces: if the rpg.integrity row is missing entirely (fresh or
-- partial DB), create it with at least the overStudy block; the integrity
-- module deep-merges every other key over its code defaults.
INSERT INTO game_config (key, value, description)
VALUES ('rpg.integrity', '{
  "overStudy": {
    "optimalDailyMinutes": 120,
    "decayStartMinutes": 120,
    "hardDailyCapMinutes": 240,
    "minFactor": 0.10,
    "sessionCooldownMinutes": 20,
    "cooldownAfterMinutes": 60,
    "nightStartHour": 22,
    "nightEndHour": 6,
    "nightFactor": 0.50
  }
}', 'Study RPG integrity + anti-overstudy config (spec 014 + 015)')
ON CONFLICT (key) DO NOTHING;
