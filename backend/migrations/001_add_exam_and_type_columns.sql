-- Study sets gain optional exam metadata (date + subject) so revision
-- can be scheduled around a real exam.
ALTER TABLE study_sets ADD COLUMN IF NOT EXISTS exam_date TIMESTAMP;
ALTER TABLE study_sets ADD COLUMN IF NOT EXISTS exam_subject VARCHAR(255);

-- Flashcards distinguish card kinds (standard, cloze, occlusion, ...).
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'standard';

-- Legacy XP feed: every gamification grant is recorded as an event row.
-- (The RPG wallet ledger supersedes this for currency; XP events remain
-- the activity feed source.)
CREATE TABLE IF NOT EXISTS user_xp_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_xp_events_user_id ON user_xp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_xp_events_created_at ON user_xp_events(created_at);
