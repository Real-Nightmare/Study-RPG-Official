## 1. Migration + schema

- [x] 1.1 Migration `020_study_tools.sql`: `focus_sessions`, `mistakes`, `puzzles`, `puzzle_attempts`, `exam_periods`, `exam_results`, `user_preferences` + `exams` period/mark-scheme/past-paper columns
- [x] 1.2 Pure `puzzle-streak.ts` (streak apply/reset, personal best, daily limit, no-reuse selection helper) + `recommendation.ts` (dashboard next-action rules)

## 2. Focus sessions + mistakes

- [x] 2.1 `FocusSessionsModule`: start/pause/resume/stop/delete + today summary (minutes by subject), ownership checks
- [x] 2.2 `MistakesModule`: CRUD with subject/chapter links, category, cause, status resolve/reopen, filters + counts
- [x] 2.3 Unit tests for both services

## 3. Puzzles + exam periods

- [x] 3.1 `PuzzlesModule`: list by subject, serve next ranked puzzle (no immediate reuse), submit answer (ranked/practice streak logic), attempt history, personal best, daily ranked limit
- [x] 3.2 `ExamPeriodsModule`: period CRUD with derived status, attach exams, record results + mistake analysis, nearest upcoming exam
- [x] 3.3 Unit tests for puzzle-streak integration and period status derivation

## 4. Frontend

- [x] 4.1 Services + types: focus-sessions, mistakes, puzzles, exam-periods
- [x] 4.2 `FocusSessionsPage`, `MistakesPage`, `PuzzlesPage`, `ExamCentrePage` + router + dashboard nav
- [x] 4.3 Locale keys in all 15 files (nav + page namespaces)

## 5. Validation + docs

- [x] 5.1 Backend build/lint/tests + frontend typecheck/build/lint/tests pass
- [x] 5.2 Update `IMPLEMENTATION_STATUS.md` + `CHANGELOG.md`
