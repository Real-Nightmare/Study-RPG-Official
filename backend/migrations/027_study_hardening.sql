-- Study RPG Hardening — PDF Phase 9 (master prompt §32–§36)
-- Web Push (VAPID) subscriptions, DM moderation config, audit retention config.
-- Unique prefix 027, ordered after 026.

-- ============================================================
-- 1. Standards-based Web Push subscriptions (VAPID)
-- ============================================================
CREATE TABLE IF NOT EXISTS web_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_push_user ON web_push_subscriptions(user_id);

-- ============================================================
-- 2. Security configuration seeds (code defaults apply when absent)
-- ============================================================
INSERT INTO game_config (key, value)
VALUES
  ('security.dm', '{"maxPerMinute": 20}'),
  ('security.audit', '{"retentionDays": 365}')
ON CONFLICT (key) DO NOTHING;
