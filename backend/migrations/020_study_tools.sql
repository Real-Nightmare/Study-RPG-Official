-- Study Tools — Phase 2 Studyield Core gap-fill (master prompt §7.9, §7.10, Study Tools)
-- Focus sessions, mistake notebook, subject puzzles, exam periods/exam centre,
-- and a generic per-user preferences row (used for hide_game_stats).

-- ---------------------------------------------------------------------------
-- Focus sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS focus_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES study_tasks(id) ON DELETE SET NULL,
    subject VARCHAR(120),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    focus_minutes INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'running',  -- running | paused | completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_started ON focus_sessions(user_id, started_at);

-- ---------------------------------------------------------------------------
-- Mistake notebook
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mistakes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(120),
    chapter VARCHAR(255),
    question_text TEXT NOT NULL,
    correct_answer TEXT,
    wrong_answer TEXT,
    category VARCHAR(60),       -- concept | careless | time | guess | other
    cause TEXT,
    correction_note TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open',  -- open | resolved | reopened
    source VARCHAR(40) DEFAULT 'manual',         -- manual | quiz | exam
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_mistakes_user_id ON mistakes(user_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_user_status ON mistakes(user_id, status);

-- ---------------------------------------------------------------------------
-- Subject puzzles (§7.9)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS puzzles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(120) NOT NULL,
    question TEXT NOT NULL,
    choices JSONB NOT NULL,          -- [{ "key": "A", "text": "..." }]
    answer_key VARCHAR(10) NOT NULL,
    explanation TEXT,
    difficulty VARCHAR(20) NOT NULL DEFAULT 'medium',  -- easy | medium | hard
    source VARCHAR(20) NOT NULL DEFAULT 'manual',      -- manual | ai
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_puzzles_user_subject ON puzzles(user_id, subject);

CREATE TABLE IF NOT EXISTS puzzle_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    puzzle_id UUID NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
    subject VARCHAR(120) NOT NULL,
    mode VARCHAR(20) NOT NULL,           -- ranked | practice
    selected_key VARCHAR(10),
    is_correct BOOLEAN NOT NULL,
    shielded BOOLEAN NOT NULL DEFAULT false,
    streak_after INTEGER NOT NULL DEFAULT 0,
    personal_best INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_user ON puzzle_attempts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_puzzle ON puzzle_attempts(puzzle_id);

CREATE TABLE IF NOT EXISTS puzzle_streaks (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(120) NOT NULL,
    streak INTEGER NOT NULL DEFAULT 0,
    personal_best INTEGER NOT NULL DEFAULT 0,
    daily_ranked_count INTEGER NOT NULL DEFAULT 0,
    last_ranked_day DATE,
    last_ranked_puzzle_id UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, subject)
);

-- ---------------------------------------------------------------------------
-- Exam periods / exam centre (§7.10)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_periods_user ON exam_periods(user_id, start_date);

-- Exams from migration 016 get period linkage + mark scheme / past paper metadata
ALTER TABLE exams ADD COLUMN IF NOT EXISTS period_id UUID REFERENCES exam_periods(id) ON DELETE SET NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS mark_scheme_url TEXT;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS past_paper_url TEXT;

CREATE INDEX IF NOT EXISTS idx_exams_period_id ON exams(period_id);

CREATE TABLE IF NOT EXISTS exam_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    marks_obtained NUMERIC(6,2) NOT NULL,
    marks_total NUMERIC(6,2) NOT NULL,
    mistake_analysis TEXT,
    revision_plan TEXT,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_results_user ON exam_results(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam ON exam_results(exam_id);

-- ---------------------------------------------------------------------------
-- User preferences (hide_game_stats etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    hide_game_stats BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
