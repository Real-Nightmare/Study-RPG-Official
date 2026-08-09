# Feature Specification: Student Dashboard v2

**Feature Branch**: `002-student-dashboard`

**Created**: 2026-08-06

**Status**: Implemented

**Input**: Migrated from OpenSpec spec `openspec/specs/student-dashboard/spec.md` (PDF Phase 2 — student dashboard, §7.2).

## User Scenarios & Testing

### User Story 1 — Live dashboard summary (Priority: P1)

A student opens their dashboard and sees one aggregate view of today's plan (tasks due today),
upcoming exams, current exam portions, focus minutes today, flashcards due, 30-day quiz accuracy,
recent mistakes, weak topics, puzzle and study streaks, daily quests, and a recommended next study
action — all computed from their own data.

**Why this priority**: The dashboard is the daily landing surface; without the aggregate the rest
of the study tools are hard to navigate.

**Independent Test**: Request the dashboard summary and verify each section reflects the user's own
Study Tools and analytics data.

**Acceptance Scenarios**:

1. **Given** a user requests their dashboard summary, **When** each section is computed,
   **Then** it is derived from their own Study Tools and analytics data.
2. **Given** the summary is built, **When** the recommendation is computed, **Then** it prioritizes
   the nearest exam, then due flashcards, then overdue tasks, then unresolved mistakes, then an
   available puzzle streak.

---

### User Story 2 — Hide game statistics (Priority: P2)

A user can disable game statistics so the dashboard hides them everywhere, including omitting them
from the API payload entirely.

**Why this priority**: This is the constitutional "studying is the success metric" guarantee — the
game layer must be fully hideable for students who find it distracting.

**Independent Test**: Enable the toggle and verify the persisted preference omits STP, XP, event
EXP, and quest data from subsequent summary payloads and the rendered dashboard.

**Acceptance Scenarios**:

1. **Given** a user enables hide-game-stats, **When** a summary is requested afterwards,
   **Then** the preference is stored and the payload omits STP, XP, event EXP, and quest data.
2. **Given** hide-game-stats is enabled, **When** the dashboard renders,
   **Then** it renders without the game-stat widgets.

---

### Edge Cases

- User with no study data yet (empty sections).
- Toggle toggled off again (game stats return).
- Recommendation when no exams, flashcards, tasks, mistakes, or puzzles exist.

## Requirements

### Functional Requirements

- **FR-001**: A single endpoint MUST return the student's today plan, upcoming exams, current exam
  portions, focus minutes today, flashcards due, 30-day quiz accuracy, recent mistakes, weak topics,
  puzzle and study streaks, daily quests, and a recommended next study action, all scoped to the
  current user.
- **FR-002**: The recommended next action MUST follow the priority order: nearest exam → due
  flashcards → overdue tasks → unresolved mistakes → available puzzle streak.
- **FR-003**: Users MUST be able to persist a hide-game-stats preference.
- **FR-004**: When hide-game-stats is enabled, the summary payload MUST omit STP, XP, event EXP,
  and quest data, and the UI MUST render without game-stat widgets.

### Key Entities

- **DashboardSummary**: computed aggregate of the sections above.
- **DashboardPreference**: per-user `hideGameStats` flag.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user sees a complete, correct summary of their study state on a single dashboard
  load (no secondary clicks required for the core sections).
- **SC-002**: The recommended next action matches the documented priority rule for any data state.
- **SC-003**: Enabling hide-game-stats removes game data from both the API response and the UI;
  disabling restores them.
- **SC-004**: No cross-user data leakage in any summary payload.

## Assumptions

- Game stats = STP, XP, event EXP, and quests; study streaks remain visible even when hidden
  (they are study data, not game data).
- The dashboard is the authenticated user's own view only.
