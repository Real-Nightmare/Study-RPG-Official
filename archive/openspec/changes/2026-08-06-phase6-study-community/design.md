## Context

Phase 5 (PvP duels) shipped with the single-player RPG. The owner's Phase 6 brief — the **community layer** — is next: governance, group study, social accountability, and the core principle that **studying is the success metric; RPG/leaderboards are expressions of it** (associate studying with success — never study-to-get-something). The admin/audit system gives teachers and students trust in governance; programmes give the platform a self-growing curriculum; chat/friends give real humans a reason to log in.

**Source of truth.** The phased master plan lives in the owner's *Studyield Master Implementation Prompt.pdf* (V2, 64 pages — kept in the owner's repo, not committed here). The PDF's real **Phase 6 is Economy**, Phase 7 **Events**, Phase 8 **Advanced Learning**. The openspec name `2026-08-06-phase6-study-community` refers to the **owner's brief** (a community track delivered early), *not* the PDF's phase numbering. The fractions of the brief map onto the PDF's phases in `docs/implementation/MASTER_PLAN.md` §3 — e.g. Nightmare admin → PDF Phase 2, admin notes page selection → PDF Phase 3 (RAG), party battles & exam bosses → PDF Phase 5 (Battles), factions & monthly IST settlement → PDF Phase 7 (Events), AI programme review → PDF Phase 8.

**Scope of this change.** This change ships the **whole community track in one migration** (`023_study_phase6.sql`) — including factions and party battles, which the earlier draft had split out. The PDF-phase follow-ups (hardening, economy integration, event scheduling) are tracked in the master plan, not in this change.

## Goals / Non-Goals

**Goals:**
- Nightmare super-admin (env-seeded), user + role management, reason-required audit log, teacher visibility into audits.
- Email-optional registration; username or email login; website notifications default.
- Suggest → AI-build → live → AI-review programme lifecycle; reward policy decided by AI; admin override.
- Friendships + self-hosted DMs (Postgres + existing Socket.IO gateway).
- Universal admin notes with PDF page selection as AI trusted source; admin-only syllabus.
- Factions (auto-balanced, scored, elected leaders, help pledges, monthly IST settlement) and party battles (player + up to 3 friends) vs exam bosses — shipped here as part of the track.

**Non-Goals (deferred to PDF phases, tracked in `docs/implementation/MASTER_PLAN.md`):**
- Economy integration (marketplace, scraper/burner, supply ledger, extinction) — PDF **Phase 6**.
- Event scheduler, quests, StudyPass tracks, Abstracted/Great Extinction — PDF **Phase 7** (faction settlement machinery ships here and is reused there).
- Advanced-learning AI tooling beyond programme build/review — PDF **Phase 8**.
- Hardening: audit retention, DM moderation/rate limits, Web Push (VAPID), verified backups — PDF **Phase 9** / cross-cutting.

## Decisions

1. **Nightmare seeding.** `AdminService.onModuleInit` creates the super-admin if no `role='admin'` user exists, using `NIGHTMARE_ADMIN_USERNAME`/`NIGHTMARE_ADMIN_EMAIL`/`NIGHTMARE_ADMIN_PASSWORD` (defaults: `nightmare`, `nightmare@studyield.app`, `123456789`). Seeding itself is audit-logged. Add these three vars to `backend/.env` (values are admin-created; the code default matches the chosen password). The vars are documented in `backend/.env.example`.
2. **Audit model.** `audit_logs(actor_id, action, target_type, target_id, reason, details)`. `reason` is REQUIRED for all mutating admin actions (`AuditService.log` throws otherwise). Read endpoints open to admins + teachers; mutations to admins only. `AuditService.log()` is fire-and-forget (never fails the main action) but inserts synchronously.
3. **Email-optional auth.** `users.username` (unique partial index, nullable) added; `email` becomes nullable. `RegisterDto` accepts `username` and/or `email` (at least one required — `auth.service` throws "Provide an email or a username to register"); login identifier matches email OR username. `is_active` flag gates login.
4. **Programme lifecycle.** `programmes(status: suggested|building|active|rejected|archived)`. Suggest → AI builds `content` (objectives, milestones, activities, effort) + `rewardPolicy` JSON via `AiService.complete(responseFormat: json_object)` → status `active` (immediately live for everyone) → AI reviewer scores it (`verdict: accepted|rejected`, reasons); admin can override with reason (audited). `kind` ∈ `custom|revision_centre|competency_testing|faction`; `has_factions` + `faction_size` for faction-enabled programmes.
5. **Social.** `friendships(requester_id, addressee_id, status pending|accepted|blocked)`; `direct_messages(sender_id, recipient_id, body, read_at)`. `SocialGateway` (namespace `social`) emits `dm:new` to `user:<recipientId>` and `friend:update`; REST fallback + notification-bell wiring.
6. **Factions.** `factions` (+ `faction_members` with `role member|leader`), auto-balanced via pure `faction-balancer.ts` (target size, e.g. 28 → 4×7); `faction_score_events` (task_completed, quiz_attempt, xp_earned, study_session, per `period_key` YYYY-MM **IST**); `faction_votes` + `promote-leaders` (top-2); `faction_help_pledges` + `faction_help_activities` (help-the-weaker mechanic); `faction_settlements` with lazy `settleIfDue()` on read + explicit `POST /factions/settle` (monthly IST rewards).
7. **Party battles & exam bosses.** `rpg_parties` (leader + up to 3 friends = 4 heroes, max 4), `rpg_party_members`, `rpg_party_battles` (boss_key, seed, state, phase, reward_claimed). `PartyService`: create/invite/leave, start battle vs exam boss or any boss, per-hero actions through the existing engine. `exam-bosses.ts` defines 6 original named bosses (Syllabus Sentinel, Math Colossus, Science Golem, Language Wraith, History Tyrant, Geography Giant).
8. **Admin notes.** `admin_notes(title, subject, content, uploaded_by, source_document_id, selected_pages JSONB, is_universal)`. PDF upload extracts per-page text; pure `page-selection.ts` filters which pages are indexed (prevents wrong-page citations). `AdminNotesService.searchUniversal(query)` runs a Postgres search and ChatService merges universal notes into context with a `source: admin` marker.
9. **Syllabus.** `syllabus(board, grade, subject, chapters JSONB, created_by)` — admin-only write (reason required), everyone reads.
10. **Reward policy.** AI sets `rewardPolicy: { kind: 'none'|'stp'|'xp'|'badge', amount, criteria }` at build time; admin can override. Participation vs winning rewards are judged by the AI reviewer.
11. **Chat approach (owner decision).** Self-hosted user-to-user chat on Postgres + the existing Socket.IO gateway — no third-party chat provider.
12. **Studying is success.** All rewards are gated on meaningful study activity with anti-farming caps; the dashboard `hide-game-stats` toggle persists (§6/§7.2 of the PDF).

## Risks / Trade-offs

- **AI programme quality varies** — reviewer + admin override mitigates; rejected programmes stay visible to the suggester with reasons.
- **Email-optional auth** — password recovery for email-less accounts relies on username + password reset flow (no recovery email); keep username-based recovery documented.
- **Universal notes trusted source** — page selection reduces wrong-page citations but the AI can still misquote; keep `source: admin` markers so users can verify.
- **Lazy audit writes** — synchronous insert keeps guarantees simple; volume is low (admin actions only).
- **Faction settlement lazily triggered on reads** — correct for small deployments; PDF Phase 7 replaces this with a scheduled BullMQ job + outbox event.

## Shipped state (verified 2026-08-06)

- Migration `backend/migrations/023_study_phase6.sql` (unique prefix after `022`): audit_logs, programmes + programme_members, factions + faction_members + faction_score_events + faction_votes + faction_settlements + faction_help_pledges/activities, friendships + direct_messages, rpg_parties + rpg_party_members + rpg_party_battles, admin_notes, syllabus; `users.username` + nullable email + `is_active`.
- Backend modules (wired in `app.module.ts`): `admin` (seed + audit + user/role mgmt), `admin-notes` (notes + page selection + syllabus), `programmes` (AI build/review), `factions` (balancer + settlement + votes + pledges), `social` (friends + DMs + gateway), RPG party endpoints + `exam-bosses.ts`.
- Frontend: `services/admin|programmes|factions|social|rpg(party)`, pages Admin/Programmes/Factions/Social + RpgPartyTab, routes + nav + all 15 locale files.
- Unit tests: audit enforcement, programme flow, faction balancer + settlement, page selection, social flow, party battles (backend suite **202 tests**).
- Backend `tsc` clean; frontend `tsc -b --noEmit` clean (2026-08-06).
