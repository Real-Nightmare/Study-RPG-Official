# Master Implementation Plan — Studyield + Study RPG

> **Source of truth**: the owner's master prompt, *"Studyield + Study RPG — Foolproof Master
> Implementation Prompt V2"* (`Studyield Master Implementation Prompt.pdf`, 64 pages). The PDF lives
> in the owner's repository but is **not committed** to this checkout; this doc is the working
> translation of its phase plan into repository status, GitHub Spec Kit specs, and the owner's
> feature brief. Last synced: **2026-08-06**. Workflow: Spec Kit — specs in `specs/`;
> legacy OpenSpec archived at `archive/openspec/`.

## 1. The PDF's phase plan (abridged)

The PDF (§42) defines ten phases and forbids starting a later phase while the previous one fails its
build and tests (§42). Definition of Done is §43.

| PDF phase | Scope (abridged) |
|---|---|
| **0 — Audit** | repo map, build/test failures, security findings, licence contradiction, feature/dependency/database/deployment inventory |
| **1 — Architecture stabilisation** | workspace, config validation, PostgreSQL, Redis, BullMQ, Qdrant, API/worker split, health checks, logging, outbox, auth, licence notices |
| **2 — Studyield core** | academic structure, dashboard, tasks, focus, notes, flashcards, quizzes, mistake notebook, puzzles, exam periods, analytics |
| **3 — RAG** | storage, uploads, parsing, chunking, embeddings, Qdrant, hybrid search, citations, RAG chat, evaluation |
| **4 — Game foundation** | player profile, XP, STP, SLC, wallet ledger, cards, inventory, vault, deck, loot boxes |
| **5 — Battles** | worlds, monsters, bosses, battle engine, mana quizzes, damage challenges, shields, status effects, rewards, PvP |
| **6 — Economy** | marketplace, trades, pricing, scraper, burner, instalments, supply ledger, extinction, replacement |
| **7 — Events** | scheduler, quests, StudyPass, free & gold tracks, Abstracted, unabstracting, Great Extinction, Extinction Sigils |
| **8 — Advanced learning** | exam clone, problem solver, teach-back, learning paths, formula/concept tools, optional research/code sandbox |
| **9 — Hardening** | performance, accessibility, offline, security, privacy, load testing, backups, deployment, documentation |

## 2. Repo phase status (mirrors `IMPLEMENTATION_STATUS.md`)

| PDF phase | Repo status | Spec Kit spec(s) |
|---|---|---|
| 0 — Audit | ✅ complete (2026-08-04) | — (audits, AGENTS.md, IMPLEMENTATION_STATUS.md) |
| 1 — Architecture stabilisation | ✅ mostly complete (2026-08-04); ⚠️ deferred: env validation vs `.env`, outbox dispatcher, JWT refresh rotation, worker split | — |
| 2 — Studyield core | ✅ complete (2026-08-05) | `001-studyield-core`, `002-student-dashboard` |
| 3 — Production RAG | ✅ complete (2026-08-05) | `003-rag-vector-index`, `004-rag-retrieval-evaluation`, `005-rag-deletion`, `006-rag-reranking` |
| 4 — Game foundation | ✅ complete (2026-08-05); loot-box/economy slices deferred to Phase 6 | `007-study-rpg-core` |
| 5 — Battles | ✅ complete (2026-08-06): PvP duels + early **party battles** & **exam bosses** | `008-pvp-duels` (+ community track below) |
| 6 — Economy | ✅ complete (2026-08-06) — marketplace + offers, scraper, burner/instalments, supply ledger, official value, extinction + replacements | `010-study-economy` |
| 7 — Events | ✅ complete (2026-08-06) — always-active scheduler + Study Sprint fallback, 14-level StudyPass, Free/Gold tracks, data-driven quests, Abstracted + Limbo, Great Extinction + Sigils; faction monthly IST settlement machinery shipped early with the community track | `011-study-events` |
| 8 — Advanced learning | ✅ complete (2026-08-07): programme templates + one-click instantiate, AI review queue + batch review with full review history, AI-built programmes wired into personal learning paths with self-review + regeneration flag | `012-study-advanced-learning` |
| 9 — Hardening | ✅ complete (2026-08-07): audit-log export/retention/purge, DM moderation + rate limits, Web Push (VAPID), scheduled faction settlement job, admin system status, ops scripts (backup/restore/load-test) + runbooks + deployment docs | `013-study-hardening` |

## 3. The owner's community brief — fractions distributed across PDF phases

The owner's "Phase 6 extra" brief (Nightmare admin, AI-built programmes, email-optional accounts,
chat + friends, team battles, factions, exams as boss fights, universal admin notes, admin syllabus,
"studying is the success metric") was delivered **early as a single community track** — Spec Kit
spec `specs/009-phase6-study-community/`, migration `backend/migrations/023_study_phase6.sql`.
"Phase 6" there is the owner's brief, **not** the PDF's Phase 6 (Economy).

Each fraction below is mapped to the PDF phase it *naturally belongs to*. Fractions already shipped
are marked ✅ — the "Follow-up for the PDF phase" column is the remaining work to finish when that
PDF phase is reached.

| # | Fraction of the brief | Belongs to PDF phase | Status | Follow-up for that PDF phase |
|---|---|---|---|---|
| 1 | Built-in **Nightmare** super-admin (env-seeded), user/role management, teacher role | 2 (users/auth) + 9 (security) | ✅ shipped — `admin/` module, `NIGHTMARE_ADMIN_*` vars (default password `123456789`), seeding audit-logged | Phase 9: admin status dashboard, export/retention of audit logs |
| 2 | **Every admin action logged with a required reason**; teachers can view audit logs | 2 + 9 (security, §32) | ✅ shipped — `audit_logs` table, `AuditService.log()` (reason enforced), `GET /admin/audit-logs` | Phase 9: log retention policy + runbook |
| 3 | **Email optional**; register with username and/or email; identifier login; website notifications default | 2 (auth) + 1 (notifications infra, §4.10) | ✅ shipped — `users.username` (unique, nullable), `email` nullable, `is_active` gate, "Provide an email or a username" validation | Phase 1/9: standards-based Web Push (VAPID) as the optional push channel; keep email via SMTP adapter |
| 4 | **Admin-only syllabus** (students browse) | 2 (academic structure §7.1) | ✅ shipped — `syllabus` table, `POST/GET/DELETE /admin-notes/syllabus` (write admin-only, reason required) | — |
| 5 | **AI-built programmes**: anyone suggests → AI builds objectives/milestones/activities/effort + reward policy → immediately live for everyone | 2 (programme in academic structure) + 8 (AI-assisted learning) | ✅ shipped — `programmes` table + module, suggest → building → active, `AiService.complete` JSON build | Phase 8: link programmes into learning paths; programme templates |
| 6 | **AI programme reviewer** (real & useful vs bad/unnecessary), reward policy judged by AI, **admin override** | 8 (AI-assisted learning) | ✅ shipped — AI reviewer (verdict/score/reasons), `programme.review_*` audited admin override | Phase 8: batch review UI, review history |
| 7 | **Universal admin notes** as an AI trusted source (students can still upload their own) | 3 (RAG) | ✅ shipped — `admin_notes` table + module, universal flag, RAG context merge | Phase 3 hardening: index universal notes into Qdrant with `source: admin` citation markers |
| 8 | **PDF page selection** so the AI never quotes the wrong page (e.g. "the email of NCERT") | 3 (RAG chunking/grounding §8.8) | ✅ shipped — `selected_pages` JSONB + pure `page-selection.ts` module (unit-tested) | Phase 3: surface selected pages in citation builder |
| 9 | **Friends + self-hosted chat** (Postgres + Socket.IO; no third-party provider) | 5 (social layer for PvP/parties) | ✅ shipped — `friendships`, `direct_messages`, `social` gateway (`dm:new`, `friend:update`), search/request/accept/block | Phase 5/9: rate limits + content moderation on DMs (§32 "no unrestricted private messaging") |
| 10 | **Team-based fighting** — a player + up to 3 friends (4 heroes) | 5 (Battles — party battles) | ✅ shipped — `rpg_parties` (max 4), `rpg_party_battles`, `PartyService`, `POST /rpg/party-battles/:id/action` | Phase 5 hardening: full boss roster, balanced party rewards, party Elo |
| 11 | **Exams as boss fights** | 5 (Bosses) + §15 exam rewards | ✅ shipped — `exam-bosses.ts` (6 original named bosses: Syllabus Sentinel, Math Colossus, Science Golem, Language Wraith, History Tyrant, Geography Giant) | Phase 5: connect boss wins to exam reward tiers (§15) |
| 12 | **Original named abilities/items** (Blocktales-inspired, but original IP) | 4/5 (cards + battle content) | ✅ shipped — 9 original cards (Mana Slash, Study Burst, Poison Vial, Decay Curse, Focus Shield, Revival Note, Mana Battery, Silence Pact, Abstracted Recall) | — |
| 13 | **Factions auto-balanced** from total user count (28 → 4×7) | 7 (Events: recurring competition/rewards) | ✅ shipped — `faction-balancer.ts` (unit-tested), `POST /factions/auto-assign` | Phase 7: quest/StudyPass integration |
| 14 | Faction **score from study performance** (tasks, quizzes, XP, focus) | 2 (analytics) + 7 | ✅ shipped — `faction_score_events` (task_completed, quiz_attempt, xp_earned, study_session), `recordScoreEvent` | Phase 7: leaderboard mirrors in Redis |
| 15 | **2 leaders per faction, elected by members** | 7 | ✅ shipped — `faction_votes`, election view, `promote-leaders` (top-2) | — |
| 16 | **Help-the-weaker mechanic** — stronger factions must help weaker ones or lose an extra reward; weaker factions rewarded for improving marks/interest | 7 | ✅ shipped — `faction_help_pledges` + `faction_help_activities`, `GET /factions/help-pledges`, `POST /factions/:id/help` | Phase 7: settlement reward tuning + notifications |
| 17 | **Monthly (IST) settlement** — study-quality rewards each month, balanced | 7 (Events scheduler) | ✅ shipped — `faction_settlements`, IST period key helper, lazy `settleIfDue()`, `POST /factions/settle` | Phase 7: scheduled BullMQ job + outbox event + notification |
| 18 | **Factions are also programmes** (optional, e.g. Revision Centre, Competency Based Testing) | 2 (programmes) | ✅ shipped — `programmes.kind` ∈ custom/revision_centre/competency_testing/faction; `has_factions` + `faction_size` | — |
| 19 | **RPG is celebration, not goal** — students associate studying with success, never study-to-get-something | cross-cutting (§6, §7.2, §10) | ✅ — dashboard `hide-game-stats` toggle; study-first reward design; anti-farming caps | Ongoing in every phase |

## 4. Remaining phases and first follow-ups

- **Phase 6 — Economy**: ✅ complete (2026-08-06) — marketplace, fixed-price listings, offers,
  expiry, scraper, burner (idempotent instalments), supply ledger, extinction + replacement,
  official card value (spec `010-study-economy`).
- **Phase 7 — Events**: ✅ complete (2026-08-06) — scheduler with always-active fallback
  (Study Sprint), quests (data-driven), StudyPass (14 levels, 1750 EXP), free/gold tracks
  (1500 SLC), Abstracted event, Great Extinction + Extinction Sigils (spec `011-study-events`).
- **Phase 8 — Advanced learning**: ✅ complete (2026-08-07) — programme templates + instantiate
  (`012-study-advanced-learning`), AI review queue + batch review, AI programmes → personal learning
  paths with self-review + regeneration flag. Remaining exam clone / problem solver / teach-back
  tools were verified as pre-existing in the study-tools module (Phase 2).
- **Phase 9 — Hardening**: ✅ complete (2026-08-07) — audit-log export/retention/purge, DM
  moderation/rate limits, Web Push (VAPID), faction settlement job, admin status, ops scripts
  (backup/restore/load-test) + runbooks + deployment docs (`013-study-hardening`).

## 5. Definition of Done (PDF §43) — deltas

Everything in §43 is either complete or documented as blocked in `IMPLEMENTATION_STATUS.md`
"Blocked Items / Decisions Needed". The notable open deltas are: **loot-box odds**, **marketplace
settlement**, **scraper/burner**, **extinction**, **StudyPass tracks**, **always-active event
fallback**, **outbox dispatcher**, **Web Push**, **verified backups/restore**, and **deployment
documentation**.
