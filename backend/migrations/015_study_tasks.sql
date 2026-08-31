-- Study Tasks (Planner) — Phase 2 Study RPG Core
-- Supports: homework, revision, exam preparation, projects, reading, practice,
-- recurring tasks, subtasks, priority, due date, estimated/actual time, subject, chapter.

CREATE TABLE IF NOT EXISTS study_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES study_tasks(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(50) NOT NULL DEFAULT 'homework',
    subject VARCHAR(100),
    chapter VARCHAR(100),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'todo',
    due_date TIMESTAMP WITH TIME ZONE,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    recurrence VARCHAR(20) NOT NULL DEFAULT 'none',
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_tasks_user_id ON study_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_study_tasks_due_date ON study_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_study_tasks_status ON study_tasks(status);
CREATE INDEX IF NOT EXISTS idx_study_tasks_parent_id ON study_tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_study_tasks_user_due ON study_tasks(user_id, due_date);
