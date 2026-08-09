# Spec Kit Workspace — Studyield / Study RPG

This directory holds the project's **Spec-Driven Development** artifacts (GitHub Spec Kit).

Every feature lives in its own numbered directory `specs/<NNN>-<name>/` containing a
`spec.md` (the what & why, with user stories and acceptance scenarios) plus the planning
artifacts (`plan.md`, `research.md`, `data-model.md`, `contracts/`, `tasks.md`) generated
through the `/speckit.*` commands.

## Active specs (in PDF phase order)

| Dir | Feature | PDF phase | Status |
|---|---|---|---|
| `001-studyield-core` | Study tools: focus sessions, mistake notebook, subject puzzles, exam centre | 2 | ✅ Implemented |
| `002-student-dashboard` | Dashboard summary + hide-game-stats preference | 2 | ✅ Implemented |
| `003-rag-vector-index` | Versioned Qdrant collections + background reindex | 3 | ✅ Implemented |
| `004-rag-retrieval-evaluation` | RAG retrieval evaluation metrics + leakage checks | 3 | ✅ Implemented |
| `005-rag-deletion` | Per-document deletion lifecycle in the RAG pipeline | 3 | ✅ Implemented |
| `006-rag-reranking` | Optional reranker stage for hybrid retrieval | 3 | ✅ Implemented |
| `007-study-rpg-core` | Player stats, STP wallet ledger, original cards, battle engine | 4 | ✅ Implemented |
| `008-pvp-duels` | Async player-vs-player duels + Elo + leaderboard | 5 | ✅ Implemented |
| `009-phase6-study-community` | Nightmare admin/audit, email-optional auth, AI programmes, social, factions, party battles, admin notes | 2/3/5/7/8 | ✅ Implemented |
| `010-study-economy` | Official card value, supply ledger, marketplace, scraper/burner, extinction | 6 | ✅ Implemented |
| `011-study-events` | Always-active scheduler + Study Sprint fallback, StudyPass (14 levels), Free/Gold tracks, quests, Abstracted + Limbo, Great Extinction + Sigils | 7 | ✅ Implemented |
| `012-study-advanced-learning` | Programme templates + instantiate, AI review queue + batch review, AI programmes → personal learning paths (self-reviewed) | 8 | ✅ Implemented |
| `013-study-hardening` | Audit-log export/retention/purge, DM moderation + rate limits, Web Push (VAPID), faction settlement job, admin status, ops scripts + runbooks + deployment docs | 9 | ✅ Implemented |
| `014-study-integrity` | F2W meritocracy: exponential reward curve, anti-cheese behavioural guards, metacognitive Campfire loop (AI synthesis question → 1.0–1.5× multiplier), mastery-framed copy | Owner brief | ✅ Implemented |
| `015-study-wellbeing` | Anti-overstudy & health-first wellbeing: all AI surfaces speak the canonical philosophy (health-first guardian), focus-session start gates (rest cooldown, exhaustion, night-rest nudge), diminishing-returns dampening past the healthy daily optimum, study-health meter | Owner follow-up | ✅ Implemented |

## Workflow

1. **Constitution** — governing principles live in `.specify/memory/constitution.md`
   (created via `/speckit-constitution`).
2. **Spec** — describe what to build with `/speckit-specify` → creates `specs/<NNN>-<name>/spec.md`.
3. **Plan** — `/speckit-plan` → `plan.md`, `research.md`, `data-model.md`, `contracts/`.
4. **Tasks** — `/speckit-tasks` → actionable, sequenced `tasks.md`.
5. **Implement / Converge** — `/speckit-implement`, then `/speckit-converge` to detect drift.

Quality helpers: `/speckit-clarify` (de-risk ambiguity), `/speckit-analyze` (cross-artifact
consistency), `/speckit-checklist` (requirement-quality checklists).

> Migrated from OpenSpec on 2026-08-06. The legacy workspace is archived at `archive/openspec/`.
