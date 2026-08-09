-- Study RPG Events — PDF Phase 7 (master prompt §25–§30)
-- Event scheduler, data-driven quests, StudyPass (14 levels, 1750 EXP),
-- Free/Gold tracks (1500 SLC), the Abstracted event (unabstracting, Abstracted
-- Errors, Limbo) and the Great Extinction event (targets + Extinction Sigils).
-- Unique prefix 025, ordered after 024.

-- ---------------------------------------------------------------------------
-- 1. Events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(60) UNIQUE NOT NULL,
    name VARCHAR(80) NOT NULL,
    story TEXT,
    kind VARCHAR(20) NOT NULL DEFAULT 'normal',     -- normal | fallback
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    grace_hours INTEGER NOT NULL DEFAULT 48,
    claim_deadline TIMESTAMPTZ NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled | active | ended
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_status ON events(status, starts_at);
CREATE INDEX IF NOT EXISTS idx_events_window ON events(starts_at, ends_at);

-- ---------------------------------------------------------------------------
-- 2. Per-user StudyPass state (event EXP is separate from player XP)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_event_state (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    track VARCHAR(10),                              -- NULL | free | gold
    track_locked BOOLEAN NOT NULL DEFAULT FALSE,
    event_exp INTEGER NOT NULL DEFAULT 0,
    claimed_levels JSONB NOT NULL DEFAULT '[]',     -- int[] of claimed level indexes
    gold_paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, event_id)
);

-- ---------------------------------------------------------------------------
-- 3. Data-driven quests (daily | weekly | study | puzzle)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,  -- NULL = evergreen
    slug VARCHAR(80) NOT NULL,
    category VARCHAR(20) NOT NULL,                  -- daily | weekly | study | puzzle
    title VARCHAR(120) NOT NULL,
    story TEXT,
    objective JSONB NOT NULL,                       -- { type, activityType?, target, period? }
    rewards JSONB NOT NULL DEFAULT '{}',            -- { stp?, eventExp?, items?: [{slug,quantity}] }
    period VARCHAR(10) NOT NULL DEFAULT 'none',     -- none | daily | weekly
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (event_id, slug)
);

CREATE TABLE IF NOT EXISTS user_quests (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    period_key VARCHAR(20) NOT NULL DEFAULT '',     -- IST day YYYY-MM-DD | ISO week YYYY-Www | '' for event-long
    progress INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, quest_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_user_quests_user ON user_quests(user_id);

-- ---------------------------------------------------------------------------
-- 4. Event items (Abstracted Errors, Extinction Sigils)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    slug VARCHAR(60) UNIQUE NOT NULL,
    name VARCHAR(80) NOT NULL,
    description TEXT,
    tradable BOOLEAN NOT NULL DEFAULT FALSE,
    max_quantity INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_event_items (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES event_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, item_id)
);

-- ---------------------------------------------------------------------------
-- 5. Abstracted instances (unabstracting + Limbo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS abstracted_instances (
    card_instance_id UUID PRIMARY KEY REFERENCES card_instances(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    legendary_result_key VARCHAR(60) NOT NULL,
    unabstracted_at TIMESTAMPTZ,
    unabstracted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 6. Great Extinction targets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_extinction_targets (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    card_key VARCHAR(60) NOT NULL REFERENCES card_definitions(key),
    target_order INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    PRIMARY KEY (event_id, card_key)
);

-- ---------------------------------------------------------------------------
-- 7. Global milestones (Great Extinction) + per-user one-shot claims
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_global_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    slug VARCHAR(60) NOT NULL,
    title VARCHAR(120) NOT NULL,
    objective JSONB NOT NULL,                       -- { type: 'targeted_burns', target }
    progress INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    reward JSONB NOT NULL DEFAULT '{}',             -- { items: [{slug, quantity}] }
    UNIQUE (event_id, slug)
);

CREATE TABLE IF NOT EXISTS user_milestone_claims (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    milestone_id UUID NOT NULL REFERENCES event_global_milestones(id) ON DELETE CASCADE,
    claimed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, milestone_id)
);

-- ---------------------------------------------------------------------------
-- 8. game_config: rpg.events (mirrors DEFAULT_EVENTS_CONFIG in events-config.ts)
-- ---------------------------------------------------------------------------
INSERT INTO game_config (key, value, description) VALUES ('rpg.events', '{
  "goldCost": 1500,
  "studyPassLevels": [0, 100, 200, 300, 400, 550, 700, 900, 1100, 1300, 1450, 1550, 1650, 1750],
  "expByActivity": {"task_completed": 25, "study_session": 10, "quiz_attempt": 30, "puzzle_solved": 20, "battle_win": 40, "boss_win": 120},
  "fallback": {"slug": "study-sprint", "name": "Study Sprint", "durationDays": 14, "graceHours": 48},
  "abstracted": {
    "slug": "abstracted",
    "name": "Abstracted",
    "abilityCostMana": 40,
    "unabstractStp": 500,
    "errorsForLimbo": 7,
    "limboRewardCard": "limbo_warden",
    "defaultLegendaryResultKey": "awakened_guardian",
    "freeTrack": [
      {"stp": 100}, {"loot": "normal"}, {"stp": 75}, {"loot": "common"}, {"stp": 125},
      {"loot": "uncommon"}, {"stp": 200}, {"loot": "rare"}, {"stp": 100, "loot": "normal"},
      {"item": "abstracted_fragment"}, {"card": "event_echo_courier"}, {"stp": 300},
      {"loot": "epic_chance"}, {"card": "abstracted_recluse"}
    ],
    "goldTrack": [
      {"stp": 200}, {"loot": "boosted"}, {"loot": "event"}, {"stp": 200}, {"card": "event_echo_courier"},
      {"loot": "rare"}, {"stp": 300}, {"card": "event_sigil_warden"}, {"stp": 150, "loot": "boosted"},
      {"loot": "epic_chance"}, {"card": "event_echo_courier", "stp": 200}, {"stp": 500},
      {"loot": "legendary_chance"}, {"card": "abstracted_recluse"}
    ]
  },
  "extinction": {
    "slug": "great-extinction",
    "name": "The Great Extinction",
    "targetCount": 10,
    "commonRareTargets": 5,
    "legendaryTargets": 5,
    "sigilItemSlug": "extinction_sigil"
  },
  "lootBoxes": {
    "normal": {"label": "Normal Loot Box", "weights": {"common": 70, "rare": 25, "legendary": 5}},
    "common": {"label": "Common Loot Box", "weights": {"common": 55, "rare": 35, "legendary": 10}},
    "uncommon": {"label": "Uncommon+ Loot Box", "weights": {"common": 40, "rare": 45, "legendary": 15}},
    "boosted": {"label": "Boosted Loot Box", "weights": {"common": 30, "rare": 50, "legendary": 20}},
    "event": {"label": "Event Loot Box", "weights": {"common": 25, "rare": 50, "legendary": 25}},
    "rare": {"label": "Rare Loot Box", "weights": {"common": 10, "rare": 60, "legendary": 30}},
    "epic_chance": {"label": "Epic-Chance Event Loot Box", "weights": {"common": 0, "rare": 45, "legendary": 55}},
    "legendary_chance": {"label": "Legendary-Chance Event Loot Box", "weights": {"common": 0, "rare": 25, "legendary": 75}}
  }
}', 'Events config (PDF Phase 7 §25–§30): StudyPass thresholds, Free/Gold tracks, activity EXP, loot-box odds, Abstracted + Great Extinction settings') ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. Seeds: events, quests, event items
-- ---------------------------------------------------------------------------
INSERT INTO events (id, slug, name, story, kind, starts_at, ends_at, grace_hours, claim_deadline, config, status) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'abstracted', 'Abstracted',
   'Reality is fraying at the edges of the Studyverse. Glitched fragments of forgotten lessons drift through the halls, whispering half-remembered answers. The Void Recluse has begun unmaking the world — but only by studying the seams between what you know and what you do not will the truth resurface. Master the Abstracted cards, complete your StudyPass, and earn the seven Errors that open the door to Limbo.',
   'normal',
   NOW(), NOW() + INTERVAL '30 days', 48, NOW() + INTERVAL '32 days',
   '{"studyPass": true, "shop": {}}', 'active'),
  ('00000000-0000-4000-8000-0000000000a2', 'great-extinction', 'The Great Extinction',
   'A silent eclipse has crossed the Studyverse. Ten old card lines are fading into memory, their ink dissolving page by page. The Archivists insist the burning is necessary — but they also whisper of the Extinction Sigil, a token that can preserve a beloved card from the void. Choose what you keep, complete the global pyre, and decide what survives the Great Extinction.',
   'normal',
   NOW() + INTERVAL '30 days', NOW() + INTERVAL '60 days', 48, NOW() + INTERVAL '62 days',
   '{"studyPass": true, "extinction": {"targetCount": 10, "commonRareTargets": 5, "legendaryTargets": 5}, "shop": {}}',
   'scheduled')
ON CONFLICT (slug) DO NOTHING;

-- Quests for the Abstracted event (original, study-first)
INSERT INTO quests (id, event_id, slug, category, title, story, objective, rewards, period, sort_order) VALUES
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000a1', 'daily-quota', 'daily',
   'Clear the Daily Quota',
   'Complete three study tasks today to keep the syllabus storm at bay.',
   '{"type": "study_activity", "activityType": "task_completed", "target": 3, "period": "day"}',
   '{"stp": 50, "eventExp": 40}', 'daily', 1),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000a1', 'deep-work-hour', 'daily',
   'Deep Work Hour',
   'Bank sixty focused minutes of study in a single day. No distractions, no shortcuts — just focus.',
   '{"type": "study_activity", "activityType": "study_session", "target": 60, "period": "day"}',
   '{"stp": 60, "eventExp": 50}', 'daily', 2),
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000a1', 'puzzle-runner', 'puzzle',
   'Riddle Runner',
   'Solve three subject puzzles today and prove your mind is quicker than the glitches.',
   '{"type": "study_activity", "activityType": "puzzle_solved", "target": 3, "period": "day"}',
   '{"stp": 75, "eventExp": 60}', 'daily', 3),
  ('00000000-0000-4000-8000-0000000000c4', '00000000-0000-4000-8000-0000000000a1', 'quiz-crusher', 'study',
   'Quiz Crusher',
   'Submit five quiz attempts this week. Every attempt — win or lose — is knowledge banked.',
   '{"type": "study_activity", "activityType": "quiz_attempt", "target": 5, "period": "week"}',
   '{"stp": 150, "eventExp": 120}', 'weekly', 4),
  ('00000000-0000-4000-8000-0000000000c5', '00000000-0000-4000-8000-0000000000a1', 'boss-breaker', 'study',
   'Boss Breaker',
   'Win three battles during the Abstracted event. Exam bosses count double — the syllabus fears you.',
   '{"type": "study_activity", "activityType": "battle_win", "target": 3, "period": "event"}',
   '{"stp": 200, "eventExp": 150}', 'none', 5),
  ('00000000-0000-4000-8000-0000000000c6', '00000000-0000-4000-8000-0000000000a2', 'pyre-duty', 'study',
   'Pyre Duty',
   'Burn two targeted cards in the Great Extinction. The Archivists remember every sacrifice.',
   '{"type": "burn_targets", "target": 2, "period": "event"}',
   '{"stp": 300, "items": [{"slug": "extinction_sigil", "quantity": 1}]}', 'none', 1),
  ('00000000-0000-4000-8000-0000000000c7', '00000000-0000-4000-8000-0000000000a2', 'preserve-a-favourite', 'study',
   'Preserve a Favourite',
   'Present an Extinction Sigil to shield a card you love from the void. Burning is encouraged — never unavoidable.',
   '{"type": "consume_sigil", "target": 1, "period": "event"}',
   '{"stp": 250, "eventExp": 180}', 'none', 2)
ON CONFLICT (event_id, slug) DO NOTHING;

-- Event items
INSERT INTO event_items (id, event_id, slug, name, description, tradable) VALUES
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'abstracted_error', 'Abstracted Error',
   'A fragment of the unraveled syllabus. Collect seven to unlock Limbo.', FALSE),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a1', 'abstracted_fragment', 'Abstracted Fragment',
   'A shimmering shard of Abstracted knowledge, prized by collectors of the strange.', FALSE),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000a2', 'extinction_sigil', 'Extinction Sigil',
   'A tradeable token that preserves a card from the Great Extinction. Earn it by burning, by study, by milestone — or trade for it.', TRUE)
ON CONFLICT (slug) DO NOTHING;
