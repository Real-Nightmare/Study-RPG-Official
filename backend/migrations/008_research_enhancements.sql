-- Research sessions gain a depth preset (quick/standard/deep) and a
-- free-form settings bag for per-run options.
ALTER TABLE research_sessions ADD COLUMN IF NOT EXISTS depth VARCHAR(20) DEFAULT 'standard';
ALTER TABLE research_sessions ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
