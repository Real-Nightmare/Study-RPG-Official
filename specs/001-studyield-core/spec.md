# Feature Specification: Studyield Core Study Tools

**Feature Branch**: `001-studyield-core`

**Created**: 2026-08-06

**Status**: Implemented

**Input**: Migrated from OpenSpec spec `openspec/specs/studyield-core/spec.md` (PDF Phase 2 — Studyield core, §7 study tools).

## User Scenarios & Testing

### User Story 1 — Focus session recording (Priority: P1)

A student records a study session with optional task/subject links, can pause and resume without
losing accumulated time, and sees their daily focus minutes.

**Why this priority**: Focus time is the platform's core "studying is the success metric" signal —
it must work reliably and per-user before anything else.

**Independent Test**: Start, pause, resume, and complete a session; verify accumulated minutes
persist and the daily summary reflects them.

**Acceptance Scenarios**:

1. **Given** a user starts a focus session and later pauses it, **When** they resume or stop it,
   **Then** accumulated focus minutes are preserved and the completed duration is persisted.
2. **Given** a user attempts to mutate another user's session, **When** the mutation is requested,
   **Then** it is rejected with a not-found response.

---

### User Story 2 — Mistake notebook lifecycle (Priority: P2)

A student records mistakes (question, subject/chapter links, category, cause, resolution status,
correction notes) and manages them through their lifecycle.

**Why this priority**: Mistake tracking directly improves exam performance and is a study-first
feature with no game dependency.

**Independent Test**: Create, resolve, reopen, filter, and summarize a mistake; verify status
counts and ownership scoping.

**Acceptance Scenarios**:

1. **Given** a student records a mistake and later resolves it, **When** the issue recurs,
   **Then** the mistake can be reopened and its status is updated.
2. **Given** a student lists mistakes by status or subject, **When** the list is requested,
   **Then** only their own mistakes are returned with counts per status.

---

### User Story 3 — Subject puzzles with streaks (Priority: P2)

Each subject has independent original puzzles with ranked and practice modes; ranked solves
advance a per-subject streak, and incorrect ranked solves reset it unless shielded.

**Why this priority**: Puzzles drive daily revision habits; streak integrity is the anti-abuse core.

**Independent Test**: Solve ranked puzzles correctly/incorrectly and verify streak advance, reset,
shield behavior, personal best, history, and no immediate reuse.

**Acceptance Scenarios**:

1. **Given** a student answers a ranked puzzle correctly, **When** the streak is evaluated,
   **Then** the subject streak increases and the personal best updates when surpassed.
2. **Given** a student answers a ranked puzzle incorrectly without a shield, **When** the attempt
   is recorded, **Then** the subject streak resets and the attempt is stored in history.
3. **Given** the next ranked puzzle is selected for a subject, **When** it is the same puzzle as the
   most recent ranked attempt, **Then** a different puzzle is served instead.

---

### User Story 4 — Exam periods and exam centre (Priority: P3)

Exam periods group exams with start/end dates and derived status (upcoming, live, ended); results
are recordable with mistake analysis, and the nearest upcoming exam is available for planning.

**Why this priority**: Value-add for exam preparation that builds on the academic structure; not a
daily-use blocker.

**Independent Test**: Create an exam period, attach exams, record a result, and verify derived
status + nearest upcoming exam.

**Acceptance Scenarios**:

1. **Given** an exam period is created within the academic year and exams are attached,
   **When** its dates are evaluated, **Then** the period status is derived and the nearest upcoming
   exam is exposed.
2. **Given** a result is recorded for an exam in a period, **When** the exam is read,
   **Then** the result is stored with marks and mistake-analysis notes and returned with the exam.

---

### Edge Cases

- Pausing a session with zero accumulated time.
- Resolving an already-resolved mistake (reopen semantics).
- Ranked puzzle served back-to-back (must be avoided).
- Exam period with no attached exams.

## Requirements

### Functional Requirements

- **FR-001**: Students MUST be able to start, pause, resume, and complete focus sessions, with
  optional task and subject links.
- **FR-002**: Focus sessions MUST preserve accumulated minutes across pause/resume and MUST be
  summarized per day.
- **FR-003**: Students MUST be able to record mistakes with subject/chapter links, category, cause,
  resolution status, and correction notes, and manage them through their lifecycle
  (create → resolve → reopen).
- **FR-004**: Each subject MUST have independent original puzzles with ranked and practice modes.
- **FR-005**: Ranked puzzle solves MUST advance a per-subject streak; incorrect ranked solves MUST
  reset it unless a shield is held; attempt history and personal best MUST be stored.
- **FR-006**: The same ranked puzzle MUST NOT be served for the most recent ranked attempt in a
  subject.
- **FR-007**: Exam periods MUST group exams with start/end dates and derived status; results MUST
  be recordable with mistake analysis; the nearest upcoming exam MUST be exposed.
- **FR-008**: All four tools MUST scope every read and write to the authenticated user.

### Key Entities

- **FocusSession**: user, task/subject links, start/pause/resume timestamps, accumulated minutes.
- **Mistake**: question, subject/chapter links, category, cause, resolution status, correction notes.
- **PuzzleAttempt**: subject, puzzle, mode (ranked/practice), correct flag, streak/shield effects,
  personal best.
- **ExamPeriod / Exam / ExamResult**: dates, derived status, marks, mistake analysis.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user can complete a full focus session (start → pause → resume → complete) with
  no lost minutes, verified by the daily summary.
- **SC-002**: Mistake records can be created, resolved, reopened, and filtered by status/subject
  with accurate status counts.
- **SC-003**: Per-subject ranked streaks, personal bests, and histories are accurate across
  consecutive attempts with no immediate puzzle reuse.
- **SC-004**: Exam period statuses (upcoming/live/ended) and the nearest upcoming exam are correct
  for any set of dates.
- **SC-005**: No user can read or mutate another user's study-tool data.

## Assumptions

- Target users are individual students with stable internet connectivity.
- Exam periods belong to the user's own academic year/board structure from the academics module.
- Puzzles are original content authored in the codebase (no third-party question banks).
- Mobile support is not required for v1 beyond responsive layout.
