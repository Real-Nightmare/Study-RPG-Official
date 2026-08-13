# Architecture Overview

Study RPG is a **gamified AI learning platform**: the academic core (Studyield) is wrapped
in an RPG layer whose progression is earned *only* through real study. See
[`STUDY_RPG_PHILOSOPHY.md`](../../STUDY_RPG_PHILOSOPHY.md) for the vision; this page is the
technical map.

## High-level topology

```
Browser (React SPA)
   │  HTTP /api  +  Socket.IO (live quiz, chat, exam clone, social)
   ▼
NestJS API (backend/src/modules/*)
   ├── PostgreSQL 15   — source of truth (raw SQL via pg, migrations in backend/migrations/)
   ├── Redis 7         — cache + BullMQ queues (job queue, web push)
   ├── Qdrant          — vector store for RAG retrieval
   └── ClickHouse      — usage analytics
   └── External AI     — OpenRouter/LLM (planner, RAG, teach-back, campfire, exam clone)
```

## Backend

NestJS 10, TypeScript, **raw SQL** (no ORM). Modules live in `backend/src/modules/<feature>/`
as `module/controller/service/entities` (+ `dto/` where relevant). A shared interceptor keeps
API responses in camelCase; a global validation pipe enforces DTOs with `forbidNonWhitelisted`.

### Feature modules (highlights)

| Area | Modules |
|------|---------|
| Academic core | `academics`, `content` (study sets / flashcards / notes / documents), `mistakes`, `focus-sessions`, `exam-periods` |
| AI pipeline | `ai` (multi-agent LLM orchestration), `planner` (task planner — the core-tool pattern), `knowledge-base` (chunking), `rag` (retrieval, evaluation, reranking, deletion), `exam-clone`, `teach-back`, `research`, `problem-solver`, `code-sandbox`, `content` extraction |
| RPG layer | `rpg` (stats, STP ledger, cards, battle engine), `economy` (marketplace, scraper/burner, supply ledger), `events` (StudyPass, quests, Abstracted, Great Extinction), `factions`, `puzzles` |
| Integrity & wellbeing | `integrity` (Campfire metacognitive loop, Free-to-Win guards), `study-integrity` reward curve in the economy paths, wellbeing start-gates & diminishing returns |
| Community | `social`, `chat`, `blog`, `programmes`, `learning-paths`, `admin`, `admin-notes`, `notifications` |
| Platform | `auth`, `users`, `subscription` (Stripe — infra only), `storage`, `email`, `analytics`, `dashboard` |
| Infra wrappers | `database`, `redis`, `queue`, `clickhouse`, `qdrant`, `firebase` |

### Realtime

Socket.IO gateways in `backend/src/common/gateways/` plus module gateways (chat, live quiz,
exam clone, social, problem solver) — all share CORS policy through the
`cors-origins` config helper.

### Migrations

Custom runner (`scripts/migrate.js`, `npm run migrate`). New files: `NNN_name.sql` with
**globally unique numeric prefixes** — number sequentially from the current max.

## Frontend

React 19 + Vite 7 + Tailwind CSS + Radix UI (shadcn-style). State via Zustand stores
(`src/stores`), server state via TanStack Query, API clients in `src/services`, i18n with
15 locales (`src/locales/<locale>.json` — add keys to **all** locales). Pages under
`src/pages/` (public + `dashboard/`), shared UI in `src/components/ui`. Vitest + jsdom for
tests; ESLint includes `eslint-plugin-jsx-a11y` and the compiler-aware `react-hooks` rules.

## Free-to-Win integrity points

- Reward curves live in the backend economy/integrity paths — exponential on accuracy,
  focus consistency and material difficulty; never purchasable.
- Anti-cheese guards on all five reward paths; the Campfire loop gates session cash-out.
- Subscriptions gate **infrastructure only** (limits, priority) — never XP, loot, or cosmetics.

## Docs map

- [`../getting-started/quick-start.md`](../getting-started/quick-start.md) — run it locally
- [`../getting-started/configuration.md`](../getting-started/configuration.md) — env vars
- [`../deployment/hosting.md`](../deployment/hosting.md) — production hosting
- [`../runbooks/`](../runbooks/) — backup/restore, audit retention, load testing
- [`../implementation/MASTER_PLAN.md`](../implementation/MASTER_PLAN.md) — build history
