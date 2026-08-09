## 1. Backend summary + preference

- [x] 1.1 `DashboardService` (`GET /dashboard/summary`): today plan, tasks due, upcoming exams, exam portions, focus minutes, flashcards due, quiz accuracy, recent mistakes, weak topics, streaks, game stats, quests, recommendation — all user-scoped
- [x] 1.2 `UserPreferences` read/upsert (`GET/PUT /dashboard/preferences`) with `hide_game_stats`; game stats omitted from summary when hidden
- [x] 1.3 Unit tests: recommendation rules + game-stats filtering

## 2. Frontend dashboard v2

- [x] 2.1 `services/dashboard.ts` + types
- [x] 2.2 Rework `DashboardHomePage` to widget grid from summary + hide-game-stats toggle; locale keys in all 15 files

## 3. Validation + docs

- [x] 3.1 Backend build/lint/tests + frontend typecheck/build/lint/tests pass
- [x] 3.2 Update `IMPLEMENTATION_STATUS.md` + `CHANGELOG.md`
