-- 028_study_integrity.sql
-- Study RPG Integrity (spec 014): metacognitive campfire reflections + the
-- `rpg.integrity` game_config seed that drives reward math, behavioural
-- rate limits, focus-session verification, and campfire thresholds.
--
-- Unique prefix 028, ordered after 027_study_hardening.sql.

-- ---------------------------------------------------------------------------
-- Campfire reflections: one row per answered reflection (single targeted
-- synthesis question asked by the AI tutor before a student cashes in
-- session rewards or logs off). depth_score (0-100) maps to a 1.0x-1.5x
-- reward multiplier (depth >= 80 => 1.5x). Idempotent per (user, day_key,
-- source_kind, source_id) so replays cannot double-apply.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campfire_reflections (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT,
    depth_score INTEGER,
    multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.00,
    source_kind VARCHAR(50) NOT NULL DEFAULT 'session',  -- session | battle | quiz | exam | teach_back
    source_id VARCHAR(255),
    context JSONB NOT NULL DEFAULT '{}',
    day_key VARCHAR(20) NOT NULL,                         -- YYYY-MM-DD (IST)
    status VARCHAR(20) NOT NULL DEFAULT 'pending',        -- pending | answered | skipped
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    answered_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, day_key, source_kind, source_id)
);

CREATE INDEX IF NOT EXISTS idx_campfire_reflections_user_day
  ON campfire_reflections (user_id, day_key);

-- Focus-session verification stamp (anti-cheese, US2/FR-004): the service
-- records the engagement verdict, server-clock minutes, and the granted
-- (daily-capped) minutes so passive-timer farming is auditable.
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS verification JSONB;

-- ---------------------------------------------------------------------------
-- rpg.integrity config seed. Every value has a code default in
-- integrity-config.ts; this row is the tunable override (mirror the keys).
-- ---------------------------------------------------------------------------
INSERT INTO game_config (key, value)
VALUES ('rpg.integrity', '{
  "rewards": {
    "quiz":        { "baseXp": 12, "stpPassThreshold": 90, "stpOnPass": 25, "dailyStpCap": 75 },
    "exam":        { "baseXp": 30, "stpPassThreshold": 80, "stpOnPass": 40, "dailyStpCap": 120, "dailyAttemptCap": 5 },
    "teachBack":   { "baseXp": 30, "stpPassThreshold": 70, "stpOnPass": 30, "dailyStpCap": 60, "minExplanationChars": 80 },
    "battle":      { "integrityFloor": 0.60, "maxPremiumMultiplier": 2.0 }
  },
  "guards": {
    "quizAttemptsPerHour": 12,
    "minMsPerQuestion": 4000,
    "examAttemptsPerDay": 5,
    "focusDailyCapMinutes": 240,
    "focusMinMinutes": 10,
    "focusUnverifiedExpFactor": 0.35,
    "focusEngagementWindowMinutes": 120
  },
  "campfire": {
    "maxPerDay": 3,
    "depthForFullMultiplier": 80,
    "maxMultiplier": 1.5,
    "baseMultiplier": 1.0,
    "minAnswerChars": 60
  }
}')
ON CONFLICT (key) DO NOTHING;
