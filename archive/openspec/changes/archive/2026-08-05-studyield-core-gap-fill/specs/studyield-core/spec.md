## Purpose

Study Tools for daily studying: recorded focus sessions, a mistake notebook, per-subject puzzles with streaks, and exam periods/exam centre that tie into the academic structure.

## ADDED Requirements

### Requirement: Focus session recording

Students SHALL record study sessions with optional task and subject links, pausing and resuming without losing accumulated time; sessions MUST be owned by the user and summarized per day.

#### Scenario: Start, pause and complete a session
- **WHEN** a user starts a focus session and later pauses it
- **THEN** accumulated focus minutes are preserved and the session can be resumed or stopped, with the completed duration persisted

#### Scenario: Ownership enforcement
- **WHEN** a user tries to mutate another user's session
- **THEN** the request is rejected with a not-found response

### Requirement: Mistake notebook

Students SHALL record mistakes (question, subject/chapter links, category, cause, resolution status, correction notes) and manage them through their lifecycle.

#### Scenario: Create, resolve and reopen a mistake
- **WHEN** a student records a mistake and later resolves it
- **THEN** the mistake status is updated, and it can be reopened if the issue recurs

#### Scenario: Filter and summary
- **WHEN** a student lists mistakes by status or subject
- **THEN** they receive only their own mistakes with counts per status

### Requirement: Subject puzzles with streaks

Each subject SHALL have independent original puzzles with ranked and practice modes; ranked solves MUST advance a per-subject streak, incorrect ranked solves MUST reset it unless shielded, attempt history and personal best SHALL be stored, and the same ranked puzzle SHALL NOT be served back-to-back.

#### Scenario: Ranked streak progression
- **WHEN** a student answers a ranked puzzle correctly
- **THEN** the subject streak increases and the personal best updates when surpassed

#### Scenario: Streak reset
- **WHEN** a student answers a ranked puzzle incorrectly without a shield
- **THEN** the subject streak resets and the attempt is recorded in history

#### Scenario: No immediate reuse
- **WHEN** the next ranked puzzle is selected for a subject
- **THEN** it is not the same puzzle as the most recent ranked attempt

### Requirement: Exam periods and exam centre

Exam periods SHALL group exams with start/end dates and derived status (upcoming, live, ended); exams MUST carry mark scheme and past paper metadata, results SHALL be recordable with mistake analysis, and the nearest upcoming exam MUST be available for planning.

#### Scenario: Exam period lifecycle
- **WHEN** an admin-like owner creates an exam period within the academic year and exams are attached
- **THEN** the period status is derived from its dates and the nearest upcoming exam is exposed

#### Scenario: Result recording
- **WHEN** a result is recorded for an exam in a period
- **THEN** it is stored with marks and mistake analysis notes and returned with the exam

### Requirement: Per-user data isolation

All four tools SHALL scope reads and writes to the authenticated user.

#### Scenario: Cross-user isolation
- **WHEN** any list or mutation is performed
- **THEN** only rows owned by the current user are returned or affected
