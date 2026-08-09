# Initial Repository Audit

> **Phase 0 deliverable** — Studyield / Study RPG implementation
> **Date**: 2026-08-04
> **Scope**: Full read-only audit of the repository before any modification.
> **Method**: Repository map, install/build/test/lint runs, licence contradiction review, feature/dependency/database/deployment inventories, and a security findings pass. No source files were modified during this audit.

---

## 1. Executive Summary

The repository is a large, mostly-complete **AI-powered learning platform ("Studyield")** composed of a NestJS backend (raw SQL, no ORM) and a React 19 + Vite frontend, with Docker-based infrastructure (PostgreSQL, Redis, Qdrant, ClickHouse).

| Area | Verdict |
|------|---------|
| Backend install | ✅ `npm ci` succeeds |
| Backend build | ✅ `nest build` succeeds (exit 0) |
| Backend lint | ⚠️ at audit time: passes on `src/**/*.ts`; `npm run lint` script was broken (non-existent `test/` glob). **Fixed in Phase 1.** |
| Backend tests | ❌ at audit time: **no test files existed**. **Fixed in Phase 1** (unit tests added; `npm test` passes). |
| Frontend install | ✅ `npm ci` succeeds |
| Frontend build | ✅ `tsc -b && vite build` succeeds (32s) — **1 × 6.0 MB un-split JS chunk** warning |
| Frontend lint | ⚠️ passes (0 errors) with **14 warnings** (react-hooks/exhaustive-deps etc.) |
| Frontend tests | ❌ **No test script configured at all** |
| Licence | 🔴 at audit time: contradiction (root AGPL-3.0 vs Apache-2.0 metadata). **Resolved in Phase 1** per Option A / ADR-0001: AGPL-3.0 everywhere. |
| Migrations | 🔴 at audit time: number collisions at `002`, `006`, `010`. **Fixed in Phase 1** with order-preserving suffixes (`002b`, `006b`, `010b`). |
| CI | ⚠️ `ci.yml` runs lint/typecheck/build; backend lint step will fail (same broken glob). |
| Secrets hygiene | ✅ No committed secrets found; `.env*` well covered by `.gitignore`. |

**Bottom line (at audit time)**: The codebase compiles and is feature-rich, but it had **zero automated tests**, a broken backend lint script, migration-number collisions, a licence contradiction, and a hard dependency on a large set of external services (AI, email, storage, payments, FCM) — most of which cannot be exercised without credentials. Items marked 🔴 above have since been addressed in Phase 1; see the Phase 1 status in `IMPLEMENTATION_STATUS.md`.

---

## 2. Repository Map

```
studyield/
├── LICENSE                      # GNU AGPL v3.0 (661 lines)
├── NOTICE                       # Claims "Apache License, Version 2.0"
├── README.md + 11 translated READMEs
├── FUTURE_GOAL.md               # Open-source prep briefing (Apache claim + history)
├── CHANGELOG.md, CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md
├── AGENTS.md                    # (this phase — see root)
├── IMPLEMENTATION_STATUS.md     # (this phase — see root)
├── docker-compose.yml           # postgres/redis/qdrant/clickhouse + app services
├── .env.docker                  # docker-compose defaults
├── start.sh                     # dev bootstrap (docker infra + npm run start:dev)
├── .github/
│   ├── workflows/ci.yml         # PR/push CI (backend + frontend checks)
│   ├── ISSUE_TEMPLATE/ , PULL_REQUEST_TEMPLATE.md
│   └── screenshots/
├── backend/                     # NestJS 10 API
│   ├── src/ (157 TS files)
│   │   ├── main.ts              # bootstrap, CORS, validation, swagger, 50mb bodies
│   │   ├── app.module.ts        # 24 modules + global guards
│   │   ├── health.controller.ts
│   │   ├── common/              # guards, interceptors, filters, gateways
│   │   ├── modules/             # 24 feature + infra modules
│   │   └── types/
│   ├── migrations/              # 18 raw-SQL migration files (see §8)
│   ├── scripts/                 # migrate.js, create-migration.js
│   ├── Dockerfile               # node:20-alpine, runs migrate then dist/main.js
│   ├── package.json / tsconfig / nest-cli.json
│   └── .env.example
└── frontend/                    # React 19 + Vite 7 + Tailwind
    ├── src/ (147 TS/TSX files)
    │   ├── pages/ (19 public + 57 dashboard pages)
    │   ├── components/ (ui, landing, exam, notes, problem-solver, sources, documents)
    │   ├── services/ stores/ hooks/ contexts/ lib/ utils/ types/
    │   └── locales/ (15 locale files: en, ar, bn, de, es, fr, hi, it, ja, ko, nl, pt-BR, ru, uk, zh)
    ├── public/ (logos, sitemap.xml)
    ├── Dockerfile               # node:20-alpine build → nginx:alpine serve
    ├── nginx.conf               # SPA fallback, gzip, security headers
    ├── vite.config.ts           # port 5189, host true, sourcemap off
    ├── package.json / tsconfigs / tailwind.config.js / eslint.config.js
    └── .env.example
```

Git state: single commit (`0494e1a Add files via upload`), branch `main`, clean working tree.

---

## 3. Build & Test Results (recorded before any change)

Commands run in this workspace (Node version as provided by environment; Docker and Goose are **not installed** in the audit environment).

### 3.1 Backend (`backend/`)

| Command | Result | Notes |
|---------|--------|-------|
| `npm ci` | ✅ PASS | install completed |
| `npm run build` (`nest build`) | ✅ PASS | exit 0 |
| `npx eslint "src/**/*.ts"` | ✅ PASS | exit 0 |
| `npx eslint "src/**/*.ts" "test/**/*.ts"` (i.e. `npm run lint`) | ❌ **FAIL** | ESLint 8.57.1: *"No files matching the pattern 'test/**/*.ts' were found"* → exit 2. No `test/` directory exists. |
| `npx jest --passWithNoTests` | ⚠️ 0 tests | "No tests found, exiting with code 0" |
| `npm test` (plain `jest`) | ❌ **FAIL** | plain jest exits 1 when zero tests exist |

**Backend findings**
- **B1 (High)** — Zero test coverage. `test/` directory is missing entirely, yet `package.json` scripts (`test`, `test:e2e`, `lint` glob, `format` glob) all reference it.
- **B2 (Medium)** — `npm run lint` is broken out-of-the-box (bad glob → ESLint hard failure). CI `backend-checks` job runs `npm run lint --if-present`, so CI backend lint **will fail on the same error**.
- **B3 (Info)** — Build passes cleanly; TypeScript strictness is partial (`strictNullChecks`, `noImplicitAny`, no `strict: true` overall).

### 3.2 Frontend (`frontend/`)

| Command | Result | Notes |
|---------|--------|-------|
| `npm ci` | ✅ PASS | install completed |
| `npm run build` (`tsc -b && vite build`) | ✅ PASS | ~32s; 557 packages |
| `npm run lint` (`eslint .`) | ⚠️ PASS | 0 errors, **14 warnings** |
| `npm run typecheck` | ⚠️ n/a | script is `tsc --noEmit --watch` (watch-mode; CI uses `tsc --noEmit --skipLibCheck`) |

**Frontend warnings (14)** — all `react-hooks/exhaustive-deps` or unused eslint-disable directives, in: `HomePage.tsx` (TOC memo), `PrivacyPage.tsx`, `TermsPage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx` (missing `handleGoogleCallback` dep), `ChatPage.tsx`, `CollaborativeExamPage.tsx`, `LiveQuizPage.tsx`, `PracticeExamPage.tsx`, `QuizPage.tsx`, `ResearchProgressPage.tsx`, `TeachBackPage.tsx`.

**Frontend findings**
- **F1 (Medium)** — Main bundle is **6.06 MB (gzip 1.63 MB)** in one chunk; Vite warns about >500 kB chunks. Needs code-splitting / manualChunks.
- **F2 (Medium)** — No `test` script, no test framework configured (no vitest/jest/playwright).
- **F3 (Low)** — `typecheck` script is a watch process; `build:check`/CI use `tsc --noEmit` instead — script naming is inconsistent.

---

## 4. Security Findings

> Review performed statically. No live services were exercised (no DB/AI credentials in this environment).

- **S1 (High) — Reflecting CORS with credentials.** `backend/src/main.ts` sets `Access-Control-Allow-Origin: req.headers.origin || '*'` together with `Access-Control-Allow-Credentials: true`. This reflects any origin and permits credentialed cross-origin requests — effectively open CORS. `FUTURE_GOAL.md` claims the *gateway* CORS was restricted to localhost, but the HTTP layer in `main.ts` still reflects arbitrary origins.
- **S2 (Medium) — Swagger enabled unconditionally.** `SwaggerModule.setup(apiPrefix/docs)` runs in all environments, with `persistAuthorization: true`. Consider disabling in production or gating by env.
- **S3 (Medium) — Large request bodies.** `body-parser.json({ limit: '50mb' })` (needed for document uploads) is applied globally; combined with 100 req/min throttler, still a DoS surface. Consider route-level limits.
- **S4 (Low/Good) — Auth scaffolding is solid.** Global `JwtAuthGuard` + `RolesGuard` registered as `APP_GUARD`; `PlanGuard` exists but is commented out (pro-gating intentionally disabled).
- **S5 (Good) — XSS mitigations present.** Frontend uses DOMPurify for `dangerouslySetInnerHTML` (5 files, per FUTURE_GOAL) and an `ErrorBoundary`.
- **S6 (Good) — Secrets hygiene.** No committed credentials found; `.gitignore` covers `.env`, `.env.*.local`, `.env.production`, Firebase configs. FUTURE_GOAL documents that real keys (AWS, Stripe, OpenRouter, Google OAuth, Firebase) were stripped before open-source release.
- **S7 (Good) — Hardening present.** ThrottlerModule global rate limiting; `whitelist + forbidNonWhitelisted` ValidationPipe; sourcemaps disabled in prod build; nginx security headers (`X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`).
- **S8 (Info) — Version pins are floating.** Many backend deps use `^` ranges (e.g. `openai ^6.17.0`, `firebase-admin ^13.6.1`); Dependabot is configured. Not audited for CVEs in this pass.

---

## 5. Licence Contradiction

**Conflicting claims (details in `docs/audits/LICENSE_AUDIT.md`):**

| Location | Claim |
|----------|-------|
| `LICENSE` (root) | **GNU AGPL v3.0** (full 661-line text) |
| `NOTICE` | "Licensed under the Apache License, Version 2.0" |
| `backend/package.json` | `"license": "Apache-2.0"` |
| `frontend/package.json` | **no license field** |
| `README.md` L16 badge | Apache-2.0 badge |
| `README.md` L528–530 License section | **AGPL-3.0** |
| README_AR/BN/DE/ES (+ others) License sections | **Apache 2.0** |
| `CHANGELOG.md` | "Replaced proprietary license with Apache License 2.0" |
| `FUTURE_GOAL.md` | "Replaced proprietary INFO INLET license with Apache License 2.0" |

**Guidance per the master implementation prompt (LICENCE AUDIT — DO NOT GUESS):**
> "Preserve the root licence. Do not replace it with Apache, MIT or another licence."

**Recommended resolution (to be decided in Phase 1):** Keep the root AGPL-3.0 licence as authoritative (per prompt), align `backend/package.json` → `AGPL-3.0`, add a licence field to `frontend/package.json`, correct the NOTICE + README badge/license sections across all 12 README variants, and add `UPSTREAM.md` / `THIRD_PARTY_NOTICES.md` + a visible "Source Code and Licence" section in the app. Do **not** make this decision unilaterally in Phase 0 — record it as an open item requiring owner sign-off.

---

## 6. Feature Inventory

### 6.1 Backend modules (`backend/src/modules/`, 24 modules)

| Module | Purpose | App module? |
|--------|---------|-------------|
| `ai` | OpenRouter LLM + embeddings gateway | ✅ |
| `analytics` | Usage analytics (ClickHouse) | ✅ |
| `auth` | JWT (access+refresh), Google/Apple OAuth | ✅ |
| `blog` | Blog posts, ratings, comments | ✅ |
| `chat` | RAG chat with citations | ✅ |
| `clickhouse` | Analytics infra | ✅ |
| `code-sandbox` | Python execution | ✅ |
| `content` | Study sets, flashcards (SRS), notes | ✅ |
| `database` | PostgreSQL (raw SQL) | ✅ |
| `email` | AWS SES transactional email | ✅ |
| `exam-clone` | Past-exam upload & question generation | ✅ |
| `firebase` | Firebase Admin (FCM push) | ✅ |
| `knowledge-base` | Document processing & RAG | ✅ |
| `learning-paths` | AI study routes | ✅ |
| `notifications` | In-app + FCM notifications | ✅ |
| `problem-solver` | Multi-agent problem solving | ✅ |
| `qdrant` | Vector DB for semantic search | ✅ |
| `queue` | BullMQ async jobs | ✅ |
| `quiz` | AI quiz generation | ✅ |
| `redis` | Cache / rate limiting store | ✅ |
| `research` | Deep research mode | ✅ |
| `storage` | AWS S3/R2 file storage | ✅ |
| `subscription` | Stripe billing | ✅ |
| `teach-back` | Feynman technique evaluation | ✅ |
| `users` | Profile, XP, badges | ✅ |

Also: `common/` (JwtAuthGuard, RolesGuard, CamelCase & Logging interceptors, HttpExceptionFilter, `GatewayModule` — 6 Socket.IO namespaces: chat, exam-clone, problem-solver, teach-back, research, code-sandbox).

### 6.2 Frontend pages

- **Public**: Home, About, Features, Blog, BlogPost, Contact, Cookies, DataDeletion, FAQ, ForgotPassword, Login, Onboarding, Privacy, Register, ResetPassword, Sitemap, Support, Terms, Tutorial (19).
- **Dashboard (57)**: AccountSettings, Analytics, Badges, Bookmarks, Chat, ChatHistory, CollaborativeExam, ConceptMap, Create/Edit StudySet & Note & Flashcard, CameraScan, DashboardHome, DeepResearch, ExamClone/Detail, FormulaCards, GenerateNote, HintMode, Leaderboard, LearningPaths(+Detail), LiveQuiz, MatchGame, NoteDetail, Notification(+Settings), PracticeExam, PracticeQuiz, ProblemHistory/Input, ProfileEdit, Quiz, ResearchHistory/Progress/Report, ReviewQueue, Settings(+Appearance), SimilarProblems, Solution, SolverBookmarks, SolvingProgress, StudyBuddyChat, StudySession, StudySetDetail, StudySets, TeachBack(+Session), etc.

**Feature-verification note (per prompt §1.1 "Do not assume a feature works")**: This audit verified that modules/pages *exist and compile*. **Runtime behaviour was not verified** — most features depend on AI/DB/external credentials absent from this environment. A live smoke test is a Phase 1 item.

### 6.3 Known "placeholder / unfinished" candidates (surface scan)

- `PlanGuard` commented out in `app.module.ts` (pro feature gating disabled).
- No test suite for any module (see §3).
- `frontend/public/sitemap.xml` references `https://studyield.com` and a `/pricing` route that has no corresponding page in `pages/`.
- Lint warnings (14) in high-traffic dashboard pages indicate lightly-maintained hook hygiene.

---

## 7. Dependency Inventory

### 7.1 Backend (selected, `backend/package.json`)

Infra: `@nestjs/*` 10.x, `ioredis`, `bullmq`, `@qdrant/js-client-rest`, `clickhouse`, `pg`, `dotenv`, `body-parser`. AI: `openai`, `@distube/ytdl-core`, `eventsource-parser`. Auth: `@nestjs/jwt`, `passport-jwt`, `bcrypt`, `google-auth-library`, `jwks-rsa`, `jsonwebtoken`, `firebase-admin`. Media/parse: `cheerio`, `mammoth`, `mathjs`, `multer`. AWS: `@aws-sdk/client-s3`, `client-ses`, `lib-storage`, `s3-request-presigner`. Other: `class-validator`, `class-transformer`, `@nestjs/swagger`, `@nestjs/throttler`, `stripe` (per NOTICE/FUTURE_GOAL).

### 7.2 Frontend (selected, `frontend/package.json`)

UI: `react` 19, `react-dom`, `react-router-dom` 7, `framer-motion`, `sonner`, `lucide-react`, `react-icons`, ~24 `@radix-ui/*` packages, `tailwindcss`, `tailwind-merge`, `class-variance-authority`, `clsx`. Data: `@tanstack/react-query`, `axios`, `zustand`, `date-fns`. Content/AI UX: `react-markdown`, `remark-gfm`, `katex` + `react-katex`, `dompurify`, `function-plot`, `reveal.js`, `jspdf` + `jspdf-autotable`, `react-dropzone`, `lottie-react`, `i18next` + `react-i18next` + `i18next-browser-languagedetector`, `recharts`, `socket.io-client`.

**Note**: no root-level `package.json` exists — the repo is two independent npm projects + Docker orchestration.

---

## 8. Database Inventory

**Engine**: PostgreSQL 15 (raw SQL via `pg`, **no ORM/query builder**). Migration runner: custom `backend/scripts/migrate.js` (`npm run migrate`), applied in Docker CMD before app start.

### 8.1 Migration files (18) — number collisions

| Prefix | File | Issue |
|--------|------|-------|
| 000 | `000_initial.sql` (20.6 kB) | baseline |
| 001 | `001_add_exam_and_type_columns.sql` | |
| **002** | `002_exam_clone_tables.sql`, **`002_live_quiz_history.sql`** | 🔴 duplicate prefix |
| 003 | `003_notes.sql` | |
| 004 | `004_exam_clone_features.sql` | |
| 005 | `005_exam_gamification.sql` | |
| **006** | `006_mind_maps.sql`, **`006_problem_chat_messages.sql`** | 🔴 duplicate prefix |
| 007 | `007_problem_solver_enhancements.sql` | |
| 008 | `008_research_enhancements.sql` | |
| 009 | `009_user_profile_fields.sql` | |
| **010** | `010_blog.sql` (23 kB), **`010_create_user_fcm_tokens_table.sql`** | 🔴 duplicate prefix |
| 011–014 | `011`…`014_*` | |

⚠️ **Migrations are unordered within duplicate prefixes** (e.g. `002_live_quiz_history.sql` after `002_exam_clone_tables.sql`). If the runner applies lexically or by metadata, `live_quiz`/`mind_maps`/`problem_chat_messages`/`fcm_tokens` may apply in the wrong order or be skipped. **Verify `scripts/migrate.js` ordering semantics in Phase 1.**

### 8.2 Tables (~49 across all migrations)

`users`, `study_sets`, `documents`, `flashcards`, `knowledge_bases`, `kb_documents`, `kb_chunks`, `conversations`, `messages`, `quizzes`, `quiz_questions`, `quiz_attempts`, `quiz_attempt_answers`, `practice_quiz_questions`, `exam_clones`, `exam_questions`, `exam_templates`, `exam_review_queue`, `exam_attempts`, `exam_bookmarks`, `exam_badges`, `user_exam_badges`, `exam_sessions`, `exam_session_participants`, `live_quiz_sessions`, `live_quiz_participants`, `live_quiz_answers`, `problem_solving_sessions`, `problem_chat_messages`, `solution_bookmarks`, `solution_alternative_methods`, `knowledge_nodes`, `knowledge_edges`, `mind_maps`, `notes`, `teach_back_sessions`, `research_sessions`, `code_executions`, `learning_paths`, `subscriptions`, `usage_records`, `notifications`, `user_fcm_tokens`, `user_xp_events`, `email_logs`, `blog_posts`, `blog_comments`, `blog_ratings` (+ review on 010 for exact blog table set).

---

## 9. Deployment Inventory

### 9.1 Infrastructure (docker-compose.yml)

| Service | Image | Port (host) | Notes |
|---------|-------|-------------|-------|
| postgres | `postgres:15-alpine` | 5432 | healthcheck; named volume |
| redis | `redis:7-alpine` | 6379 | `--appendonly yes`; healthcheck |
| qdrant | `qdrant/qdrant:latest` | 6333/6334 | healthcheck absent (service_started) |
| clickhouse | `clickhouse/clickhouse-server:latest` | 8123 | healthcheck |
| backend | built `backend/Dockerfile` | 3010 | `NODE_ENV=production`; env_file `backend/.env`; CMD runs `npm run migrate` then `node dist/main.js` |
| frontend | built `frontend/Dockerfile` | 5189→80 | nginx static; `VITE_API_URL` env |

### 9.2 Containers / images

- **Backend**: `node:20-alpine` two-stage (builder → runtime); copies `dist`, `node_modules`, `migrations`, `scripts`; EXPOSE 3010.
- **Frontend**: `node:20-alpine` builder + `nginx:alpine`; SPA `try_files → /index.html`; gzip; 1y immutable asset cache; security headers.

### 9.3 CI/CD

- `.github/workflows/ci.yml`: on PR/push to `main`/`develop`; jobs `backend-checks` and `frontend-checks` (npm ci → lint --if-present → `tsc --noEmit --skipLibCheck` → build). **Backend lint step will fail** (see B2).
- No production deploy workflow in this (public) repo — `deploy.yml` kept private per FUTURE_GOAL. Production was previously PM2 + Nginx per CHANGELOG.

### 9.4 Env-var inventory (from source/compose/docs; example files are not shown here)

- **Backend** (`backend/.env`): `PORT` (default 3010), `API_PREFIX` (default `api/v1`), `NODE_ENV`, `DATABASE_HOST/PORT/USER/PASSWORD/NAME`, `REDIS_HOST/PORT`, `QDRANT_HOST/PORT`, `CLICKHOUSE_HOST/PORT/DB/USER/PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `RATE_LIMIT_TTL`, `RATE_LIMIT_MAX`, plus service keys per FUTURE_GOAL/NOTICE: AWS (S3/SES) access key/secret/bucket/region, OpenAI/OpenRouter key, Google OAuth (client id/secret), Apple credentials, Firebase service-account + FCM, Stripe (secret + webhook), Cloudflare R2 endpoint. (Exact names must be confirmed against `backend/.env.example` in Phase 1.)
- **Frontend** (`frontend/.env`): `VITE_API_URL` (default `http://localhost:3010`), plus OAuth callback config and `VITE_` keys for Google/Apple.
- **Docker**: `POSTGRES_*`, `REDIS_PORT`, `QDRANT_PORT`, `QDRANT_GRPC_PORT`, `CLICKHOUSE_*`, `BACKEND_PORT`, `FRONTEND_PORT` (via `.env.docker`).

### 9.5 Environment gaps noted during audit

- **Docker not installed** in the audit workspace → `docker compose` stack and Dockerfile builds were **not executed** (documented, not verified).
- **Goose not installed** → phased Goose recipes cannot be generated against an installed schema in this environment; the prompt's "create phased Goose recipes" item is deferred to Phase 1 with the schema/CLI requirement noted.
- Database services (Postgres/Redis/Qdrant/ClickHouse) were not running → migrations were **not applied**; DB state is inferred from SQL files only.

---

## 10. Open Items → Phase 1 (Architecture Stabilisation) Input

**Phase 1 status as of 2026-08-04** (details in `IMPLEMENTATION_STATUS.md`):

1. ✅ Fix backend `npm run lint` glob — done; `npm test` now passes with unit tests.
2. ✅ Introduce backend unit test scaffolding — done (Jest spec for `CamelCaseTransformer`; jest config already existed).
3. ✅ Resolve migration prefix collisions (002, 006, 010) → `002b`, `006b`, `010b` (order preserved; `migrate.js` sorts lexically and tracks by filename).
4. ✅ Resolve licence contradiction per **Option A / ADR-0001**: AGPL-3.0 is the single licence; package.json, NOTICE, all 12 READMEs, CHANGELOG, footer updated; `UPSTREAM.md`, `THIRD_PARTY_NOTICES.md`, ADR added.
5. ✅ Harden CORS (S1): origin allowlist via `CORS_ORIGINS` (defaults to localhost set); unknown origins rejected with 403.
6. ✅ Gate Swagger (S2) in production (disable unless `SWAGGER_ENABLED=true`); security headers added (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-XSS-Protection`).
7. ✅ Frontend code-splitting for the 6 MB main chunk (F1) via `manualChunks`; frontend tests (F2) still pending.
8. ⏳ Verify runtime feature behaviour (smoke tests) once DB + AI credentials are available.
9. ⏳ Decide whether the future "Study RPG" direction replaces/extends Studyield (per repo rename `Real-Nightmare/Study-RPG-Official`) — impacts feature inventory and branding/licence work.

---

*Audit produced with read-only inspection; no code changes were made.*
