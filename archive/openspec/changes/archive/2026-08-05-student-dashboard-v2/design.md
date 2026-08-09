## Context

The dashboard home page exists but is largely static (510 lines). Rich data already lives across modules: tasks (`study_tasks`), exams/portions (academics), focus sessions (new), flashcards (`flashcards`), quiz attempts (analytics), mistakes (new), puzzles (new). There is no settings persistence for UI preferences today (settings pages exist in frontend but no backend preference store).

## Goals / Non-Goals

**Goals:**
- One aggregate endpoint (`GET /dashboard/summary`) so the home page renders in a single fetch.
- A rule-based recommended next study action.
- A persisted per-user `hide_game_stats` preference that also removes game stats from the API payload.

**Non-Goals:**
- Real-time push updates; the page re-fetches on focus/visibility.
- Full gamification backend (STP/XP/quests) — the summary surfaces placeholder/derived values (e.g., XP from a `game_stats` snapshot table) that Phase 4 will flesh out.

## Decisions

1. **Migration `020_study_tools.sql` also creates `user_preferences`** (`user_id` PK, `hide_game_stats` boolean default false) — a single generic preference row avoids a settings table per feature.
2. **`DashboardService` composes queries, never cross-joins**: each section is one scoped `SELECT` against the owning module's tables; the service aggregates into a typed `DashboardSummaryDto`. This keeps modules decoupled and matches the raw-SQL style.
3. **Recommendation rules, in order**: nearest upcoming exam (within 30 days) → flashcards due today → overdue tasks → unresolved mistakes → available puzzle streak → else "no pending work". Implemented as a pure function (`recommendation.ts`) for unit tests.
4. **Hide-game-stats**: when true, the service omits `stp`, `xp`, `eventExp`, `dailyQuests` from the payload entirely (client can't display what it never receives); frontend toggle lives in the dashboard header and the Account settings.
5. **Weak topics** derive from quiz-attempt accuracy grouped by subject/chapter (30-day window) using the analytics tables; empty if no data.
6. Frontend rework keeps the existing page path `/dashboard` and its nav entry — only internals change.

## Risks / Trade-offs

- Aggregate endpoint touches many tables — kept in one service with a bounded number of queries (≤ 12 small SELECTs); acceptable for a personal dashboard.
- Placeholder game values could mislead — UI labels them as cumulative stats; Phase 4 replaces the source.
- Preference store is new ground — keep it a simple row upsert.
