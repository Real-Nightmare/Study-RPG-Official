# Implementation Status

> Living tracker for the phased implementation plan (from `Studyield Master Implementation Prompt.pdf`).
> Updated after each phase/step. **Phase 0 (Audit): complete as of 2026-08-04.**
> **Phase 1 (Architecture Stabilisation): complete as of 2026-08-04** — see table below.
> **Phase 2 (Studyield Core): complete as of 2026-08-05** — Planner & Tasks ✅, Academic Structure ✅, Focus sessions ✅, Mistake notebook ✅, Puzzles ✅, Exam periods/Exam centre ✅, Student dashboard v2 ✅.
> **Phase 3 (Production RAG): complete as of 2026-08-05** — ingestion integrity, hybrid retrieval, versioned collections + reindex, retrieval evaluation, deletion pipeline, and reranker all ✅ (see table below).
> **Phase 4 (Study RPG core): complete as of 2026-08-05** — config-driven player stats/levels, immutable STP/SLC wallet ledger, original data-driven cards + 5-card restricted decks, deterministic server-authoritative battle engine with replayable logs, and battle rewards with anti-farming daily limits (see table below).
> **Phase 5 (PvP duels): complete as of 2026-08-06** — async Seeker duels: challenge by email or battle-rating matchmaking, deck-snapshot ghost avatars, Elo battle rating, transactional idempotent settlement, STP/XP rewards with anti-farming cap, and a rating leaderboard (see table below).
> **Phase 6 (Study Community — owner's brief, Spec Kit spec `009-phase6-study-community`): complete as of 2026-08-06** — Nightmare super-admin + reason-required audit log, email-optional auth, AI-built programmes (suggest→build→live→review), friends + self-hosted chat, auto-balanced factions with monthly IST settlement, party battles vs exam bosses, universal admin notes with PDF page selection, and admin-only syllabus (see table below).
> **Phase 7 (Study Events — PDF Phase 7, Spec Kit spec `011-study-events`): complete as of 2026-08-06** — always-active event scheduler with Study Sprint fallback + advisory lock, 14-level StudyPass with event EXP, Free/Gold tracks (1500 SLC), data-driven quests, the Abstracted event (unabstracting, Abstracted Errors, Limbo), and the Great Extinction (targets, Extinction Sigils, global pyre) (see table below).
> **Phase 8 (Advanced Learning — PDF Phase 8, Spec Kit spec `012-study-advanced-learning`): complete as of 2026-08-07** — programme templates + one-click instantiate, AI review queue with batch review + full review history, and AI-built programmes wired into personal learning paths with self-review + regeneration flag (see table below).
> **Phase 9 (Hardening — PDF Phase 9, Spec Kit spec `013-study-hardening`): complete as of 2026-08-07** — audit-log export/retention/purge, DM moderation + rate limits, standards-based Web Push (VAPID), scheduled faction settlement job, admin system status dashboard, ops scripts (backup/restore/load-test) + runbooks + deployment docs (see table below).
> **Owner brief — Study RPG Integrity / F2W Meritocracy (Spec Kit spec `014-study-integrity`): complete as of 2026-08-07** — exponential reward curve, anti-cheese behavioural guards enforced in all five reward paths, the metacognitive Campfire loop (AI synthesis question → 1.0–1.5× multiplier) before reward cash-ins, mastery-framed UI copy, and zero pay-to-win paths (see table below).
> **Owner brief — Data Marketplace & AI Effectiveness Benchmark (Spec Kit spec `016-study-data-marketplace`): complete as of 2026-08-14** — privacy-first Ocean Protocol publish path (aggregates only, consent-gated, min cohort + coverage, checksummed DDO) plus the admin AI benchmarking pipeline (two-window deltas → weighted 0–100 effectiveness score → AI narrative grounded in metrics only), and the idle-capacity Ocean Node that earns provider fees when the server is fully idle (anti-flap cooldown + rolling daily start cap). **Compute-to-Data (C2D) added 2026-08-15** — real on-chain publishing via the official Ocean.js SDK: ERC721 + datatoken (+ fixed-rate exchange) deployed on Polygon mainnet (owner's 2 MATIC), file/DDO encryption via the Ocean Node, compute-policy DDO stored on-chain, graceful metadata-first fallback. See the table below.
> **Owner follow-up — Anti-OverStudy & Health-First Wellbeing (Spec Kit spec `015-study-wellbeing`): complete as of 2026-08-09** — every AI surface now speaks the canonical product philosophy (depth over length, health-first anti-overstudy guardian, game-to-reality framing), and the reward economy heavily dampens over-study: focus-session start gates (rest cooldown, exhaustion, night-rest nudge), diminishing-returns decay on focus/event rewards beyond the healthy daily optimum, and a study-health meter in the UI (see table below).
> **Phase map**: the owner's brief is the **community track**; the fractions map onto the real phases of the *Studyield Master Implementation Prompt.pdf* (Phase 6=Economy, 7=Events, 8=Advanced Learning) in `docs/implementation/MASTER_PLAN.md` §3.
> **Owner policy — fully-local stack + strict compute-to-data marketplace (completion-plan Waves 1–2): complete as of 2026-08-25** — MARKETPLACE_ENABLED off by default with 501 surfaces, compute-to-data ONLY publishing (no download/access path, no metadata-only fallback), PII value-level scan, network access permanently off for compute jobs, isolated c2d-runner container + researcher test harness, Ollama/Mailpit/MinIO/SearXNG local services wired into compose, VAPID auto-provisioning, FCM/billing gates. See table near the end of this file.
> **Spec workflow**: GitHub Spec Kit adopted 2026-08-06 — feature specs live in `specs/` (index: `specs/README.md`, constitution: `.specify/memory/constitution.md`); the legacy OpenSpec workspace is archived at `archive/openspec/`.

---

## Legend

- ✅ Done / verified
- 🔄 In progress
- ⏳ Planned / not started
- ⚠️ Blocked / needs decision or credentials
- 🔴 Known failure or contradiction

---

## Phase 0 — Audit

| Item | Status | Notes |
|------|--------|-------|
| Repository map | ✅ | Full structure mapped (backend 24 modules/157 TS files; frontend 76+ pages/147 files; 18 migrations) |
| Upstream file provenance inventory | ✅ | `docs/audits/UPSTREAM_FILE_INVENTORY.md` — all 405 upstream Studyield files (git commit `0494e1a`), 133 modified by Study RPG work, 459 new original files |
| Build failures recorded | ✅ | Backend build ✅ · Frontend build ✅ (6 MB chunk warning); backend lint script 🔴 broken glob; CI lint step will fail |
| Test failures recorded | ✅ | Backend: **zero tests** (`npm test` exits 1); frontend: **no test script** |
| Security findings | ✅ | Reflecting CORS + credentials (High); unconditional Swagger; 50 MB bodies; see audit §4 |
| Licence contradiction | ✅ | Documented in `docs/audits/LICENSE_AUDIT.md` — root AGPL-3.0 vs Apache-2.0 metadata; **awaiting owner decision** ⚠️ |
| Feature inventory | ✅ | Backend modules + frontend pages catalogued in `docs/audits/INITIAL_REPOSITORY_AUDIT.md` §6 |
| Dependency inventory | ✅ | Audit §7 |
| Database inventory | ✅ | ~49 tables across 18 migrations; 🔴 prefix collisions at 002/006/010 |
| Deployment inventory | ✅ | Docker stack, Dockerfiles, nginx, CI, env vars — audit §9 |
| `docs/audits/INITIAL_REPOSITORY_AUDIT.md` | ✅ | Created |
| `docs/audits/LICENSE_AUDIT.md` | ✅ | Created |
| `AGENTS.md` | ✅ | Created |
| `IMPLEMENTATION_STATUS.md` | ✅ | This file |
| Phased Goose recipes | ⚠️ | **Deferred** — Goose CLI not installed in this environment; requires the prompt's Goose schema to be provided/installed |

---

## Phase 1 — Architecture Stabilisation

| Item | Status | Notes |
|------|--------|-------|
| Fix backend `npm run lint` glob | ✅ | `"src/**/*.ts"` (was `{src,apps,libs,test}/**/*.ts`) — `npm run lint` now passes |
| Backend test scaffolding + first unit tests | ✅ | Jest config already existed in `package.json`; added `camel-case.interceptor.spec.ts`; `npm test` passes |
| Migration prefix collision cleanup (002, 006, 010) | ✅ | Renamed to `002b`/`006b`/`010b` (order-preserving; `migrate.js` sorts lexically + tracks by filename) |
| Licence alignment (Option A / ADR-0001) | ✅ | AGPL-3.0 in both package.json files + lockfile, NOTICE, README.md + 12 translations, CHANGELOG; `UPSTREAM.md`, `THIRD_PARTY_NOTICES.md`, ADR created; in-app footer links (15 locales) |
| CORS hardening | ✅ | `CORS_ORIGINS` allowlist (defaults localhost set); unknown origins → 403; dropped origin-reflection + credentials combo |
| Swagger gating + security headers | ✅ | Swagger disabled in production unless `SWAGGER_ENABLED=true`; `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-XSS-Protection` headers |
| Frontend code-splitting | ✅ | `manualChunks` in `vite.config.ts` (katex, charts, radix, markdown, motion, router, data, react-vendor, vendor) |
| Configuration validation (env vars vs `.env.example`) | ⏳ | Needs `.env.example` access/keys; blocked by workspace secret policy |
| PostgreSQL / Redis / BullMQ / Qdrant config validation | ⏳ | Needs running services (Docker unavailable in workspace) |
| API and worker split (BullMQ workers in API process) | ⏳ | Deferred — architecture decision needed |
| Health checks / structured logging / outbox | ⏳ | Deferred |
| Authentication review (JWT refresh rotation, OAuth) | ⏳ | Deferred |
| Frontend test runner | ✅ | Vitest + jsdom + Testing Library installed; `vitest.config.ts`, `src/test/setup.ts`, `src/lib/utils.test.ts` (6 tests pass); `npm test` script added |
| Live smoke test of core flows | ⏳ | Blocked: needs DB + AI credentials |

---

## Phase 2 — Studyield Core (continued — remaining items)

Academic structure · Dashboard · Tasks · Focus · Notes · Flashcards · Quizzes · Mistake notebook · Puzzles · Exam periods · Analytics.

> Phase 3 has started (builds/tests green). The remaining Phase 2 feature items below are **not blockers** — they will be implemented as gap-fill alongside Phase 3.

| Item | Status | Notes |
|------|--------|-------|
| Planner & Tasks (first new core tool) | ✅ | New `PlannerModule` (migration `015_study_tasks.sql`: tasks with priority/type/subject/due-date/recurrence + subtasks); full CRUD + complete/reopen + today-summary endpoints; `TasksPage` with create form, open/completed columns, priority badges, animated transitions; wired into router, dashboard nav (all 15 locales) |
| Academic structure (subjects/chapters/topics/exams/portions + school profile) | ✅ | Migration `016_academic_structure.sql` (academic_profiles, subjects, chapters, topics, exams, exam_portions); `AcademicsModule` (CRUD + nested structure endpoint); editable CBSE Grade 9 preset seeded per-user (Mathematics, Science, Social Science, English, Hindi, IT with chapters/topics); `AcademicsPage` with Profile/Subjects/Exams tabs (expandable subject→chapter→topic tree, exam portions, colour-coded subjects); wired into router, dashboard nav (all 15 locales); 9 unit tests |
| Focus sessions (§7 study tools) | ✅ | Spec Kit spec `001-studyield-core`: `FocusSessionsModule` (migration `020_study_tools.sql`) — start/pause/resume/complete with task/subject links, accumulated focus minutes, today summary by subject, ownership checks; `FocusSessionsPage` with live timer + history; nav + locales |
| Mistake notebook (§7 study tools) | ✅ | `MistakesModule` — CRUD with subject/chapter links, categories (concept/careless/time/guess/other), cause, resolve/reopen lifecycle, status counts; `MistakesPage` with filters + search |
| Subject puzzles (§7.9) | ✅ | `PuzzlesModule` — per-subject original puzzles, ranked vs practice, streak up/reset (+shield flag), personal best, attempt history, daily ranked limit, no immediate reuse (pure `puzzle-streak.ts` rules, unit-tested); `PuzzlesPage` with subject cards, mode toggle, solve flow, history |
| Exam periods / exam centre (§7.10) | ✅ | `ExamPeriodsModule` — periods with derived status (upcoming/live/ended), attach exams, record results with mistake analysis + revision plan, nearest upcoming exam; `ExamCentrePage` with calendar + results; portions re-use the academics module |
| Student dashboard upgrade (§7.2) | ✅ | Spec Kit spec `002-student-dashboard`: `DashboardModule` — `GET /dashboard/summary` (today plan, tasks due, upcoming exams, portions, focus minutes, flashcards due, quiz accuracy 30d, recent mistakes, weak topics, puzzle + study streaks, game stats, daily quests, rule-based recommended next action) + `GET/PUT /dashboard/preferences` with **hide-game-stats** (omits game stats from the payload); `DashboardHomePage` reworked to a live widget grid with the toggle; nav + locales |
| Notes / Flashcards / Quizzes / Exam Clone / Analytics | ✅ | Pre-existing (audit §6) — verified present |

## Phase 3 — Production RAG

Storage · Uploads · Parsing · Chunking · Embeddings · Qdrant · Hybrid search · Citations · RAG chat · Evaluation.

| Item | Status | Notes |
|------|--------|-------|
| Storage / uploads / parsing (PDF, DOCX, TXT, MD) | ✅ | Pre-existing (audit §6) — `StorageService`, `DocumentProcessorService` (pdf-parse, mammoth) |
| Structure-aware chunking (paragraph/sentence, configurable size+overlap) | ✅ | Pre-existing — `ChunkingService` |
| Embedding provider abstraction (§8.9) | ✅ | New `EmbeddingProvider` interface; `EmbeddingService implements EmbeddingProvider` (model + version exposed for index versioning) |
| Ingestion state machine (§8.3) | ✅ | New `rag-ingestion-state.ts` (14 explicit states, valid transitions, retry history, progress); persisted via `documents.ingestion_state` + `retry_count`/`last_error`/`retry_history`; wired into `processDocument` (parsing→chunking→embedding→indexing→ready/failed) |
| Content deduplication (§8.4) | ✅ | New `content-hash.ts` (SHA-256, normalised hashing); per-chunk hashes stored (`kb_chunks.content_hash`), duplicate chunks skipped before re-embedding in `processDocument`/`addText` |
| Hybrid retrieval (§8.7) | ✅ | New `HybridRetrieverService`: dense (Qdrant) + lexical (PostgreSQL FTS via new GIN tsvector index) + Reciprocal Rank Fusion + min-score threshold + content dedup + source diversity; `mode=dense|lexical|hybrid` on `POST /knowledge-bases/:id/search` |
| Qdrant collection versioning + background reindex (§8.6, §8.9) | ✅ | Spec Kit spec `003-rag-vector-index`: versioned collection names from embedding provider version; `CollectionResolver` (env override `QDRANT_COLLECTION_VERSION` > `rag_index_state` > derived; `legacy` seed keeps existing points reachable); `ReindexService` + `rag-reindex` BullMQ worker (scroll old → re-embed → upsert new → switch active version → purge superseded); admin `POST /rag/reindex`; 11 unit tests |
| Retrieval evaluation (§8.10) | ✅ | Spec Kit spec `004-rag-retrieval-evaluation`: `EvaluationService` (case add/list/delete KB-scoped, `run(kbId,{k,limit})` via `HybridRetrieverService` with per-case latency + cross-KB leakage detection); pure metrics module `rag-eval-metrics.ts` (recall@K, precision@K, f1@K, percentiles, empty-rate, aggregate report); migration `019_rag_eval_cases_extend.sql` (KB FK cascade, distractor/expected-pages/created_by); admin endpoints `POST/GET /rag/eval-cases`, `DELETE /rag/eval-cases/:id`, `POST /rag/evaluate`; 12 unit tests |
| Deletion pipeline (§8.5) | ✅ | Spec Kit specs `005-rag-deletion` + `006-rag-reranking`: `DocumentDeletionService` — per-document `deleting→deleted` state walk (refuses mid-ingestion `parsing`/`embedding`/`indexing`, deletes `kb_chunks` rows + active-collection Qdrant points via `CollectionResolver`, failure rollback to `failed` + `last_error`); `DELETE /knowledge-bases/:id/documents/:docId`; KB delete reuses the same cleanup; 5 unit tests |
| Reranker (§8.8) | ✅ | `RerankProvider` interface (OpenRouter / OpenAI-compatible / Ollama) + `RerankService` env-selected (`RERANKER_PROVIDER`/`MODEL`/`API_URL`/`API_KEY`), no-op provider when unconfigured; optional rerank stage in `HybridRetrieverService` (`rerank`, `rerankTopK` on search; payload `reranked` flag); graceful degradation to fusion order; 6 unit tests |
| Context builder / citation builder | ✅ | Pre-existing chat citations verified present |

## Phase 4 — Study RPG core (Spec Kit spec `007-study-rpg-core`)

Config-driven stats · STP/SLC wallet · Original cards & decks · Deterministic battle engine · Rewards & anti-farming. STP is the single in-game currency, also called **SLC**.

| Item | Status | Notes |
|------|--------|-------|
| Player stats & progression (§12) | ✅ | `player_profiles` (XP, level, STP/SLC, battle rating, study streak, puzzle streak, event EXP) + `PlayerService` (grants XP, level-ups, mirrors legacy `user_xp_events` feed); level thresholds config-driven via `game_config` `rpg.levels` (pure `level-curve.ts`) |
| STP/SLC wallet with immutable ledger (§14) | ✅ | `WalletService` — every mutation appends `wallet_ledger` (txn id, user, currency, amount, balance before/after, type, reason, related entity, idempotency key, actor) inside `BEGIN … SELECT … FOR UPDATE`; integer-only, no negative balances, unique (user, idempotency_key) replay protection; single currency **STP (a.k.a. SLC)**, one balance |
| Original cards & restricted decks (§13.2, §13.7) | ✅ | Data-driven `card_definitions` (9 original cards, original lore — no third-party content), per-user `card_instances` (starter pack auto-granted on first visit), `decks` + `deck_cards` (exactly 5, slots 0–4) with restricted-ability validation (one Poison / one Decay / one Shield / one Silence) enforced on save **and** before battle; invalid decks marked + must be repaired |
| Deterministic battle engine (§13) | ✅ | Pure `battle-engine.ts` + `seeded-rng.ts` (mulberry32, injectable); server-authoritative, full replayable `battle_log`; §13.1 turn flow (start effects → shield first two turns → status processing → optional mana quiz / damage challenge → validation → mana payment → target resolution → damage calc → status application → defeat/reward check → end-of-turn); DoT logged separately from immediate damage (§13.6); abilities data-driven, no per-card switches (§13.7); 6 original monsters + boss across worlds |
| Battle rewards & anti-farming (§15-adjacent) | ✅ | XP + STP granted on win atomically (wallet ledger + `user_xp_events` + profile in one transaction), idempotent claim key `battle_win:<id>`; daily limits from `game_config` `rpg.rewards` (10 wins / 200 STP / 300 XP); battles still complete when limited |
| API + module | ✅ | `RpgModule` registered in `app.module.ts`; `rpg.controller.ts`: profile, ledger, cards, collection, decks CRUD + equip, battles create/action/quiz/challenge/forfeit/history (JWT-guarded, DTO-validated) |
| Frontend | ✅ | `services/rpg.ts` + types; `RpgPage` with Character / Decks / Battle tabs — XP progress, wallet balance, deck builder with restricted-ability picker, animated battle screen (monster, HP/mana bars, shield, hand, cooldowns, live log, reward banner); route `/dashboard/rpg` + nav entry (`nav.rpg`) in all 15 locales |
| Tests | ✅ | 35 RPG unit tests: engine determinism (same seed → same log), shield/status rules, mana quiz + damage challenge, deck restricted-ability rules, level-curve mapping, wallet ledger invariants + idempotency, battle service flow (create, quiz grading, win rewards, daily limit, idempotent claim, forfeit) — backend suite now **139 tests** |
| Migration | ✅ | `021_study_rpg.sql` (nine tables + `game_config` seed: battle defaults, level thresholds, reward limits); prefix unique and ordered after `020` |

---

## Phase 5 — PvP duels (Spec Kit spec `008-pvp-duels`)

Async Seeker duels · Ghost avatars · Elo rating · Settlement · Rewards & leaderboard. Each side fights a deterministic ghost of the opponent's deck snapshot through the existing battle engine — fair, cheap, and fully replayable (no live-sync needed).

| Item | Status | Notes |
|------|--------|-------|
| Schema + config | ✅ | Migration `022_study_pvp.sql`: `pvp_duels` (deck snapshots JSONB, battle refs, ratings before/after, winner, margins, rewards, expiry, status) + `battles.pvp_duel_id` FK + indexes; `game_config` `rpg.pvp` seed (ghost HP/attack derivation, Elo K, STP/XP rewards, daily PvP win cap, expiry hours, rating window) |
| Pure modules | ✅ | `pvp-ghost.ts` (deck snapshot → ghost avatar stats), `pvp-rating.ts` (Elo expected score + deltas, floor 0), `pvp-settlement.ts` (winner decision matrix — decisive, HP%, turns, draw) |
| Service + API | ✅ | `PvpService`: create (email challenge \\| matchmaking fallback by rating window), list, get, `startBattle` (snapshots own deck, creates ghost battle, world `pvp`/monster `pvp_ghost`), transactional idempotent `settle` (locked, status re-check, rating + rewards, expiry default win), `expireOverdue`; DTO-validated `POST /rpg/pvp/duels`, `GET /rpg/pvp/duels`, `GET /rpg/pvp/duels/:id`, `POST /rpg/pvp/duels/:id/battle`, `GET /rpg/pvp/leaderboard`; `RpgModule` + `NotificationsModule` wiring; `BattleService.create` accepts custom monster + `pvpDuelId` |
| Tests | ✅ | 10 PvP unit tests: ghost avatar stats, Elo math, settlement matrix, PvpService flow with mocked db (challenge/matchmake, start battle, idempotent settle, rewards + daily limit, expiry default win, unknown email) — backend suite now **166 tests** |
| Frontend | ✅ | `services/rpg.ts` PvP calls + `api.ts` endpoints + types (`RpgPvpDuel`, `RpgPvpLeaderboardEntry`, …); `RpgPage` Duel tab — challenge by email / random matchmaking, duel list, ghost battle through the existing battle screen, leaderboard; `rpg.pvp.*` + `rpg.tab.duel` keys in all 15 locales |
| Migration | ✅ | `022_study_pvp.sql`; prefix unique and ordered after `021` |

---

## Phase 6 — Study Community (Spec Kit spec `009-phase6-study-community`)

Nightmare admin & audit · Email-optional auth · AI-built programmes · Friends + chat · Factions · Party battles & exam bosses · Admin notes & syllabus. This is the owner's "Phase 6 extra" brief delivered as a single **community track** (migration `023_study_phase6.sql`); its fractions map onto the PDF's real phases in `docs/implementation/MASTER_PLAN.md` §3.

| Item | Status | Notes |
|------|--------|-------|
| Migration | ✅ | `023_study_phase6.sql` (unique prefix after `022`): audit_logs, programmes + programme_members, factions + faction_members + faction_score_events + faction_votes + faction_settlements + faction_help_pledges/activities, friendships + direct_messages, rpg_parties + rpg_party_members + rpg_party_battles, admin_notes, syllabus; `users.username` + nullable email + `is_active` |
| Nightmare super-admin + audit | ✅ | `AdminService.onModuleInit` seeds the admin when none exists (`NIGHTMARE_ADMIN_USERNAME`/`EMAIL`/`PASSWORD`, default `123456789`); seeding audit-logged; `AdminModule` — list/create/update users, reset password, `GET /admin/audit-logs`; `AuditService.log` requires a reason; teachers can read audit logs |
| Email-optional auth | ✅ | `users.username` (unique partial index) + nullable email; register with username and/or email; login by identifier; `is_active` gate |
| AI-built programmes | ✅ | `ProgrammesModule` — suggest → `building` → AI builds objectives/milestones/activities/effort + reward policy → `active` immediately; AI reviewer (accepted/rejected + score + reasons); admin override + archive (audited, reason required); `kind` incl. revision_centre / competency_testing / faction |
| Social: friends + self-hosted chat | ✅ | `friendships` + `direct_messages`; `SocialModule` — user search, request/accept/decline/block, conversations, messages, unread; `SocialGateway` (`dm:new`, `friend:update`) over the existing Socket.IO infrastructure — no third-party chat provider |
| Factions | ✅ | `FactionsModule` — auto-balancer (`faction-balancer.ts`, target size e.g. 28→4×7), score events (task_completed/quiz_attempt/xp_earned/study_session per IST period), member votes + top-2 `promote-leaders`, help pledges/activities (help-the-weaker), monthly **IST** settlement (`faction_settlements`, lazy `settleIfDue` + `POST /factions/settle`) |
| Party battles + exam bosses | ✅ | `rpg_parties` (leader + up to 3 friends = 4 heroes), `rpg_party_battles`; `PartyService` create/invite/leave/start/action; `exam-bosses.ts` — 6 original named bosses (Syllabus Sentinel, Math Colossus, Science Golem, Language Wraith, History Tyrant, Geography Giant) |
| Universal admin notes + PDF page selection | ✅ | `admin-notes/` — `admin_notes` table, universal flag, per-page extraction, `page-selection.ts` (pure, unit-tested) filtering indexed pages; universal notes merged into RAG chat context with `source: admin` |
| Admin-only syllabus | ✅ | `syllabus` table (board, grade, subject, chapters JSONB); admin write (reason required, audited), everyone reads |
| Frontend | ✅ | `services/admin|programmes|factions|social|rpg` (party/exam-bosses); pages Admin (users/audit/notes/syllabus), Programmes, Factions, Social (friends + realtime chat), RpgPage PartyTab; routes + nav (admin hidden from non-admin/non-teacher); locales in all 15 files; frontend typecheck clean |
| Tests | ✅ | New unit tests: audit enforcement, programme build/review, faction balancer + settlement, page selection, social flow, party battles — backend suite **202 tests** (2026-08-06) |
| Docs | ✅ | `docs/implementation/MASTER_PLAN.md` — PDF phase map + brief fractions → PDF phases (factions→PDF Ph7 Events, party battles→PDF Ph5 Battles, admin notes→PDF Ph3 RAG, Nightmare admin→PDF Ph2, economy/events/hardening→Ph6/7/9) |

---

## Phase 6 (PDF) — Study RPG Economy (Spec Kit spec `010-study-economy`)

Official card value · Supply ledger & extinction · Marketplace & offers · Scraper & burner (instalments). The PDF's real **Phase 6** — marketplace liquidity with a supply-tied official value, deflationary sinks, and admin housekeeping. Migration `024_study_economy.sql`.

| Item | Status | Notes |
|------|--------|-------|
| Card value & supply (§16.3, §21) | ✅ | Pure `card-value.ts` (rarity base value → supply-adjusted multiplier with decay floor), `supply.ts` (reconcile counters from `card_instances`, seed official values + price history, `checkExtinction` — zero active supply ⇒ lock definition, retire print run, activate `Echo of …` replacement with fresh print + base value) |
| Marketplace & offers (§20) | ✅ | `EconomyService` — list marketplace (rarity/cardKey/mine filters, has-my-offer), list card (24h expiry, idempotent), cancel, atomic `buyListing` (locked buyer wallet, debit → ownership transfer → credit seller → mark sold → cancel sibling offers in one transaction), offers (make/accept/decline/cancel), settlement at the offered price, inventory/vault moves with capacity; `wallet.applyChangeWithClient` refactor exposes atomic client-based mutations |
| Scraper & burner (§22, §23) | ✅ | `BurnerService` — scrap = permanent removal + immediate payout at official value; burn = payout in instalments (first immediately, rest on schedule via pure `burn-instalments.ts` planner), idempotent per-instalment wallet entries, burn status endpoint, `processDueInstalments` pays every due run |
| Supply ledger & extinction (§21, §24) | ✅ | Migration `024_study_economy.sql`: `card_definitions` supply columns + `card_price_history` + `card_supply_ledger` + `marketplace_listings` + `marketplace_offers` + `card_burn_instalments` + `game_config` `economy` seed (scrape 80%, burn 4 instalments × 100%/24h, initial print 400) |
| API | ✅ | `EconomyModule` registered in `app.module.ts`; `POST/GET /economy/*` — marketplace, listings CRUD, buy, offers CRUD, cards/move, cards/:id/scrape · burn · burn-status, supply report + price history, admin reconcile + process-burn-instalments (RolesGuard ADMIN) |
| Tests | ✅ | 54 economy unit tests (card value, instalment plan, supply reconcile/extinction, marketplace/offers/burner flows) — backend suite now **256 tests** |
| Frontend | ✅ | `services/economy.ts` + `api.ts` endpoints + types; `EconomyPage` — Marketplace (rarity filters, buy/offer, pending offers accept/decline/cancel), My Cards (move vault/inventory, list for sale, scrap/burn with confirm dialogs, burn instalment progress), Supply (report table, expandable price history, admin reconcile/pay buttons); route `/dashboard/economy` + nav entry (`nav.economy`) in all 15 locales; frontend typecheck clean |

---

## Phase 7 — Study Events (Spec Kit spec `011-study-events`)

Always-active event scheduler · StudyPass (14 levels) · Free/Gold tracks · Data-driven quests · Abstracted event · Great Extinction. Delivers the PDF's real **Phase 7** (§25–§30). Migration `025_study_events.sql`.

| Item | Status | Notes |
|------|--------|-------|
| Migration + config | ✅ | `025_study_events.sql` (unique prefix after `024`): events, user_event_state, quests + user_quests, event_items + user_event_items, abstracted_instances, event_extinction_targets, event_global_milestones + user_milestone_claims; `game_config` seed `rpg.events` (gold cost 1500, 14 level thresholds, EXP rates, fallback, loot-box weights); seeds Abstracted (active NOW→+30d, quests, items, 10 extinction targets 5/5 split) |
| Scheduler (US1) | ✅ | `event-scheduler.ts` + `StudyEventsService.ensureActiveEvent` — lazy scheduled→active→ended transitions, **Study Sprint fallback** created atomically under `pg_advisory_xact_lock` when nothing is live/scheduled, admins warned **before** activation; `GET /events/current` never empty after first boot |
| StudyPass (US2, US3) | ✅ | `study-pass.ts` pure module — 14 cumulative thresholds 0/100/…/1750, `levelForExp`/`claimableLevels`; event EXP stored separately (`user_event_state.event_exp`) and accrues only from `recordStudyActivity` during an active event; Free/Gold tracks — Gold 1500 SLC (idempotent wallet debit), track locks before first claim, mutual exclusivity, no double claims |
| Study-activity feed | ✅ | `StudyEventsService.recordStudyActivity` hooked into tasks.complete, focus-sessions.complete (minutes), puzzles solve, quiz submitAttempt, battle victory (battle_win/boss_win); no active event ⇒ no-op |
| Quests (US4) | ✅ | `quest-rules.ts` pure module (IST day / ISO week / event-long period keys, progressDelta, completion) + `QuestsService` — data-driven daily/weekly/study/puzzle quests, single claim of STP / event EXP / event items, sigil-consumption objectives |
| Abstracted event (US5) | ✅ | `AbstractedService` — unabstract (irreversible, confirm required, retires instance, grants configured Legendary result + 1 Abstracted Error + 500 STP, supply ledger entry, audited with reason); 7 Errors → untradeable **Limbo** Legendary once; `myAbstracted` for the UI |
| Great Extinction (US6) | ✅ | `ExtinctionService` — seeds exactly 10 targets (5 weakest Common→Rare + 5 underused Legendaries by official value, admin override), burning a target grants a tradeable **Extinction Sigil** + global pyre progress, milestone one-shot claims, friend-only Sigil transfer, preserve-a-card quest via Sigil consumption; `onCardBurned` hooked into the economy burner |
| Cards & loot boxes (cross) | ✅ | `CardService.grantEventCard` (ensure-definition + instance insert in one txn, untradeable support) + `openLootBox` (weighted rarity pick via `loot-boxes.ts`, published odds in API payload) |
| API | ✅ | `EventsModule` (@Global, registered in `app.module.ts`) — `GET /events/current` · `/events` · `/events/:slug`, StudyPass `POST /events/current/study-pass/track|claim`, quests list/claim, items, sigil transfer, abstracted unabstract/limbo, extinction targets/milestones (+claim), admin create/activate (RolesGuard ADMIN, audited reason) |
| Tests | ✅ | 8 new suites: study-pass, event-scheduler, quest-rules, loot-boxes, events.service, quests.service, abstracted.service, extinction.service — backend suite now **302 tests** |
| Frontend | ✅ | `services/events.ts` + `api.ts` endpoints + types; **`EventsPage`** — live event banner (story/status/countdown), StudyPass progress bar + 14 pips with claimable rewards, Free/Gold track picker (Gold confirm dialog), quest list by category with claim, event items inventory, Sigil transfer to friend, Abstracted unabstract (reason) + Limbo redemption, extinction targets + global pyre milestone, admin schedule/activate/reseed; route `/dashboard/events` + nav entry (`nav.events`) + full `events` locale namespace in all 15 locales; typecheck + eslint + build clean |

## Phase 8 — Advanced Learning (Spec Kit spec `012-study-advanced-learning`)

Programme templates · AI review queue + batch review · AI programmes wired into personal learning paths (self-reviewed). Delivers the PDF's real **Phase 8**. Migration `026_study_advanced.sql`.

| Item | Status | Notes |
|------|--------|-------|
| Migration | ✅ | `026_study_advanced.sql` (unique prefix after `025`): `programme_templates` (name, description, kind, outline JSONB, active, audit trail columns) + `learning_paths` `programme_id`/`programme_name`/`review`/`needs_regeneration` columns |
| Templates (US2) | ✅ | `ProgrammesService.listTemplates/createTemplate/updateTemplate/deleteTemplate` — admin CRUD with required reason + audit rows; `suggestFromTemplate(userId, templateId, opts)` reuses the normal AI build path with `templateOutline` passthrough; `review-queue.ts` predicate + history append helper (`needsReview`, `reviewHistoryAppend`, capped) |
| Review queue (US3) | ✅ | `ProgrammesService.reviewQueue()` — programmes with no human verdict yet (filters AI-review-only rows); `batchReview(actorId, items)` applies verdict per item with audit + history, refuses archived; `adminReview` + `reviewWithAi` append to `review_history` |
| Learning paths from programmes (US1) | ✅ | `LearningPathsService.generateFromProgramme(userId, programmeId)` — only active programmes; AI maps objectives/milestones/reward policy into 8–14 ordered steps; **self-review** (`reviewPath`, score/verdict/reasons, never blocks) and `needs_regeneration` flag when score < 60; links `programme_id`; graceful failure fallback |
| API | ✅ | `GET /programmes/templates` (public) · `POST/PATCH/DELETE /programmes/templates` (admin, reason) · `POST /programmes/templates/:id/suggest` · `GET /programmes/review-queue` · `POST /programmes/batch-review` · `POST /programmes/:id/learning-path` |
| Tests | ✅ | 3 new suites: `review-queue.spec.ts` (predicate matrix + cap), `programmes.service.spec.ts` (templates CRUD + audit, queue filter, batch review, admin review, applyReview history), `learning-paths.service.spec.ts` (from-programme build, self-review scoring, needs-regeneration, ownership) — backend suite now **373 tests** |
| Frontend | ✅ | `api.ts` endpoints + `services/programmes.ts` (templates, review queue, batch review, from-programme) + `services/learningPaths.ts`; `types/index.ts` (`ProgrammeTemplate`, `ReviewQueueItem`, `BatchReviewItem`, …); **`ProgrammesPage`** — templates strip (browse/instantiate, admin CRUD), review queue tab with per-item + batch approve/reject; **`LearningPathsPage`** — programme badge on linked paths + regenerate CTA when `needsRegeneration`; full `programmes`/`learningPaths` locale namespaces in all 15 locales; typecheck + eslint + build clean |

## Phase 9 — Hardening (Spec Kit spec `013-study-hardening`)

Audit-log export/retention/purge · DM moderation + rate limits · Web Push (VAPID) · scheduled faction settlement · admin system status · ops scripts + runbooks + deployment docs. Delivers the PDF's real **Phase 9** (§32, §41, §43). Migration `027_study_hardening.sql`.

| Item | Status | Notes |
|------|--------|-------|
| Migration + deps | ✅ | `027_study_hardening.sql` (unique prefix after `026`): `audit_retention_config` (days, set_by, set_at, reason), `web_push_subscriptions` (user_id, endpoint PK, keys, created_at); `web-push` + `@types/web-push` added to `backend/package.json` |
| Audit export/retention (US1) | ✅ | `AuditService.exportCsv/exportJson` (same filters as list); `getRetention/setRetention(actorId, days, reason)` persisted to `audit_retention_config`; `purgeOlderThan(days)` under advisory lock deletes stale rows and returns count; `audit-retention.ts` pure helpers (`retentionWindow`, `purgeCondition`, `normalizeRetentionDays`) + `AdminModule` BullMQ `audit-retention` worker; controller endpoints `GET/POST /admin/audit/export`, `GET/POST /admin/audit/retention`, `POST /admin/audit/purge` |
| DM moderation + rate limits (US2) | ✅ | `social/dm-moderation.ts` — `blockedWordHits`, `moderationVerdict`, `isRateLimited` (per-user per-minute); `SocialService.sendMessage` blocks moderated content (audited `social.dm_moderated`) and rate-limits (`social.dm_rate_limited`) |
| Web Push VAPID (US3) | ✅ | `web-push.service.ts` in `NotificationsModule` — graceful no-op when `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` unset, subscribe/unsubscribe/public-key endpoints; `frontend/public/sw.js` service worker + `NotificationSettingsPage` push enable block (hidden without a public key) |
| Faction settlement job (US4) | ✅ | `FactionsModule` registers repeatable `faction-settlement` BullMQ job (daily check; `settleIfDue` is IST-period idempotent) |
| System status (US5) | ✅ | `AdminService.status()` — users by role, audit count, active events/factions, queue stats, health flags (db/redis) for `GET /admin/status` |
| Ops scripts + docs | ✅ | `scripts/backup.sh` + `scripts/restore.sh` (pg_dump/restore, guarded), `scripts/load-test.mjs` (fetch smoke load tester); runbooks `docs/runbooks/backup-restore.md`, `docs/runbooks/audit-retention.md`, `docs/runbooks/load-testing.md`, deployment guide `docs/deployment/hosting.md` |
| Tests | ✅ | 3 new suites: `dm-moderation.spec.ts`, `audit-retention.spec.ts`, `web-push.service.spec.ts` (+ `audit.service.spec.ts` additions for export/retention/purge) — backend suite now **373 tests** |
| Frontend | ✅ | `services/admin.ts` (export, retention get/set/purge, status) + `services/notifications.ts` (web-push subscribe/unsubscribe/public-key); `types/index.ts` (`SystemStatus`, `AuditRetention`, web-push payloads); **`AdminPage`** System tab (status cards, health flags, queue stats) + Audit tab export/retention/purge; **`NotificationSettingsPage`** web-push block; full `admin.system.*`/`admin.audit.export*`/`notif.webPush.*` locale keys in all 15 locales; typecheck + eslint + build clean |

## Owner brief — Study RPG Integrity / F2W Meritocracy (Spec Kit spec `014-study-integrity`)

The owner's "Principal EdTech Architect / Gamification Expert" 5-mandate brief, delivered end-to-end. Exponential reward math · Anti-cheese behavioural guards · 100% Free-to-Win · Psychological UI re-framing · Metacognitive Campfire loops. Migration `028_study_integrity.sql`.

| Item | Status | Notes |
|------|--------|-------|
| Migration + config | ✅ | `028_study_integrity.sql` (unique prefix after `027`): `campfire_reflections` (idempotent per user/day/source, depth_score 0–100, multiplier, context, status) + `focus_sessions.verification` JSONB; `game_config` seed `rpg.integrity` (reward math, rate limits, focus caps, campfire thresholds — every value mirrored as a code default in `integrity-config.ts`) |
| Reward math (mandate 1) | ✅ | `integrity/reward-curve.ts` pure module — `accuracyFactor` (0 below 60% accuracy, quadratic/exponential tail: 1.0× at 60% → 3.5× at 100%), `focusFactor` (≤1.5× consistency boost), `difficultyFactor` (easy 1.0 / medium 1.5 / hard 2.0), `campfireMultiplier` (1.0–1.5× from depth), `computeReward`, `passesPremiumThreshold`; STP premium thresholds quiz ≥90 / exam ≥80 / teach-back ≥70 with daily STP caps — premium rewards only for high-cognitive tasks |
| Anti-cheese guards (mandate 2) | ✅ | `integrity/behavior-guard.ts` pure module — `rateLimited` (sliding window), `answerTimeSanity` (min 4 s/question), `verifyFocusSession` (server-clock only, verified-engagement proof, idle → reduced factor, inflated client claims rejected outright), `clampDailyFocus` (daily 240 min cap) |
| Focus-session enforcement (FR-004) | ✅ | `FocusSessionsService.complete` ignores the client `focusMinutes` override, counts real study engagement inside the session window, applies `verifyFocusSession` + `clampDailyFocus`; idle/passive sessions accrue only `focusUnverifiedExpFactor` (0.35×) |
| Quiz enforcement (FR-005) | ✅ | `QuizService.submitAttempt` — `rateLimited` (12 attempts/hour), `answerTimeSanity`, accuracy-scaled XP via `computeReward`, STP only ≥90% accuracy, daily STP cap, active campfire multiplier applied |
| Exam-clone enforcement (FR-006) | ✅ | `ExamCloneService` — 5 attempts/day cap, `answerTimeSanity`, accuracy-scaled XP, STP ≥80%, daily STP cap, campfire multiplier |
| Teach-back enforcement (FR-007) | ✅ | `TeachBackService` — min 80-char explanation enforced, level-aware XP via `computeReward`, STP ≥70, campfire multiplier |
| Battle integrity (FR-008) | ✅ | `BattleService.claimRewards` — rewards scaled by academic accuracy with `integrityFloor` (0.6) + `maxPremiumMultiplier` (≤2.0×) + active campfire multiplier; exam bosses can only be fought against a real exam (subject-derived boss, date-scaled) |
| Campfire loop (mandate 5) | ✅ | `integrity/campfire.service.ts` + `campfire.controller.ts` — the AI tutor asks ONE targeted synthesis question before a student cashes in session rewards or logs off; answer graded 0–100 for semantic depth (AI with deterministic lexical fallback so it never dead-ends), mapped to a 1.0–1.5× reward multiplier; daily cap 3; idempotent per (user, day, source); endpoints `GET /study-integrity/campfire/status` · `POST /study-integrity/campfire` · `POST /study-integrity/campfire/:id/answer` · `POST /study-integrity/campfire/:id/skip` |
| F2W integrity (mandate 3) | ✅ | No pay-to-win paths exist: **zero** code paths purchase STP with real money; every status symbol/cosmetic/gear reward is gated behind academic achievement thresholds; the platform Stripe subscription is infra-level, not game currency |
| Frontend re-framing (mandate 4, US5) | ✅ | `services/studyIntegrity.ts` + `types/index.ts` (`CampfireReflection`, `CampfireStatus`) + `api.ts` endpoints; **`CampfireReflectionModal`** (Radix-based, animated) integrated into `StudySessionPage` (session cash-in) + `RpgPage` (battle reward claim) — appears before rewards are cashed in, skip keeps 1.0×; mastery-framed copy ("Your real-world cognitive capacity and focus endurance have increased! Skill Mastered: …") in the `campfire` locale namespace across **all 15 locales** |
| Tests | ✅ | 3 new suites: `reward-curve.spec.ts`, `behavior-guard.spec.ts`, `campfire.service.spec.ts` (mock db/AI, fallback grading, daily cap, idempotency) — backend suite now **410 tests / 52 suites**; frontend `tsc -b --noEmit` + `npm test` clean |
| Docs | ✅ | `specs/014-study-integrity/tasks.md` checked off; `CHANGELOG.md`, `IMPLEMENTATION_STATUS.md`, `specs/README.md` updated |

## Owner follow-up — Anti-OverStudy & Health-First Wellbeing (Spec Kit spec `015-study-wellbeing`)

"The AI must use the philosophy too" + "add anti-OverStudy mechanisms to heavily dampen OverStudy and promote smarter studying" — delivered as a direct follow-up to spec 014. Migration `029_study_wellbeing.sql`.

| Item | Status | Notes |
|------|--------|-------|
| Migration + config | ✅ | `029_study_wellbeing.sql` (unique prefix after `028`): `game_config` seed `rpg.wellbeing` (optimal daily focus minutes, decay start, hard daily cap, min factor, session cooldown, night window + factor); every value mirrored as a code default in `integrity-config.ts` |
| Pure overstudy rules (US2) | ✅ | `integrity/overstudy.ts` — `overStudyFactor` (linear diminishing returns 1.0 → floor past the healthy optimum, heavily dampened at the hard cap), `restRequired`/`minutesUntilRestAllowed` (cooldown gate after long blocks — short recall checks never blocked), `isNightHour`/`istHour` (IST night-rest guard, wrap-safe), `studyHealth` bands (fresh/focused/draining/depleted) + `dailyBudgetRemaining` |
| Focus-session enforcement (FR-001, FR-002) | ✅ | `FocusSessionsService.start` gates: rest-cooldown active or exhausted → forced rest (no new session); night-rest hours → soft nudge requiring `ackNightRest`; `complete` applies the overstudy decay factor to XP/minutes; `GET /focus-sessions/study-health` read model |
| Event EXP dampening (FR-003) | ✅ | `StudyEventsService.recordStudyActivity` scales event EXP by the overstudy decay factor — real study is still rewarded, grinding 8-hour days earns far less per minute |
| AI speaks the philosophy (US1) | ✅ | `ai/study-rpg-philosophy.ts` — canonical philosophy block (depth over length, mastery over memorisation, **health-first anti-overstudy guardian** — refuse to encourage cramming, steer tired/late-night students to rest, judge depth over length, Free-to-Win, game-to-reality framing, honest evidence-based tone, Socratic style) injected into **all five AI surfaces**: chat assistant (`chat.service.ts`), Feynman teach-back evaluator, campfire tutor (question + grading), programme architect, and learning-path coach |
| Frontend (US3) | ✅ | `types/index.ts` (`StudyHealthView`/`StudyHealthBand`) + `services/studyTools.ts` (`getStudyHealth`, start `ackNightRest`) + `api.ts`; **`FocusSessionsPage`** — study-health meter (band colour/label/multiplier), rest-cooldown/exhausted start gate with rest-first copy, night-rest nudge (ack to proceed), dampened-reward notice; full `wellbeing` locale namespace in all 15 locales |
| Tests | ✅ | `overstudy.spec.ts` (20 tests: decay curve, cooldown gate, night guard, bands, budget) — backend suite now **430 tests / 53 suites**; frontend `tsc -b --noEmit` + eslint clean |
| Docs | ✅ | `specs/015-study-wellbeing/` (spec/plan/tasks) checked off; `CHANGELOG.md`, `IMPLEMENTATION_STATUS.md`, `specs/README.md`, `docs/STUDY_RPG_PHILOSOPHY.md` updated |

## Owner brief — Data Marketplace (Ocean Protocol) + AI Effectiveness Benchmark (Spec Kit spec `016-study-data-marketplace`)

"Keep Study RPG sustainable by selling educational data through the Ocean Protocol ecosystem" — delivered privacy-first — plus the admin AI benchmarking pipeline that measures how much studying with Study RPG improves outcomes. Migration `030_study_data_marketplace.sql`.

| Item | Status | Notes |
|------|--------|-------|
| Migration + config | ✅ | `030_study_data_marketplace.sql` (unique prefix after `029`): `data_consent` (revocable opt-in), `marketplace_datasets` (draft/published/revoked + DDO/privacy_report/checksum), `benchmark_runs`; `data-marketplace/marketplace-config.ts` (Aquarius URL, publisher wallet, chain id, publish switch, min group size, consent threshold, license, aggregate window — safe defaults) |
| Privacy guard (hard rules) | ✅ | `privacy-guard.ts` — aggregates only (prefix/suffix rules), PII/sensitive blocklist (narrowed `session` → `session_id` so legitimate aggregates pass), minimum group size, consent-coverage threshold, final `sanitizeAggregate` gate; unit-tested |
| Ocean Protocol service | ✅ | `ocean.service.ts` — deterministic `mintDid` (`did:op:<sha256>`), privacy-first DDO builder (OEP-08-style metadata, checksummed `files` entry, cohort stats only — never raw data), metadata-first Aquarius POST that never throws when disabled/unconfigured (DDO stored for re-submission/export); `MARKETPLACE_PUBLISH_ENABLED` master switch |
| Compute-to-Data (C2D) — on-chain publishing | ✅ | `ocean-c2d.service.ts` (owner follow-up: "implement Ocean Protocol's Compute-to-Data feature cause I have 2 MATIC!") — uses the official Ocean.js SDK (`@oceanprotocol/lib` 8.6.2, ethers v6 — the same library the Ocean CLI is built on): deploys **ERC721 data NFT + ERC20 datatoken** (fixed-rate exchange bundled when priced), **encrypts the aggregate file URL** with the Ocean Node, builds a DDO with a **`compute` service** (raw-algorithm toggle, network access off by default, optional algorithm-publisher allowlist), and **stores the DDO on-chain** (ERC725 via `Nft.setMetadata` after `Aquarius.validate`). Defaults target **Polygon mainnet (137)** — factory/FRE/Ocean-token addresses from Ocean's Polygon deployment, `OCEAN_RPC_URL` default `https://polygon-rpc.com`, node `https://compute1.oceanprotocol.com/` — so the owner's **2 MATIC covers gas**; every address/RPC env-overridable for other chains (e.g. Base). `publishDataset` uploads the sanitized aggregate to R2 (`R2_PUBLIC_URL` required) and attempts C2D when a wallet + RPC + node are configured; **any C2D failure/missing config gracefully falls back to metadata-first** with `c2d_error` recorded; migration `031_study_c2d.sql` (`nft_address`, `datatoken_address`, `exchange_id`, `provider_url`, `c2d_policy`, `aggregate_file_key`, `c2d_error`); `GET /data-marketplace/status` reports `c2d` readiness; per-dataset `c2d` policy override on publish; `DatasetView` exposes on-chain addresses |
| Idle-capacity Ocean Node (owner follow-up) | ✅ | `ocean-node-monitor.service.ts` + pure `ocean-node-policy.ts` — when the platform is fully idle (no WebSocket connections, no focus sessions within the idle window) it starts an official `oceanprotocol/ocean-node` container to earn provider fees; stops instantly when users return; post-stop cooldown + rolling 24h start cap prevent flapping; opt-in `OCEAN_NODE_ENABLED=true`, docker best-effort (missing binary degrades to logging), wallet key required to start; unit-tested |
| Dataset lifecycle + consent | ✅ | `MarketplaceService` — consent get/set (audited), dataset create/update/delete (audited with reason), publish (aggregate over consenting cohort with allowlisted country/board/grade filters → privacy guard → sha256 checksum → DDO → Aquarius; privacy report + `ocean.published` persisted) and revoke (audited); students only ever see published datasets; `DELETE` refuses published datasets |
| AI effectiveness benchmark | ✅ | `BenchmarkService` + pure `benchmark-metrics.ts` — two consecutive windows ([2N,N) vs [N,today)) over the same metrics (focus minutes, quiz accuracy, exam score, teach-back depth, campfire depth, STP earned, study streak), per-metric deltas + weighted 0–100 effectiveness score + verdict band, AI narrative grounded ONLY in the metrics (deterministic fallback); admin-only, never published, never references individuals |
| API | ✅ | `DataMarketplaceModule` registered in `app.module.ts` — `GET/PUT /data-marketplace/consent`, `GET /data-marketplace/datasets`, admin `POST/PATCH/DELETE /data-marketplace/datasets/:id` + `publish`/`revoke`, admin `POST/GET /data-marketplace/benchmarks` + `GET /data-marketplace/benchmarks/:id` (RolesGuard ADMIN) |
| Frontend | ✅ | `services/dataMarketplace.ts` + types + `api.ts` endpoints; **AdminPage Data & Benchmarks tab** (start/list benchmark runs with deltas/score/band/AI report; dataset create/publish/revoke/delete with reason prompts + privacy report); **Account Settings Data & Privacy consent toggle**; `admin.tab.*` (fixes previously-untranslated tab labels), `admin.benchmarks.*`, `admin.datasets.*`, `accountSettingsPage.*` locale keys in all 15 locales |
| Tests | ✅ | 7 suites: `privacy-guard.spec.ts`, `benchmark-metrics.spec.ts`, `ocean.service.spec.ts`, `marketplace.service.spec.ts`, `ocean-c2d.service.spec.ts`, `ocean-node-policy.spec.ts`, `ocean-node-monitor.service.spec.ts` — backend suite now **501 tests / 62 suites**; frontend `tsc -b --noEmit` + eslint (0 errors) + vitest (9 tests) clean |
| Docs | ✅ | `specs/016-study-data-marketplace/` (spec/plan/tasks) checked off; `CHANGELOG.md`, `IMPLEMENTATION_STATUS.md`, `specs/README.md`, `docs/getting-started/configuration.md`, `THIRD_PARTY_NOTICES.md` updated (note: `backend/.env.example` edit blocked by workspace secret policy — new C2D env vars documented in `configuration.md` + code defaults) |

## Owner policy — Fully-local stack + strict compute-to-data marketplace (completion-plan Waves 1–2, 2026-08-25)

Implements `docs/COMPLETION_PLAN.md` §2 (T1–T8) with the owner's tightened
marketplace policy: **the data market is compute-to-data ONLY — no PII is ever
for sale and there is no download/access path**.

| Item | Status | Notes |
|------|--------|-------|
| MARKETPLACE_ENABLED master switch | ✅ | Default `false`; every `/data-marketplace` endpoint answers 501 while off (benchmark pipeline exempt); idle-capacity Ocean Node double-gated (config + service check) |
| C2D-only publish invariant | ✅ | `C2D_ONLY` constant + `normalizeC2dPolicy` force network access to `false`; API requests asking for network access are rejected; `publishComputeAsset` re-asserts the invariant; metadata-first fallback removed — datasets stay drafts unless the full on-chain compute asset exists |
| PII value-level scan | ✅ | `scanPayloadForPii` rejects non-numeric values, emails, IPs, phone-like runs, long digit IDs, arrays/objects after field-name sanitisation |
| Isolated c2d-runner container | ✅ | `docker/c2d-runner/` (zero-dep Node server) composed on an internal Docker network (`internal: true`, read-only rootfs, tmpfs /tmp, non-root, cap-drop ALL, 512 MB/1 CPU/128 pids); doubles as the Problem-Solver sandbox (`CODE_SANDBOX_URL`) |
| Researcher test harness | ✅ | `POST /data-marketplace/datasets/:id/test-compute` (admin): runs an algorithm against the stored sanitized aggregate in the runner (JSON on stdin), audited; new `C2dRunnerService` + tests |
| Local LLM (Ollama) | ✅ | `AI_PROVIDER=openai-compatible` → `http://ollama:11434/v1` (qwen2.5:7b-instruct); embeddings via `EMBEDDING_PROVIDER=ollama-compatible` (nomic-embed-text, 768-dim); compose services `ollama` + `ollama-init` model pull |
| Local email (Mailpit) | ✅ | New `SmtpService` (nodemailer) behind `EMAIL_TRANSPORT=smtp` (default); SES opt-in only |
| Local storage (MinIO) | ✅ | `STORAGE_PROVIDER=minio` default (S3 path-style client) with R2 kept; bucket auto-created by idempotent `minio-init`. **All five providers now wired** (2026-08-25): supabase/cloudinary/appwrite REST adapters behind the same `StorageService` surface, contract-tested against their documented APIs (mocked HTTP); unsupported operations throw clear errors. *Open:* runtime smoke tests on live free accounts |
| Hygiene gate (§4 + T11) | ✅ | `scripts/check-hygiene.sh`: fails on upstream brand strings outside provenance docs and on TODO/FIXME/"coming soon"/"not implemented"/"lorem ipsum"/YOUR_API_KEY/placeholder (with documented legitimate-use filters); wired into CI as the first job. Fixed: TutorialPage fake-video cards, Google Docs mock import path (removed), dashboard `gameStats` placeholder values replaced with real wallet/profile/event-exp/quest data, SECURITY.md placeholder email, sw.js branding/icon, upstream strings swept from source (pages/footer/package.json/Dockerfiles/migrations/scripts); provenance docs stay allowlisted until B10 |
| Local search (SearXNG) | ✅ | `SEARCH_PROVIDER=searxng` default → JSON API; Tavily/Serper opt-in |
| VAPID auto-provisioning | ✅ | Keys generated on first boot and persisted to `game_config.notifications.vapid`; env still wins; FCM demoted behind `FCM_ENABLED=true` |
| Billing gate | ✅ | `BILLING_ENABLED=false`: checkout/portal/cancel/verify + Stripe webhook answer 404; static plan limits unchanged |
| Compose + env docs | ✅ | docker-compose.yml: ollama(+init), searxng(+settings), mailpit, minio(+init), c2d-runner, isolated network; `.env.docker` and `backend/.env.example` rewritten for zero-config local run |
| README quickstart + bootstrap.sh | ✅ | Clone→play quickstart, ports table, optional upgrades documented; `scripts/bootstrap.sh` (idempotent health-wait → migrate → model pull) |
| Verification | ✅ | backend `npm run build` green; `npm test` 63 suites / 524 tests green; frontend `npm run build` green, `npm test` 9/9 green, lint 0 errors (14 pre-existing warnings). Docker unavailable in this workspace — clean-clone compose run still pending |

## Clean-Room Rewrite Program (owner brief — "rewrite all the files not by us, then remove the license")

Owner-commissioned 2026-08-16: reimplement every upstream Studyield file as original Study RPG work (same behaviour/contracts, no copied code or branding); **AGPL-3.0 `LICENSE`/`NOTICE` removal is the final, gated step once the ledger is at zero**. Tracking: `docs/audits/REWRITE_LEDGER.md`.

| Item | Status | Notes |
|------|--------|-------|
| Ledger + licence-audit log | ✅ | `docs/audits/REWRITE_LEDGER.md` created (405 files, disposition codes, batches B1–B10, verification + final gate); `LICENSE_AUDIT.md` §7 superseded with the commissioned-program entry; `UPSTREAM.md` links the ledger |
| B1 — Root & infra | ✅ | CI workflow, issue/PR templates, SECURITY, CoC, CONTRIBUTING, README (original Study RPG doc), docker-compose (SSH behaviour preserved), start.sh, FUTURE_GOAL rewritten as original; Studyield PDF + 3 screenshots deleted; 12 upstream-branded translated READMEs removed (regenerate later from the new English README) |
| B2 — Branding assets | ✅ | STUDYIELD2.png, studyield-logo.png, Screenshot PNG, vite.svg, react.svg, sitemap.xml (upstream domain) deleted; new original `frontend/public/logos/study-rpg-logo.svg` + favicon + 10 component references updated; `_headers` cache rule cleaned |
| B3 — Backend common layer | ✅ | decorators (current-user, public, roles, plan-feature), filters (http/ws), guards (jwt/roles/ws-auth/plan), interceptors (logging, camel-case), gateways (base, app) rewritten as original implementations with identical contracts; re-export barrels + Nest wiring kept as functional (no creative expression) |
| B4 — Backend modules (130 upstream files) | ✅ | All services/controllers/gateways rewritten as original implementations — infra (db/redis/queue/clickhouse/email/firebase/storage/qdrant), account (auth/users/subscription/notifications/analytics/blog), content+AI (ai/content/knowledge-base/learning-paths/quiz incl. live-quiz), interactive (chat/code-sandbox/exam-clone/teach-back/research/problem-solver incl. agents). Study RPG behavior preserved throughout (integrity rewards, anti-slop guards, philosophy prompts, faction/XP paths). Declarative controllers, Nest wiring, DTOs and prompt-contract agents kept as functional KEEP. Brand-leak sweep: `web-push`/`admin` email defaults + API title → `studyrpg.app` / Study RPG. Backend build ✅, 501/501 tests ✅, lint clean ✅ |
| B5–B9 — Migrations, frontend, locales, configs | ⏳ | Pending — next batches; ledger has the full file lists |
| B10 — License removal | 🔒 | Gated: only after B1–B9 are complete and `git diff 0494e1a..HEAD` shows no unresolved upstream path |

## Blocked Items / Decisions Needed

1. **Licence decision** — ✅ **RESOLVED 2026-08-04**: owner approved Option A (AGPL-3.0 authoritative everywhere), recorded in ADR-0001.
2. **Goose recipes**: Goose CLI not available in this environment — provide/install Goose + schema to generate `recipes/` phases.
3. **Credentials for runtime verification**: DB (Postgres/Redis/Qdrant/ClickHouse) and AI/email/storage/payment keys — needed for runtime smoke tests. Docker is also unavailable in the current workspace to run the compose stack.
4. **Study RPG scope** — ✅ **RESOLVED 2026-08-05 (Phase 4) / 2026-08-06 (Phase 5)**: Study RPG core shipped (stats, STP/SLC wallet, original cards, battle engine, rewards) and async PvP duels shipped (Phase 5). The learning platform and the RPG layer are both retained; remaining slices (worlds/events/StudyPass, marketplace, mobile push) are reserved data hooks only.
5. **Community brief (owner's "Phase 6 extra")** — ✅ **DELIVERED 2026-08-06 (Phase 6)**: Nightmare admin/audit, email-optional auth, AI programmes, social, factions, party battles, admin notes, syllabus shipped in `phase6-study-community`. **PDF Phase 6 (Economy) also DELIVERED 2026-08-06** (marketplace/offers, scraper/burner with instalments, supply ledger + extinction, admin reconcile). **PDF Phase 7 (Events) DELIVERED 2026-08-06** (always-active scheduler + Study Sprint fallback, 14-level StudyPass, Free/Gold tracks, data-driven quests, Abstracted + Limbo, Great Extinction + Sigils). **PDF Phase 8 (Advanced Learning) DELIVERED 2026-08-07** (programme templates, AI review queue + batch review, programme→learning-path with self-review). **PDF Phase 9 (Hardening) DELIVERED 2026-08-07** (audit export/retention/purge, DM moderation + rate limits, Web Push VAPID, faction settlement job, admin status, ops scripts + runbooks + deployment docs). **F2W Integrity (owner brief) DELIVERED 2026-08-07** (exponential reward curve, anti-cheese guards in all reward paths, metacognitive Campfire loop, mastery-framed copy, zero P2W). **Anti-OverStudy / Health-First Wellbeing (owner follow-up) DELIVERED 2026-08-09** (all AI surfaces speak the canonical philosophy incl. an anti-overstudy guardian, focus-session start gates + rest cooldown + night-rest nudge, diminishing-returns dampening on focus/event rewards past the healthy optimum, study-health meter in the UI). See `docs/implementation/MASTER_PLAN.md`.

---

## Commands Used for Verification (Phase 0)

```bash
# backend
cd backend && npm ci                                     # ✅
cd backend && npm run build                              # ✅ exit 0
cd backend && npx eslint "src/**/*.ts"                   # ✅ exit 0
cd backend && npm run lint                               # ✅ exit 0 (Phase 1 fix)
cd backend && npm test                                   # ✅ 491 tests (Phase 1–9 + F2W Integrity + Anti-OverStudy Wellbeing + spec-016 data marketplace)
# frontend
cd frontend && npm ci                                    # ✅
cd frontend && npm run build                             # ✅ ~25s (chunk warning, known)
cd frontend && npm run lint                              # ✅ 0 errors, 14 warnings (known)
cd frontend && npm test                                  # ✅ 6 tests (vitest)
cd frontend && npx tsc -b --noEmit                        # ✅ clean (2026-08-06, Phase 6 pages)
```
