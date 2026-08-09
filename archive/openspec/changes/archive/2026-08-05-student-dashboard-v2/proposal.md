## Why

The master prompt §7.2 specifies the Student Dashboard as the home surface of Studyield: today's study plan, tasks due, upcoming exams, current exam portions, focus time, flashcards due, revision queue, weak topics, recent mistakes, quiz accuracy, puzzle streaks, study streak, STP earned today, player XP, current event EXP, daily quests, recommended next study action — and the ability to hide game statistics entirely. The current `DashboardHomePage` is a 510-line static page that does not aggregate live data or support the hide-game-stats toggle.

## What Changes

Replaces the dashboard home with a data-driven, widget-grid layout backed by a new aggregate endpoint:

1. **`GET /dashboard/summary`** — one ownership-scoped query bundle returning: today's study plan (tasks due today + due now), upcoming exams, current exam portions, focus minutes today, flashcards due, quiz accuracy (30-day), recent mistakes, weak topics (lowest-accuracy subjects/chapters), puzzle streak + study streak, STP earned today / player XP / event EXP (game stats — omitted from payload when hidden), daily quests, and a recommended next study action (rule-based: nearest exam > due flashcards > overdue tasks > mistakes to review > puzzle with streak available).
2. **Hide-game-stats toggle** — persisted per-user setting; when enabled the backend omits game stats from the summary and the UI hides them (not just visually).
3. **Frontend** — reworked `DashboardHomePage` with responsive widget cards, CTA links into the tool pages, game-stats toggle in the header, and empty states. Wired through all 15 locales.

## Capabilities

### New Capabilities
- `student-dashboard`: Live, ownership-scoped dashboard summary aggregating Study Tools and game stats, with a per-user hide-game-stats preference.

### Modified Capabilities
_(none)_

## Impact

- `backend/migrations/020_study_tools.sql` — adds a `user_settings` row/table (or `preferences` column) storing `hide_game_stats`.
- New backend module `dashboard` (service + controller) registered in `app.module.ts`; reuses existing modules' tables (tasks, exams, academics, quizzes/analytics, focus sessions, flashcards, mistakes, puzzles) — no data duplication.
- Frontend: rework `pages/dashboard/DashboardHomePage.tsx`, new `services/dashboard.ts`, dashboard nav stays in place; locale keys for all widget labels in all 15 files.
- Unit tests for the rule-based recommendation and game-stats filtering.
