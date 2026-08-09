-- Study RPG Advanced Learning — PDF Phase 8 (master prompt §31–§36 follow-ups)
-- Programme templates, review history, and linking AI-built programmes into
-- personal learning paths. Unique prefix 026, ordered after 025.

-- ============================================================
-- 1. Learning paths: source programme link
-- ============================================================
ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS programme_id UUID REFERENCES programmes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_learning_paths_programme ON learning_paths(programme_id);

-- ============================================================
-- 2. Programme templates (admin-curated outlines; users instantiate)
-- ============================================================
CREATE TABLE IF NOT EXISTS programme_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(120) NOT NULL,
    description TEXT,
    kind VARCHAR(40) NOT NULL DEFAULT 'custom',  -- custom | revision_centre | competency_testing | exam_sprint
    outline JSONB NOT NULL DEFAULT '{}',         -- objectives/milestones/reward guidance for the AI build
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_programme_templates_active ON programme_templates(active, kind);

-- ============================================================
-- 3. Programme review history (AI + admin, capped in code)
-- ============================================================
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS review_history JSONB NOT NULL DEFAULT '[]';

-- ============================================================
-- 4. Seed templates: the three programme shapes the owner asked for
-- ============================================================
INSERT INTO programme_templates (id, name, description, kind, outline, active) VALUES
  (
    '00000000-0000-4000-8000-0000000000c1',
    'Revision Centre',
    'A structured revision programme that revisits every chapter of a subject before exams, spaced across milestones.',
    'revision_centre',
    '{"objectives": ["Revise every chapter of the subject", "Convert weak topics into active recall sets", "Complete a timed mock before the exam period"], "milestones": [{"title": "Chapter sweep", "weeks": 2, "activities": ["Create flashcards per chapter", "Run one ranked puzzle per chapter"]}, {"title": "Weak-topic attack", "weeks": 1, "activities": ["Re-study weak topics flagged by quizzes", "Log mistakes and resolve them"]}, {"title": "Mock and review", "weeks": 1, "activities": ["Attempt a timed mock quiz", "Revise mistakes and re-quiz"]}], "rewardGuidance": {"kind": "stp", "amount": 150, "criteria": "Complete all milestones before the exam period"}}',
    TRUE
  ),
  (
    '00000000-0000-4000-8000-0000000000c2',
    'Competency Based Testing',
    'Practise the exact skill-based question formats used in competency exams — case studies, source-based and assertion-reason questions.',
    'competency_testing',
    '{"objectives": ["Master case-study and source-based question formats", "Practise assertion-reason questions daily", "Track accuracy by competency, not just chapter"], "milestones": [{"title": "Format familiarity", "weeks": 1, "activities": ["Solve 5 case-study questions", "Solve 5 assertion-reason questions"]}, {"title": "Speed and accuracy", "weeks": 2, "activities": ["Daily timed competency quiz", "Review mistakes by competency"]}, {"title": "Full simulation", "weeks": 1, "activities": ["One full competency mock", "Teach back one solved case to a friend"]}], "rewardGuidance": {"kind": "xp", "amount": 300, "criteria": "Reach 75% accuracy on the full simulation"}}',
    TRUE
  ),
  (
    '00000000-0000-4000-8000-0000000000c3',
    'Exam Sprint',
    'A short, intense countdown programme for the final weeks before an exam — daily focus, targeted quizzes and revision.',
    'exam_sprint',
    '{"objectives": ["Study in daily focus sessions with a fixed plan", "Hit a daily quiz accuracy target", "Finish one full revision pass before the exam"], "milestones": [{"title": "Launch", "weeks": 1, "activities": ["Set daily focus sessions on the syllabus", "Complete the first chapter quiz"]}, {"title": "Push", "weeks": 2, "activities": ["Daily ranked puzzles", "Weekly full mock with mistake log"]}, {"title": "Taper", "weeks": 1, "activities": ["Light review of all weak topics", "Final timed mock"]}], "rewardGuidance": {"kind": "badge", "amount": 1, "criteria": "Complete every sprint milestone before exam day"}}',
    TRUE
  )
ON CONFLICT (id) DO NOTHING;
