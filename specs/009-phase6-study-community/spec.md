# Feature Specification: Phase 6 — Study Community

**Feature Branch**: `009-phase6-study-community`

**Created**: 2026-08-06

**Status**: Implemented

**Input**: Migrated from OpenSpec change `openspec/changes/2026-08-06-phase6-study-community/`
(proposal.md + design.md). The owner's "Phase 6" brief — a community/governance track delivered
early; the fractions map onto PDF phases 2, 3, 5, 7, 8 (see `docs/implementation/MASTER_PLAN.md` §3).

## User Scenarios & Testing

### User Story 1 — Nightmare super-admin with reason-required audit (Priority: P1)

A seeded super-admin account **Nightmare** (env-configured, default password `123456789`) can
manage users and grant roles (including `teacher`); every admin mutation requires a **reason** and
writes an `audit_logs` row; teachers can read audit logs (transparency: no secret admin actions,
no rogue teachers).

**Why this priority**: Governance trust underpins every community feature.

**Independent Test**: Sign in as Nightmare, change a role, verify the audit log entry with the
given reason; verify an admin action without a reason is rejected; verify a teacher can read logs.

**Acceptance Scenarios**:

1. **Given** no `role='admin'` user exists, **When** the backend boots,
   **Then** the Nightmare super-admin is seeded from `NIGHTMARE_ADMIN_USERNAME` / `_EMAIL` /
   `_PASSWORD` (default password `123456789`) and the seeding itself is audit-logged.
2. **Given** an admin performs a mutating action without a reason, **When** it is logged,
   **Then** the audit log write is rejected (reason is required).
3. **Given** an admin or teacher views the audit log, **When** it is requested,
   **Then** they see actor, action, target, reason, details, and timestamp for admin mutations.

---

### User Story 2 — Email-optional accounts (Priority: P1)

Registration works with username and/or email (at least one required); login accepts either
identifier; verification/welcome emails are sent only when an email exists; website notifications
are the default channel; an `is_active` gate controls login.

**Acceptance Scenarios**:

1. **Given** a user registers with only a username, **When** registration completes,
   **Then** the account is created without an email and login works by username.
2. **Given** a user registers without either email or username, **When** registration is attempted,
   **Then** it is rejected with "Provide an email or a username to register".
3. **Given** a deactivated account tries to log in, **When** login is attempted,
   **Then** it is gated by `is_active`.

---

### User Story 3 — AI-built programmes (Priority: P1)

Any user suggests a programme; the AI immediately builds objectives, milestones, activities,
estimated effort, and a reward policy; the programme goes live for everyone; an AI reviewer
accepts/rejects it (admin override with reason). Faction-enabled programmes are supported.

**Acceptance Scenarios**:

1. **Given** a user suggests a programme, **When** the AI builds it,
   **Then** it transitions suggested → building → active and is immediately accessible to everyone.
2. **Given** the AI reviewer scores a programme, **When** the review completes,
   **Then** a verdict (accepted/rejected) with reasons is stored.
3. **Given** an admin disagrees with a review, **When** they override,
   **Then** the override applies with a required, audited reason.

---

### User Story 4 — Friends and self-hosted chat (Priority: P1)

Users search for people, send/accept/block friend requests, and exchange direct messages through a
self-hosted channel (Postgres + the existing Socket.IO gateway) with website notifications for new
messages and friend events — no third-party chat provider.

**Acceptance Scenarios**:

1. **Given** a user sends a friend request, **When** the recipient accepts,
   **Then** the friendship becomes `accepted` and both sides receive a `friend:update` event.
2. **Given** two friends exchange messages, **When** a message is sent,
   **Then** it is persisted in `direct_messages` and delivered in realtime to the recipient's
   `user:<recipientId>` room with a notification.

---

### User Story 5 — Auto-balanced factions (Priority: P1)

Factions are auto-balanced from the total user count (e.g. 28 students → 4 factions × 7); faction
scores derive from study activity (task completion, quiz attempts, XP, focus sessions); 2 leaders
per faction are elected by members; a help-the-weaker mechanic ties the strong to the weak; monthly
**IST** settlements reward study quality.

**Acceptance Scenarios**:

1. **Given** 28 users and a target size of 7, **When** auto-assignment runs,
   **Then** 4 balanced factions of 7 are created.
2. **Given** faction members complete study activities, **When** score events are recorded,
   **Then** the faction score reflects tasks, quizzes, XP, and focus sessions for the IST period.
3. **Given** a faction election closes, **When** leaders are promoted,
   **Then** the top-2 vote recipients become faction leaders.
4. **Given** a month boundary (IST) is crossed, **When** settlement is due,
   **Then** study-quality rewards are settled per faction (lazy `settleIfDue()` or explicit settle).

---

### User Story 6 — Party battles and exam bosses (Priority: P2)

A player plus up to 3 friends (4 heroes) fight original named **exam bosses** (exams are boss
fights) through the server-authoritative engine.

**Acceptance Scenarios**:

1. **Given** a party leader invites up to 3 friends, **When** the party reaches its target,
   **Then** a party of max 4 heroes is formed.
2. **Given** a party starts a battle against an exam boss (e.g. Syllabus Sentinel),
   **When** each hero acts through the engine, **Then** the battle resolves deterministically with
   per-hero actions and a reward on victory.

---

### User Story 7 — Universal admin notes and admin-only syllabus (Priority: P2)

Admins upload notes that become a universal, AI-trusted source (students may still upload their
own); PDF uploads support **page selection** so the AI never quotes the wrong page (e.g. "the email
of NCERT"); official syllabi are admin-only to write and browseable by students.

**Acceptance Scenarios**:

1. **Given** an admin uploads a note with selected pages, **When** it is searched,
   **Then** only the selected pages are indexed/used as an AI source with a `source: admin` marker.
2. **Given** a student uploads their own notes, **When** RAG context is built,
   **Then** both student notes and universal admin notes are available, with admin notes marked.
3. **Given** a student browses the syllabus, **When** it is requested,
   **Then** they can read it; only admins can create or delete syllabus entries (reason required).

---

### Edge Cases

- Seeding Nightmare when the env vars are missing (code defaults apply).
- Programme suggestion during AI outage (stays `suggested`, retryable).
- Faction rebalancing after users join/leave mid-period.
- Party battle when a member is offline (their hero acts on their turn or is skipped when down).
- PDF with no pages selected (whole document used, with warning).

## Requirements

### Functional Requirements

- **FR-001**: A seeded super-admin MUST be created from env config; every admin mutation MUST
  require a reason and write an `audit_logs` row; teachers MUST be able to read audit logs.
- **FR-002**: Registration MUST accept username and/or email (at least one required) with identifier
  login; emails MUST only be sent when an email exists; website notifications MUST be the default
  channel; `is_active` MUST gate login.
- **FR-003**: Any user MUST be able to suggest a programme; the AI MUST build objectives,
  milestones, activities, effort, and reward policy; the programme MUST go live immediately; an AI
  reviewer MUST accept/reject it with reasons; admins MUST be able to override with an audited
  reason.
- **FR-004**: Friendships (request/accept/block) and self-hosted direct messaging MUST work through
  Postgres + Socket.IO with website notifications — no third-party chat provider.
- **FR-005**: Factions MUST auto-balance from total user count, score from study activity
  (tasks/quizzes/XP/focus), elect 2 leaders by member vote, support help-the-weaker pledges, and
  settle monthly IST study-quality rewards.
- **FR-006**: Parties of a player + up to 3 friends MUST be able to fight original named exam
  bosses through the server-authoritative engine.
- **FR-007**: Admin notes MUST be a universal AI-trusted source with PDF page selection and
  `source: admin` markers; syllabi MUST be admin-only to write and student-readable.
- **FR-008**: The RPG layer MUST remain optional — dashboard `hide-game-stats` persists, rewards are
  anti-farmed, and studying stays the success metric.

### Key Entities

- **AuditLog**: actor, action, target, reason (required), details, timestamp.
- **User**: username (nullable, unique), email (nullable), role (student/teacher/admin), is_active.
- **Programme**: status (suggested/building/active/rejected/archived), AI-built content + reward
  policy, AI review verdict, admin override.
- **Friendship / DirectMessage**: social graph + self-hosted messaging.
- **Faction / FactionMember / FactionScoreEvent / FactionVote / FactionSettlement /
  FactionHelpPledge**: balanced teams with study-based scoring, elections, help mechanic, IST
  settlement.
- **RpgParty / RpgPartyMember / RpgPartyBattle / ExamBoss**: 4-hero parties vs original exam
  bosses.
- **AdminNote / Syllabus**: universal AI-trusted notes with page selection; admin-only syllabus.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every admin mutation carries an audited reason visible to teachers — zero silent
  admin actions.
- **SC-002**: A user with no email can register, log in, and use the full platform via website
  notifications.
- **SC-003**: A suggested programme goes live within one AI build cycle and is available to
  everyone; bad programmes are rejected with reasons.
- **SC-004**: 28 students become balanced factions of 7 with study-based scores and monthly IST
  settlement.
- **SC-005**: 4 friends can defeat an original exam boss together; exams behave as boss fights.
- **SC-006**: The AI never cites the wrong page of a universal admin note (page selection enforced).
- **SC-007**: Studying remains the success metric — game features never gate study tools.

## Assumptions

- Chat is self-hosted (owner decision) — no third-party messaging provider.
- The Nightmare password default (`123456789`) is a documented dev default; production sets
  `NIGHTMARE_ADMIN_PASSWORD`.
- AI availability is required for programme build/review; the flow retries on outage.
- Faction settlement is lazy-on-read plus an explicit admin settle endpoint; a scheduled job is a
  Phase 7 follow-up.
