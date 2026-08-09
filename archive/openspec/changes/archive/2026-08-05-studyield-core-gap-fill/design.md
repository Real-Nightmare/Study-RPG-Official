## Context

The backend uses raw SQL via `pg` (no ORM) with a custom migration runner; new core-tool modules follow the `planner/` pattern (dto + service + controller + module + barrel + `app.module.ts` registration). Frontend uses shadcn-style Radix components, Zustand/TanStack Query via `src/services/*` API clients, and 15 locale JSON files. `exams` already exist from the academics module (migration 016), so exam periods extend rather than replace them. The queue/worker infra exists but these tools are synchronous CRUD + light rules, so they stay in-request.

## Goals / Non-Goals

**Goals:**
- Four complete Study Tools (focus sessions, mistakes, puzzles, exam periods) with per-user ownership, following existing module patterns.
- Puzzles implement the §7.9 rules (ranked/practice, streak up/reset, personal best, attempt history, no immediate reuse, daily ranked limit).

**Non-Goals:**
- Game economy (STP/XP/streak shields/rewards) — Phase 4; shields and reward limits are represented as data columns and hooks only.
- Battle-quiz / damage-challenge prioritization during exam periods — game layer, Phase 4.

## Decisions

1. **Single migration `020_study_tools.sql`** adds `focus_sessions`, `mistakes`, `puzzles`, `puzzle_attempts`, `exam_periods`, and columns on `exams` (`period_id`, `mark_scheme_url`, `past_paper_url`); `exam_results` stores recorded results with mistake analysis.
2. **Puzzle streak logic lives in a pure module** (`puzzle-streak.ts`) so it is unit-testable without DB: `applyAttempt(streak, correct, shielded)` → `{ streak, reset }`, plus daily-limit and personal-best helpers.
3. **Exam period status is derived** (`upcoming|live|ended`) from dates at read time rather than stored, so it can never go stale.
4. **Modules follow planner pattern** exactly; controllers are `@Controller('focus-sessions')`, `('mistakes')`, `('puzzles')`, `('exam-periods')`; each mutation uses `assertOwned`.
5. **Frontend**: one service per tool + four pages reusing the `AcademicsPage` visual language (tabs, cards, colour-coded subjects, gradient CTAs); nav entries + full locale namespaces in all 15 files via a scripted merge.

## Risks / Trade-offs

- Puzzle "original content": seeded puzzles must be authored originally (no copyrighted material) — seed data is conservative in size.
- Derived status vs stored: derived wins on correctness; a small cost at read time.
- Locale bulk-merge script risk of JSON corruption — mitigated by validation after merge.
