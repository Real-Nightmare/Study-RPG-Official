# Phase 6 — Study Community (community track)

> The owner's brief is delivered as **one community track** in this change (migration `023_study_phase6.sql`).
> The fractions of the brief map onto the real phases of the *Studyield Master Implementation Prompt.pdf*
> in `docs/implementation/MASTER_PLAN.md` §3 (factions → PDF Phase 7 Events; party battles → PDF Phase 5
> Battles; admin notes → PDF Phase 3 RAG; Nightmare admin → PDF Phase 2; economy/events/hardening → later).

## Backend

- [x] `023_study_phase6.sql` — audit_logs, programmes, programme_members, factions + score events + votes + settlements + help pledges/activities, friendships, direct_messages, rpg_parties + members + party_battles, admin_notes, syllabus; users.username + nullable email + is_active
- [x] Auth/users: username registration, identifier login, email-optional (at least one of email/username), is_active gate, role `teacher`
- [x] Admin module: Nightmare seeding (`NIGHTMARE_ADMIN_USERNAME/EMAIL/PASSWORD`, default password `123456789`), user/role management, reason-required audit logging (AuditService), audit-log view (admin + teacher)
- [x] Programmes module: suggest → AI build → live → AI review → admin override (audited); reward policy
- [x] Social module: friendships + direct messages + `social` gateway (`dm:new`, `friend:update`) — self-hosted, no third-party chat
- [x] Factions module: auto-balancer (target size, e.g. 28 → 4×7), score events (tasks/quizzes/XP/focus), votes + top-2 leader promotion, help pledges + activities, monthly IST settlement (lazy `settleIfDue` + explicit settle)
- [x] RPG party battles + exam bosses: `PartyService` (create/invite/leave/start/action), `exam-bosses.ts` (6 original named bosses)
- [x] Admin notes: PDF page selection, universal search, RAG context merge (`source: admin`)
- [x] Syllabus: admin CRUD (reason required), student read
- [x] `app.module.ts` wiring (AdminModule, ProgrammesModule, FactionsModule, SocialModule, AdminNotesModule) + `.env.example` entries (NIGHTMARE_ADMIN_USERNAME / NIGHTMARE_ADMIN_EMAIL / NIGHTMARE_ADMIN_PASSWORD)

## Frontend

- [x] Types + services: admin, programmes, factions, social, rpg (party + exam bosses)
- [x] Pages: Admin (users, audit log, notes, syllabus), Programmes, Factions, Social (friends + chat), RpgPage PartyTab
- [x] Router + DashboardLayout nav items (admin hidden from non-admin/non-teacher)
- [x] Locale keys in all 15 files (admin/programmes/factions/social/rpg.party namespaces)
- [x] Frontend typecheck fixed (unused imports/`Sparkles2` export removed 2026-08-06)

## Tests & validation

- [x] Unit tests: audit enforcement (reason required), programme build/review flow, faction balancer + settlement, admin notes page selection, social service flow, party battles — **backend suite 202 tests** (2026-08-06)
- [x] backend tsc + tests pass; frontend `tsc -b --noEmit` passes
- [ ] backend + frontend lint pass (re-run after this docs pass)
- [ ] `openspec validate --all` passes

## Docs

- [x] `docs/implementation/MASTER_PLAN.md` created — PDF phase map + brief fractions → PDF phases
- [ ] Sync specs to `openspec/specs/*` when the change is accepted (specs for admin-audit, programmes, social, factions, admin-notes, party-battles)
- [ ] `IMPLEMENTATION_STATUS.md` + `CHANGELOG.md` updated (Phase 6 status, Phase 7/8 planned)
- [ ] Archive this change after acceptance (per openspec workflow)
