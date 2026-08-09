## Why

Phase 2 (Studyield Core) has four planned Study Tools that remain unimplemented: Focus sessions (recording), Mistake notebook, Subject Puzzles, and Exam periods/Exam centre enhancements. These are the last Studyield Core items flagged in `IMPLEMENTATION_STATUS.md` as ⏳ gap-fill, and the master prompt (§7.9, §7.10, "Study Tools" section) specifies them in detail. Completing them together finishes the Study Tools layer before the game-layer features in Phase 4.

## What Changes

Adds four user-facing study tools, each with a backend module (raw SQL, per-user data, ownership checks) and a polished dashboard page wired into the router/nav with all 15 locales:

1. **Focus sessions** — recording of study sessions (start/pause/resume/stop with task + subject links, accumulated focus minutes, session history, per-day summary for the dashboard).
2. **Mistake notebook** — per-user mistake records (question text, subject/chapter links, category, cause, resolution status, correct answer notes), CRUD + filter + resolve/reopen.
3. **Subject puzzles** — per-subject original puzzles (question, choices, answer, explanation), ranked vs practice modes, per-subject streak state (correct ranked → streak up, incorrect → reset), attempt history, personal best, "never reuse same ranked puzzle immediately" rule, daily ranked limit metadata.
4. **Exam periods / Exam centre** — exam period calendar (start/end dates), exams bound to periods with status (upcoming/live/ended), mark scheme/past paper metadata, exam results recording with mistake analysis, revision plan notes, and a "nearest exam" endpoint that the dashboard uses for the recommended study action.

## Capabilities

### New Capabilities
- `studyield-core`: Focus sessions, mistake notebook, subject puzzles, and exam periods/exam centre as a unified Study Tools capability with per-user ownership.

### Modified Capabilities
_(none — first time these Study Tools are spec'd; academic structure exists but is not spec'd in OpenSpec yet)_

## Impact

- `backend/migrations/020_study_tools.sql` — new tables: `focus_sessions`, `mistakes`, `puzzles`, `puzzle_attempts`, `exam_periods`, plus exam-period columns on `exams`.
- New backend modules: `focus-sessions`, `mistakes`, `puzzles`, `exam-periods` (each: dto + service + controller + module + barrel + registration in `app.module.ts`), following the `planner/` pattern.
- New frontend pages under `pages/dashboard/`: `FocusSessionsPage`, `MistakesPage`, `PuzzlesPage`, `ExamCentrePage`; new services; new locale keys in all 15 locale files.
- Unit tests for streak/attempt logic and ownership rules.
