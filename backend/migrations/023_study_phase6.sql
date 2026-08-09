-- Study Community — Phase 6 (master prompt: community layer)
-- Admin/audit, AI-built programmes, factions, social (friends + DMs),
-- RPG party battles + exam bosses, universal admin notes, admin syllabus.
-- Also: email-optional auth (users.username, nullable email, is_active).

-- ============================================================
-- Users: email-optional auth
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(60);
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;

-- ============================================================
-- Audit log (admin actions, reason required)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(120) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    reason TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- ============================================================
-- Programmes (AI-built; factions are programmes too)
-- ============================================================
CREATE TABLE IF NOT EXISTS programmes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(160) NOT NULL,
    description TEXT,
    kind VARCHAR(40) NOT NULL DEFAULT 'custom', -- custom | revision_centre | competency_testing | faction
    status VARCHAR(20) NOT NULL DEFAULT 'suggested', -- suggested | building | active | rejected | archived
    suggested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ai_built BOOLEAN NOT NULL DEFAULT FALSE,
    content JSONB DEFAULT '{}',      -- objectives, milestones, activities, effort
    reward_policy JSONB DEFAULT '{}', -- { kind, amount, criteria }
    review JSONB DEFAULT '{}',        -- { verdict, score, reasons }
    has_factions BOOLEAN NOT NULL DEFAULT FALSE,
    faction_size INTEGER NOT NULL DEFAULT 7,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_programmes_status ON programmes(status);
CREATE INDEX IF NOT EXISTS idx_programmes_kind ON programmes(kind);
CREATE INDEX IF NOT EXISTS idx_programmes_suggested_by ON programmes(suggested_by);

CREATE TABLE IF NOT EXISTS programme_members (
    programme_id UUID NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (programme_id, user_id)
);

-- ============================================================
-- Factions (teams, auto-balanced)
-- ============================================================
CREATE TABLE IF NOT EXISTS factions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programme_id UUID REFERENCES programmes(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    color VARCHAR(20) DEFAULT 'indigo',
    target_size INTEGER NOT NULL DEFAULT 7,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factions_programme ON factions(programme_id);

CREATE TABLE IF NOT EXISTS faction_members (
    faction_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member', -- member | leader
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (faction_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_faction_members_user ON faction_members(user_id);

CREATE TABLE IF NOT EXISTS faction_score_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    faction_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(60) NOT NULL, -- task_completed | quiz_attempt | xp_earned | study_session
    points INTEGER NOT NULL DEFAULT 0,
    period_key VARCHAR(7) NOT NULL, -- YYYY-MM (IST)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faction_score_period ON faction_score_events(faction_id, period_key);

CREATE TABLE IF NOT EXISTS faction_votes (
    faction_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_key VARCHAR(7) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (faction_id, voter_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_faction_votes_candidate ON faction_votes(candidate_id, period_key);

CREATE TABLE IF NOT EXISTS faction_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    faction_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    period_key VARCHAR(7) NOT NULL,
    rank INTEGER NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    reward JSONB DEFAULT '{}',
    settled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (faction_id, period_key)
);

CREATE TABLE IF NOT EXISTS faction_help_pledges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    helper_faction_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    helped_faction_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    period_key VARCHAR(7) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- open | fulfilled | forfeited
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (helper_faction_id, helped_faction_id, period_key)
);

CREATE TABLE IF NOT EXISTS faction_help_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pledge_id UUID REFERENCES faction_help_pledges(id) ON DELETE CASCADE,
    faction_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(40) NOT NULL DEFAULT 'help',
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Social: friendships + direct messages
-- ============================================================
CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | accepted | blocked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id, status);

CREATE TABLE IF NOT EXISTS direct_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_pair ON direct_messages(sender_id, recipient_id, created_at);

-- ============================================================
-- RPG party battles + exam bosses
-- ============================================================
CREATE TABLE IF NOT EXISTS rpg_parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    leader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    max_members INTEGER NOT NULL DEFAULT 4,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rpg_party_members (
    party_id UUID NOT NULL REFERENCES rpg_parties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (party_id, user_id)
);

CREATE TABLE IF NOT EXISTS rpg_party_battles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    party_id UUID NOT NULL REFERENCES rpg_parties(id) ON DELETE CASCADE,
    boss_key VARCHAR(80) NOT NULL,
    exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
    seed INTEGER NOT NULL,
    state JSONB NOT NULL DEFAULT '{}',
    phase VARCHAR(20) NOT NULL DEFAULT 'active', -- active | won | lost | forfeited
    reward_claimed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpg_party_battles_party ON rpg_party_battles(party_id);

-- ============================================================
-- Universal admin notes + admin syllabus
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    subject VARCHAR(120),
    content TEXT NOT NULL,
    page_count INTEGER DEFAULT 0,
    selected_pages JSONB DEFAULT '[]',  -- [1,2] or [[1,3],[5,9]] page selections
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    source_document_id UUID,
    is_universal BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notes_subject ON admin_notes(subject);

CREATE TABLE IF NOT EXISTS syllabus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board VARCHAR(100) NOT NULL,
    grade VARCHAR(50) NOT NULL,
    subject VARCHAR(120) NOT NULL,
    chapters JSONB NOT NULL DEFAULT '[]', -- [{ name, topics: [] }]
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (board, grade, subject)
);
