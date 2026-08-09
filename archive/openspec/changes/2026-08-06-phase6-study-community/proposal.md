## Why

Phases 4–5 shipped the single-player RPG and async PvP. The owner's next brief — the **community layer** — is governance, group study, and social accountability: a learning platform's RPG only works if studying stays the source of success (battles are the *celebration*, not the goal).

The owner's brief was large, so its fractions are mapped onto the real phases of the *Studyield Master Implementation Prompt.pdf* (see `docs/implementation/MASTER_PLAN.md` §3): Nightmare admin/audit → PDF Phase 2 (users/security), email-optional + notifications → Phase 1/2, admin syllabus → Phase 2, AI-built programmes + reviewer → Phase 2/8, universal admin notes + page selection → Phase 3 (RAG), friends + self-hosted chat → Phase 5 (social layer), party battles + exam bosses → Phase 5 (Battles), factions + monthly IST settlement → Phase 7 (Events). This openspec change **`2026-08-06-phase6-study-community`** delivered the whole community track in one migration so students get the social/governance layer immediately; the PDF-phase follow-ups (economy, event scheduler, hardening) remain planned.

## What Changes

1. **Admin & audit** — a seeded super-admin account **Nightmare** (env-configured, default password `123456789`) can manage users and grant roles (incl. `teacher`). Every admin mutation requires a **reason** and writes an `audit_logs` row. Teachers can read audit logs (transparency: no secret admin actions, no rogue teachers).
2. **Email-optional auth** — `username` added, `email` nullable; register with username and/or email (at least one required); login by identifier; verification/welcome emails only when an email exists; website notifications are the default channel.
3. **AI-built programmes** — any user suggests a programme → the AI generates objectives, milestones, activities, estimated effort and a **reward policy** immediately → it goes live for everyone → an AI reviewer accepts/rejects it (admin override with reason). Faction-enabled programmes supported.
4. **Social** — friendships (request/accept/block) and **self-hosted** user-to-user chat (Postgres + the existing Socket.IO gateway), with website notifications for new messages/friend events.
5. **Factions** — auto-balanced teams (28 students → 4×7), scores from study activity (tasks, quizzes, XP, focus), 2 elected leaders per faction, the help-the-weaker pledge mechanic, and monthly **IST** settlements with rewards.
6. **Party battles & exam bosses** — a player + up to **3 friends** fight original named **exam bosses** (exams are boss fights) through the server-authoritative engine.
7. **Universal admin notes & syllabus** — admins upload notes that become a universal, AI-trusted source (students may still upload their own); PDF uploads support **page selection** so the AI never quotes a wrong page; official syllabi are admin-only (browseable by students).

> Split out to later PDF phases (tracked in `docs/implementation/MASTER_PLAN.md`): economy (Phase 6), event scheduler/quests/StudyPass (Phase 7), advanced-learning AI tooling (Phase 8), hardening (Phase 9).

## Capabilities

### New Capabilities
- `admin-audit`: Nightmare super-admin, user/role management, reason-required audit logging, audit-log viewing for admins + teachers.
- `programmes`: AI-built programmes (suggest → build → live → review), reward policy, faction-enabled programmes.
- `social`: friendships and self-hosted direct messaging with realtime delivery.
- `factions`: auto-balancing, scored study activity, elected leaders, help pledges, monthly IST settlement.
- `admin-notes`: universal AI-trusted admin notes with PDF page selection; admin-only syllabi.
- `party-battles`: 4-hero parties vs original exam bosses.

### Modified Capabilities
- `studyield-core` (auth/users): username + nullable email, identifier login, role `teacher`, `is_active` flag.
- `rag`: chat context merges universal admin notes as a trusted source (`source: admin`).
- `study-rpg-core`: battle engine reused for party battles; exam-boss roster.

## Impact

- `backend/migrations/023_study_phase6.sql` — all tables above; unique prefix ordered after `022`.
- Backend: `admin/` (service, audit service, controller), `programmes/`, `social/` (service + gateway + controller), `factions/` (balancer + settlement + controller), `admin-notes/` (service + controller), auth DTO/service changes, RPG `PartyService` + `exam-bosses.ts`, `app.module.ts` wiring.
- Frontend: types, services (`admin`, `programmes`, `factions`, `social`, `rpg` party calls), pages (Admin, Programmes, Factions, Social, RpgPartyTab), router + nav, locale keys in all 15 files.
- Unit tests: audit enforcement, programme build/review, faction balancer + settlement, page selection, social flow, party battles — mocked db, no live services. Backend suite: **202 tests** (2026-08-06).
