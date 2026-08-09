## Purpose

A live, ownership-scoped dashboard summary aggregating study plan, exams, focus time, flashcards, mistakes, analytics, streaks and quests, with a per-user hide-game-stats preference.

## ADDED Requirements

### Requirement: Dashboard summary aggregation

A single endpoint SHALL return the student's today plan (tasks due today), upcoming exams, current exam portions, focus minutes today, flashcards due, 30-day quiz accuracy, recent mistakes, weak topics, puzzle and study streaks, daily quests, and a recommended next study action, all scoped to the current user.

#### Scenario: Summary reflects user data
- **WHEN** a user requests their dashboard summary
- **THEN** each section is computed from their own Study Tools and analytics data

#### Scenario: Recommended next action
- **WHEN** the summary is built
- **THEN** a rule-based recommendation prioritizes the nearest exam, then due flashcards, then overdue tasks, then unresolved mistakes, then an available puzzle streak

### Requirement: Hide game statistics

Users SHALL be able to disable game statistics so the dashboard hides them everywhere, including omitting them from the API payload.

#### Scenario: Toggle persisted
- **WHEN** a user enables hide-game-stats
- **THEN** the preference is stored and subsequent summary payloads omit STP, XP, event EXP and quest data

#### Scenario: Toggle respected in UI
- **WHEN** hide-game-stats is enabled
- **THEN** the dashboard renders without the game-stat widgets
