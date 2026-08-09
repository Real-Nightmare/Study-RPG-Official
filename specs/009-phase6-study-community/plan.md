# Implementation Plan: Phase 6 — Study Community

**Branch**: `009-phase6-study-community` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-phase6-study-community/spec.md` (migrated from the
OpenSpec change `2026-08-06-phase6-study-community`).

## Summary

Deliver the owner's **community track** in one migration (`backend/migrations/023_study_phase6.sql`):
Nightmare super-admin + reason-required audit logging, email-optional auth, AI-built programmes with
AI review, friendships + self-hosted chat, auto-balanced factions with monthly IST settlement, party
battles vs exam bosses, universal admin notes with PDF page selection, and admin-only syllabus.
Core principle: **studying is the success metric; the RPG layer celebrates it.**

## Technical Context

**Language/Version**: TypeScript; NestJS 10 backend, React 19 + Vite 7 frontend.

**Primary Dependencies**: `pg` (raw SQL), class-validator, Socket.IO (gateway), existing
`WalletService` / battle engine, `AiService.complete` (JSON builds).

**Storage**: PostgreSQL (one migration `023_study_phase6.sql`); no ORM.

**Testing**: Jest (backend) + Vitest (frontend); pure rule modules (`faction-balancer.ts`,
`page-selection.ts`) unit-tested in isolation.

**Target Platform**: Web (SPA + REST + WebSocket), server-authoritative game logic.

**Project Type**: web application (backend + frontend monorepo).

**Performance Goals**: No N+1 query patterns on dashboard/faction listings; lazy settlement avoids
synchronous heavy work on reads.

**Constraints**: Migration prefix `023` (unique, after `022`, before `024`); all 15 locale files
must receive new keys; admin mutations require a reason (audited).

**Scale/Scope**: Small-to-medium deployment (single DB); faction settlement lazily triggered on read
plus an explicit admin settle endpoint.

## Constitution Check

*GATE: passes.* Spec-first, raw SQL, complete i18n, reason-required audits, original IP (all bosses/
cards original), anti-farming rewards, and the "studying is success" principle are all respected.

## Project Structure

### Documentation (this feature)

```text
specs/009-phase6-study-community/
├── spec.md              # This feature's spec (migrated)
├── plan.md              # This file
└── tasks.md             # Migrated task list (implemented 2026-08-06)
```

### Source Code (repository root)

```text
backend/
├── migrations/023_study_phase6.sql
└── src/
    ├── modules/admin/          # Nightmare seeding + user/role mgmt + audit logs
    ├── modules/admin-notes/    # universal notes + page selection + syllabus
    ├── modules/programmes/     # AI build/review + reward policy
    ├── modules/factions/       # balancer + scores + elections + help + settlement
    ├── modules/social/         # friendships + DMs + gateway
    └── modules/rpg/            # PartyService + exam-bosses.ts
frontend/src/
├── services/admin|programmes|factions|social|rpg(party).ts
├── pages/dashboard/AdminPage|ProgrammesPage|FactionsPage|SocialPage|RpgPage(PartyTab).tsx
└── locales/*.json              # all 15 locale files
```

**Structure Decision**: Follows the existing NestJS module layout and frontend conventions
(see `AGENTS.md`); no new top-level projects.

## Key Decisions (from the OpenSpec design)

1. **Nightmare seeding** — `AdminService.onModuleInit` creates the super-admin if no `role='admin'`
   user exists, from `NIGHTMARE_ADMIN_USERNAME`/`_EMAIL`/`_PASSWORD` (defaults: `nightmare`,
   `nightmare@studyield.app`, `123456789`); seeding itself is audit-logged.
2. **Audit model** — `audit_logs(actor_id, action, target_type, target_id, reason, details)`;
   `reason` required; reads open to admins + teachers, mutations admin-only; `AuditService.log()`
   is synchronous fire-and-forget (never fails the main action).
3. **Email-optional auth** — `users.username` (unique partial index, nullable), `email` nullable,
   identifier login, `is_active` gate.
4. **Programme lifecycle** — `programmes(status: suggested|building|active|rejected|archived)`;
   AI builds content + rewardPolicy via `AiService.complete(json_object)`; AI reviewer scores
   verdict + reasons; admin override audited; `kind` ∈ custom/revision_centre/competency_testing/
   faction.
5. **Social** — `friendships(requester_id, addressee_id, status)` + `direct_messages`; `SocialGateway`
   (namespace `social`) emits `dm:new` to `user:<recipientId>` and `friend:update`.
6. **Factions** — pure `faction-balancer.ts` (target size); `faction_score_events` per IST
   `period_key` (YYYY-MM); votes + top-2 promotion; help pledges/activities; `faction_settlements`
   with lazy `settleIfDue()` + `POST /factions/settle`.
7. **Party battles & exam bosses** — `rpg_parties` (max 4), `rpg_party_members`, `rpg_party_battles`;
   `exam-bosses.ts` defines 6 original bosses (Syllabus Sentinel, Math Colossus, Science Golem,
   Language Wraith, History Tyrant, Geography Giant).
8. **Admin notes & syllabus** — `admin_notes(title, subject, content, uploaded_by,
   source_document_id, selected_pages JSONB, is_universal)`; pure `page-selection.ts`; universal
   search merged into chat context with `source: admin`; `syllabus(board, grade, subject, chapters
   JSONB, created_by)` admin-only write.
9. **Reward policy** — AI sets `rewardPolicy { kind: none|stp|xp|badge, amount, criteria }`; admin
   override; participation vs winning judged by the reviewer.
10. **Chat approach** — self-hosted (Postgres + existing Socket.IO gateway), per owner decision.
11. **Anti-farming & hide-game-stats** — all rewards gated on meaningful study activity; dashboard
    toggle persists.

## Risks / Trade-offs

- **AI programme quality varies** — reviewer + admin override mitigate; rejected programmes stay
  visible to the suggester with reasons.
- **Email-optional auth** — password recovery for email-less accounts relies on username + reset;
  documented.
- **Universal notes as trusted source** — page selection reduces wrong-page citations; `source:
  admin` markers let users verify.
- **Lazy faction settlement** — correct for small deployments; PDF Phase 7 replaces with a
  scheduled BullMQ job + outbox event.
- **Self-hosted DMs** — Phase 5/9 follow-up adds rate limits + moderation (§32 of the PDF).

## Complexity Tracking

No constitution violations — the track is one migration by design (owner preference) with
PDF-phase follow-ups tracked in `docs/implementation/MASTER_PLAN.md`.
