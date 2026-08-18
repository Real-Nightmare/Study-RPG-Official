# 🎮 Study RPG — Complete Master Prompt

> **Paste this entire document into your coding tool as your master task list.**
> It is organised into **10 work streams** with exact file paths, acceptance criteria, and verification commands.

---

## 📌 Project Overview

**Study RPG** is an AI-powered learning platform (formerly Studyield) that gamifies studying into an RPG experience. It is now transitioning away from the upstream Studyield codebase via a clean-room rewrite.

**Stack:**
- **Backend**: NestJS 10, TypeScript, raw SQL via `pg` (no ORM), Redis, BullMQ, Qdrant, ClickHouse, Socket.IO, Ocean.js SDK
- **Frontend**: React 19, Vite 7, Tailwind CSS, Radix UI (shadcn-style), Zustand, TanStack Query, Socket.IO client, i18n (15 locales)
- **Infra**: Docker Compose (PostgreSQL 15, Redis 7, Qdrant, ClickHouse), Cloudflare Pages (frontend)
- **Tests**: Backend — Jest (501 tests / 62 suites); Frontend — Vitest + jsdom + Testing Library
- **License**: Currently AGPL-3.0 (will be removed after clean-room rewrite is complete)
- **Network**: Polygon mainnet (chain ID 137) for Ocean Protocol

**Backend modules** (43 total): `academics`, `admin`, `admin-notes`, `ai`, `analytics`, `auth`, `blog`, `chat`, `clickhouse`, `code-sandbox`, `content`, `dashboard`, `database`, `data-marketplace`, `economy`, `email`, `events`, `exam-clone`, `exam-periods`, `factions`, `firebase`, `focus-sessions`, `fraud-detection`, `integrity`, `knowledge-base`, `learning-paths`, `messaging`, `mistakes`, `notifications`, `ocean-node`, `planner`, `problem-solver`, `programmes`, `puzzles`, `qdrant`, `queue`, `quiz`, `rag`, `redis`, `research`, `rpg`, `social`, `storage`, `subscription`, `teach-back`, `users`, `wellbeing`

**Key docs:**
- `docs/audits/UPSTREAM_FILE_INVENTORY.md` — all 405 upstream files identified
- `docs/audits/REWRITE_LEDGER.md` — clean-room rewrite progress tracker
- `docs/audits/LICENSE_AUDIT.md` — licence resolution log
- `docs/STUDY_RPG_PHILOSOPHY.md` — product philosophy
- `docs/implementation/MASTER_PLAN.md` — phase map from original PDF
- `IMPLEMENTATION_STATUS.md` — live status of every feature
- `FUTURE_GOAL.md` — roadmap
- `specs/` — 16 Spec Kit specs (001–016)

---

## WORK STREAM 1: Clean-Room Rewrite (Batches B5–B10) 🔴 CRITICAL

**Goal:** Reimplement all 405 upstream Studyield files from scratch so the repository is 100% original code, then remove the AGPL-3.0 licence and upstream attribution.

**Status**: B1–B4 complete (root/infra, assets, backend common, backend modules). B5–B10 are PENDING.

**Disposition codes**: `REWRITE` = reimplement from scratch (same behaviour, fresh code). `DELETE` = remove. `REPLACE` = swap at new path. `KEEP` = retain (tool-generated or standard, no creative expression). `SCHEMA` = SQL kept schema-identical with re-authored comments.

### B5 — Backend Migrations (17 files) ⏳

All files in `backend/migrations/000_initial.sql` through `014_teach_back_missing_columns.sql` (upstream-origin only; do NOT touch migrations 015+ which are original Study RPG work).

**What to do:**
- Each migration SQL file must be re-authored: same table definitions, column types, constraints, and indexes, but with fresh comments, formatting, and structure.
- Do NOT change any table/column names or types — DB compatibility is critical.
- Mark each `SCHEMA` in `REWRITE_LEDGER.md` when done.
- Verify: `cd backend && npm run migrate` against a test DB still produces the same schema.

**Files:**
```
backend/migrations/000_initial.sql
backend/migrations/001_add_exam_and_type_columns.sql
backend/migrations/002_exam_clone_tables.sql
backend/migrations/002_live_quiz_history.sql
backend/migrations/003_notes.sql
backend/migrations/004_exam_clone_features.sql
backend/migrations/005_exam_gamification.sql
backend/migrations/006_mind_maps.sql
backend/migrations/006_problem_chat_messages.sql
backend/migrations/007_problem_solver_enhancements.sql
backend/migrations/008_research_enhancements.sql
backend/migrations/009_user_profile_fields.sql
backend/migrations/010_blog.sql
backend/migrations/010_create_user_fcm_tokens_table.sql
backend/migrations/011_blog_update_authors_images.sql
backend/migrations/012_blog_ratings_comments.sql
backend/migrations/013_blog_ratings_review.sql
backend/migrations/014_teach_back_missing_columns.sql
```

### B6 — Backend Config/Scripts/Root Files (15 files) ⏳

**What to do:** Rewrite these files from scratch with the same functionality:
```
backend/.dockerignore            → REWRITE (fresh ignore rules)
backend/.env.example             → KEEP (functional template, no creative expression)
backend/.eslintrc.js             → KEEP (tool config, no creative expression)
backend/.gitignore               → KEEP (standard patterns)
backend/.prettierrc              → KEEP (tool config)
backend/nest-cli.json            → KEEP (framework config)
backend/package-lock.json        → KEEP (generated)
backend/tsconfig.json            → KEEP (framework config)
backend/Dockerfile               → DONE (B4 — already rewritten)
backend/scripts/migrate.js       → REWRITE (reimplement migration runner from scratch)
backend/src/app.module.ts        → KEEP (done in B4)
backend/src/health.controller.ts → KEEP (done in B4)
backend/src/main.ts              → KEEP (done in B4)
backend/src/types/pdf-parse.d.ts → KEEP (type declaration)
```

**Acceptance criteria:** `cd backend && npm run build && npm test` still passes.

### B7 — Frontend Source (~150 files) 🔴 BIGGEST BATCH

**What to do:** Every frontend source file imported from upstream must be reimplemented from scratch — same UI, same routing, same API calls, same component structure, but with original code and Study RPG branding throughout.

**Strategy:**
1. Start with the foundation layers first: `src/config/api.ts`, `src/lib/i18n.ts`, `src/lib/utils.ts`, `src/types/index.ts`, `src/stores/*`, `src/services/*`, `src/hooks/*`, `src/contexts/*`
2. Then component layer: `src/components/ui/*` (keep as-is if they're standard shadcn), `src/components/*`
3. Then layout + pages: `src/layouts/*`, `src/pages/*`, `src/pages/dashboard/*`
4. Verify after each sub-layer: `cd frontend && npx tsc --noEmit --skipLibCheck && npm test`

**Key frontend files to rewrite (from UPSTREAM_FILE_INVENTORY.md §5.3):**
- All 76 modified files (marked ✎ in the inventory)
- All ~109 untouched files that are still upstream-derived

**Component patterns to follow:**
- shadcn-style Radix components in `src/components/ui/`
- Zustand stores in `src/stores/`
- API clients in `src/services/` (e.g., `tasks.ts`, `rpg.ts`, `economy.ts`, `events.ts`)
- i18n via `src/locales/<locale>.json` — add keys to ALL 15 locale files
- Routes in `src/pages/` with lazy loading

**Important pages to get right (Study RPG-specific):**
- `DashboardHomePage.tsx` — live widget grid with hide-game-stats toggle
- `RpgPage.tsx` — Character/Decks/Battle/Duel/Party tabs
- `EconomyPage.tsx` — Marketplace/My Cards/Supply tabs
- `EventsPage.tsx` — Live event banner, StudyPass, quests, Abstracted, Extinction
- `FactionsPage.tsx` — Faction scoreboard, members, help pledges
- `SocialPage.tsx` — Friends + real-time chat
- `ProgrammesPage.tsx` — Templates, review queue
- `AdminPage.tsx` — Users, Audit, Notes, Syllabus, System status
- `StudySessionPage.tsx` — Focus timer, campfire reflection modal
- `CampfireReflectionModal` — appears before rewards are cashed in
- `FocusSessionsPage.tsx` — Study health meter, rest gates

### B8 — Frontend Locales (15 files) ⏳

All 15 locale JSON files need to be re-authored with Study RPG branding:
```
frontend/src/locales/ar.json
frontend/src/locales/bn.json
frontend/src/locales/de.json
frontend/src/locales/en.json    ← master locale
frontend/src/locales/es.json
frontend/src/locales/fr.json
frontend/src/locales/hi.json
frontend/src/locales/it.json
frontend/src/locales/ja.json
frontend/src/locales/ko.json
frontend/src/locales/nl.json
frontend/src/locales/pt-BR.json
frontend/src/locales/ru.json
frontend/src/locales/uk.json
frontend/src/locales/zh.json
```

**What to do:**
- Start with `en.json` — ensure ALL namespace keys exist: `nav`, `home`, `dashboard`, `auth`, `rpg`, `economy`, `events`, `factions`, `social`, `admin`, `programmes`, `learningPaths`, `campfire`, `wellbeing`, `dataMarketplace`, `focusSessions`, `mistakes`, `puzzles`, `exams`, `quiz`, `chat`, `research`, `problemSolver`, `teachBack`, `blog`, `content`, `settings`, `notifications`
- Zero references to "Studyield" — all should say "Study RPG"
- Translate to all 14 other locales

### B9 — Frontend Config/Assets/Root (20 files) ⏳

```
frontend/.dockerignore           → REWRITE
frontend/.env.example            → KEEP
frontend/.gitignore              → KEEP
frontend/Dockerfile              → REWRITE (already done in B1)
frontend/README.md               → REWRITE (fresh)
frontend/eslint.config.js        → KEEP (tool config)
frontend/index.html              → REWRITE (already done in B2)
frontend/nginx.conf              → KEEP (functional)
frontend/package-lock.json       → KEEP (generated)
frontend/package.json            → KEEP (already re-authored)
frontend/postcss.config.js       → KEEP (tool config)
frontend/tailwind.config.js      → KEEP (tool config)
frontend/tsconfig.app.json       → KEEP
frontend/tsconfig.json           → KEEP
frontend/tsconfig.node.json      → KEEP
frontend/vite.config.ts          → KEEP (done in B4 — preserve server.hmr: false)
```

### B10 — Final: Remove AGPL-3.0 Licence & Attribution 🔒 (gated on B1–B9)

**ONLY after B1–B9 are ALL complete:**

1. Remove `LICENSE` file (AGPL-3.0 text)
2. Remove `NOTICE` file (upstream attribution)
3. Update `package.json` in both `backend/` and `frontend/` — remove `"license": "AGPL-3.0"`
4. Update `UPSTREAM.md` — can be removed or kept as a historical note
5. Update `THIRD_PARTY_NOTICES.md` — remove Studyield-specific attributions
6. Remove or rewrite `docs/architecture/decisions/0001-licence-decision.md`
7. Run the verification commands from `UPSTREAM_FILE_INVENTORY.md` §6:
   ```bash
   # Confirm no upstream paths remain unresolved:
   git ls-tree -r --name-only 0494e1a | sort | while read f; do
     [ -f "$f" ] || echo "MISSING: $f"
   done
   ```
8. Update `IMPLEMENTATION_STATUS.md` and `CHANGELOG.md`

---

## WORK STREAM 2: CI Pipeline — Tests + Coverage 🔴

**Goal:** CI runs all tests with coverage and reports it properly.

**Current state:** `.github/workflows/ci.yml` already runs `npm run test:cov -- --runInBand` for backend and `npm test` for frontend, with coverage artifact upload.

**What's missing / to improve:**

### 2.1 Coverage Thresholds
- Add coverage thresholds to `backend/package.json` under `jest.collectCoverageFrom` and a new `coverageThreshold` block:
  ```json
  "coverageThreshold": {
    "global": {
      "branches": 70,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  }
  ```
- Add coverage reporting to frontend `vitest.config.ts`:
  ```typescript
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html', 'lcov'],
    thresholds: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  }
  ```

### 2.2 CI Additions
In `.github/workflows/ci.yml`:
- Add a coverage summary comment step using `codecov/codecov-action@v4` or a GitHub step summary
- Add a `prettier --check` step to both jobs
- Add a frontend coverage upload step matching the backend one
- Consider adding a `security-audit` step: `npm audit --audit-level=high`

### 2.3 Frontend Test Expansion
The frontend currently has only ~9 tests. Add unit tests for:
- Core utilities (`src/lib/utils.ts`)
- All Zustand stores
- Key service functions
- Critical page components (smoke renders)
- RPG card logic, battle components
- Economy/marketplace components

---

## WORK STREAM 3: Documentation 📝

### 3.1 Update/Write These Docs

| Document | Action | Notes |
|----------|--------|-------|
| `README.md` | Verify Study RPG branding, no "Studyield" references | Already rewritten in B1 |
| `IMPLEMENTATION_STATUS.md` | Update with final status of all phases + rewrite progress | |
| `CHANGELOG.md` | Write comprehensive changelog covering all 16 phases | Should be rewrite-complete |
| `FUTURE_GOAL.md` | Update with post-rewrite roadmap | Already rewritten in B1 |
| `docs/STUDY_RPG_PHILOSOPHY.md` | Ensure it captures the full anti-overstudy, depth-over-length, game-to-reality philosophy | |
| `docs/deployment/hosting.md` | Add Cloudflare Pages deployment instructions | |
| `docs/getting-started/quick-start.md` | Fresh setup guide | |
| `docs/getting-started/configuration.md` | Full env var reference with all Ocean Protocol vars | |
| `docs/guides/connector-guide.md` | Update for new architecture | |
| `docs/architecture/overview.md` | Architecture diagram (text-based) | |
| `CONTRIBUTING.md` | Contributor guide | Already rewritten in B1 |
| `SECURITY.md` | Security policy | Already rewritten in B1 |
| `CODE_OF_CONDUCT.md` | Community standards | Already rewritten in B1 |
| `specs/README.md` | Index of all 16 specs | |
| All `backend/src/modules/*/README.md` | Update each module README to reflect Study RPG (43 files) | |

### 3.2 API Documentation
- Ensure Swagger/OpenAPI is properly gated (disabled in prod unless `SWAGGER_ENABLED=true`)
- Write API reference docs covering all endpoints grouped by module

### 3.3 Architecture Decision Records
- Write ADRs for major decisions made:
  - ADR-0002: Ocean Protocol Compute-to-Data integration (Polygon mainnet)
  - ADR-0003: Anti-OverStudy wellbeing system
  - ADR-0004: F2W Integrity & campfire metacognitive loop
  - ADR-0005: Clean-room rewrite approach
  - ADR-0006: Cloudflare Pages deployment

---

## WORK STREAM 4: Frontend Accessibility (a11y) ♿

### 4.1 Audit & Fix
Run through every page and component:

| Area | Action |
|------|--------|
| **Semantic HTML** | Replace `<div>` with `<main>`, `<section>`, `<nav>`, `<header>`, `<footer>`, `<article>` where appropriate |
| **Headings** | Ensure logical h1→h2→h3 hierarchy on every page (one h1 per page) |
| **Landmarks** | Wrap nav, main, aside regions in landmark elements |
| **Focus management** | All interactive elements must be focusable; modals trap focus; close on Escape |
| **Keyboard navigation** | All buttons, links, form inputs accessible via Tab/Enter/Space; no keyboard traps |
| **ARIA labels** | Add `aria-label` to icon-only buttons, `aria-expanded` to collapsibles, `aria-live` to dynamic content (timer, battle log, health meter) |
| **Color contrast** | Verify 4.5:1 ratio for text, 3:1 for large text and UI components (Tailwind default colors are usually fine) |
| **Screen reader text** | Add `sr-only` labels for visual-only elements (health bars, XP bars, mana bars) |
| **Form inputs** | All inputs have associated `<label>` (Radix Label component); error messages linked via `aria-describedby` |
| **Images** | All `<img>` tags have meaningful `alt` text |
| **Reduced motion** | Wrap Framer Motion animations in `prefers-reduced-motion` check |
| **Skip links** | Add "Skip to main content" link at top of layout |
| **Modal dialogs** | Radix Dialog already handles focus trap — verify all modals use it |
| **Tooltips/popovers** | Radix HoverCard/Popover/Tooltip — verify accessible names |

### 4.2 Testing
- Add `@testing-library/jest-dom` matchers if not already present
- Write smoke tests that render key pages and verify heading structure
- Add a test that checks for missing alt text on images (optional)

---

## WORK STREAM 5: Backend Quality Refactor 🔧

### 5.1 Code Quality
| Task | Details |
|------|---------|
| **Remove dead code** | Grep for unused imports, unreachable code, commented-out blocks |
| **Consistent error handling** | Ensure all services throw `HttpException` or `WsException` with consistent status codes; no raw `Error` throws |
| **DTO validation** | Verify every controller endpoint has DTO validation with `class-validator` + `ValidationPipe(forbidNonWhitelisted: true)` |
| **Transaction safety** | Audit all wallet/payment/marketplace operations for proper `BEGIN ... COMMIT` with `FOR UPDATE` locks |
| **SQL injection** | Audit all raw SQL queries — use parameterised queries everywhere, never string interpolation |
| **Logging** | Replace any `console.log` with NestJS `Logger`; use structured logging for audit events |
| **Config validation** | Ensure all `process.env` reads have sensible defaults and are documented in `.env.example` |
| **Type safety** | Remove all `any` types; use proper interfaces for all DB row types |

### 5.2 Test Coverage Gaps
The backend has 501 tests / 62 suites. Focus on modules that may be under-tested:
- `data-marketplace` — Ocean C2D publish path (needs mocked RPC)
- `ocean-node` — Idle-capacity monitor
- `wellbeing` — Integration of overstudy rules into focus/events
- `economy` — Marketplace buy/sell flows edge cases
- `rpg` — Battle engine edge cases with all status effects
- `factions` — Monthly settlement + help-pledge flows
- `events` — Quest completion, Abstracted/Limbo flows
- `integrity` — Campfire with real AI mock (currently has fallback test)

### 5.3 Performance
- Add database indexes for frequently queried patterns (exam query paths, marketplace listing queries)
- Consider connection pooling tuning for `pg` if not already configured
- Profile the AI completion calls — add timeouts and circuit breakers

---

## WORK STREAM 6: Testing Depth 🧪

### 6.1 Backend Testing Improvements

**Current: 501 tests / 62 suites. Target: 800+ tests / 80+ suites.**

| Module | Current Gap | Target |
|--------|------------|--------|
| `auth` | Basic flow tests | Token refresh, expiry, role guards, email-optional register |
| `users` | Basic CRUD | Faction assignment, XP events, IST-aware queries |
| `chat` | Basic send/receive | Typing indicators, unread counts, WebSocket reconnect |
| `quiz` | Basic attempts | Question generation, time limits, scoring edge cases |
| `content` | Basic CRUD | Document processing pipeline, flashcard SRS scheduling |
| `knowledge-base` | RAG basics | Hybrid retrieval scoring, reranker integration, version switching |
| `subscription` | Basic webhooks | Stripe event handling, plan upgrades/downgrades, grace periods |
| `notifications` | Basic send | VAPID push, email fallback, batch notifications |
| `programmes` | Template/queue | Full AI build cycle, reviewer scoring, archive lifecycle |
| `admin` | Basic CRUD | Audit log filtering, retention/purge, system status |
| `ocean-c2d` | Metadata fallback | Full publish with mocked Ocean.js SDK, DDO validation |
| `ocean-node` | Basic monitor | Start/stop lifecycle, cooldown, daily cap, user-returns detection |

### 6.2 Frontend Testing Improvements

**Current: ~9 tests. Target: 100+ tests.**

Write unit tests for:
- All utility functions in `src/lib/utils.ts`
- All service functions (API client methods)
- Zustand store state transitions
- Component rendering smoke tests for every major page
- Battle engine UI components (damage numbers, status effects, cooldowns)
- Economy components (marketplace listing cards, burn confirmation)
- Events components (StudyPass level calculations, quest progress)
- Campfire modal flow

### 6.3 Integration Tests
- Consider adding a Docker-based integration test job to CI:
  ```yaml
  integration-tests:
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: studyrpg_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
  ```
- Test the migration runner against the real Postgres service
- Test at least one end-to-end flow: register → create task → complete → earn XP → check wallet

---

## WORK STREAM 7: Cloudflare Deployment & Optimisation ☁️

### 7.1 Frontend → Cloudflare Pages
The frontend should deploy to Cloudflare Pages (static SPA).

**Setup:**
1. In Cloudflare Dashboard: Pages → Create project → Connect to GitHub → `Real-Nightmare/Study-RPG-Official`
2. Build settings:
   - **Framework preset**: None (or Vite)
   - **Build command**: `cd frontend && npm ci && npm run build`
   - **Build output directory**: `frontend/dist`
   - **Root directory**: `/` (repo root, not `frontend/`)
3. Set the API base URL as an environment variable: `VITE_API_BASE_URL`
4. Cloudflare Pages auto-deploys on push to `main`

### 7.2 Zero Worker Requests Goal
**Key insight:** Cloudflare Pages serves static assets from edge, NOT Workers. The HTML/JS/CSS comes from CDN edge cache. Worker requests happen only for:
- Dynamic routes (server-side rendering) — we don't have SSR
- Functions/API calls — we don't use Cloudflare Functions
- Custom headers/middleware via `_headers` or `_worker.js`

**To minimise any edge compute:**
1. Use the `_headers` file for aggressive caching:
   ```
   /assets/*
     Cache-Control: public, max-age=31536000, immutable
   /index.html
     Cache-Control: no-cache
   ```
2. Do NOT add a `_worker.js` file — let Cloudflare serve pure static
3. Use Cloudflare's automatic static optimisation (default for Pages)
4. All API calls go to the backend server directly (not through Cloudflare)
5. Consider using Cloudflare's "Smart Placement" only if the backend has high-latency API calls

### 7.3 Build Optimisation
- Ensure `vite.config.ts` has proper chunk splitting (already done — manualChunks for katex, charts, radix, markdown, motion, router, data, react-vendor, vendor)
- Enable gzip/brotli compression in Cloudflare (automatic for Pages)
- Ensure no large binary assets are bundled (use `public/` for static assets)

### 7.4 Backend Deployment
The backend (NestJS API) needs its own hosting:
- **Option A**: Railway / Render / Fly.io for the NestJS server + PostgreSQL
- **Option B**: Docker on a VPS (DigitalOcean, Hetzner)
- The backend needs: PostgreSQL, Redis, Qdrant (vector DB), optionally ClickHouse
- Set up health checks at `GET /health`

---

## WORK STREAM 8: Ocean Protocol Integration — Remaining Work 🌊

### 8.1 Current Status
- ✅ Ocean.js SDK (`@oceanprotocol/lib` 8.6.2) installed
- ✅ ERC721 data NFT + ERC20 datatoken deployment
- ✅ Fixed-rate exchange bundled when priced
- ✅ File/DDO encryption via Ocean Node
- ✅ Compute-policy DDO stored on-chain
- ✅ Polygon mainnet (chain ID 137) targeting
- ✅ Metadata-first fallback when C2D fails
- ✅ Idle-capacity Ocean Node monitor

### 8.2 Remaining Tasks
| Task | Details |
|------|---------|
| **Fund wallet** | Owner needs to send MATIC to the publisher wallet address |
| **Set OCEAN_RPC_URL** | Default `https://polygon-rpc.com` works but dedicated RPC (Alchemy/Infura) is more reliable |
| **Set publisher wallet private key** | `OCEAN_PUBLISHER_PRIVATE_KEY` env var — NEVER commit this |
| **Test C2D publish** | Run `POST /data-marketplace/datasets/:id/publish` against Polygon mainnet with real MATIC |
| **Verify Ocean Node** | `OCEAN_NODE_ENABLED=true` + Docker available — test idle-capacity earnings |
| **Monitor gas costs** | C2D publish costs gas; budget for the 2 MATIC |
| **Dataset pricing** | Set `dataTokenPrice` on published datasets (Ocean datatokens) |
| **Compute algo registration** | Register the aggregate computation algorithm with the Ocean Compute provider |

### 8.3 Environment Variables for Ocean Protocol
```env
# Polygon Mainnet (default)
OCEAN_RPC_URL=https://polygon-rpc.com
OCEAN_CHAIN_ID=137
OCEAN_NODE_URL=https://compute1.oceanprotocol.com/

# Publisher wallet (for on-chain publishing)
OCEAN_PUBLISHER_PRIVATE_KEY=<never commit>

# Marketplace config
MARKETPLACE_PUBLISH_ENABLED=true
MARKETPLACE_MIN_GROUP_SIZE=50
MARKETPLACE_CONSENT_THRESHOLD=0.8

# Aquarius (Ocean metadata store)
OCEAN_AQUARIUS_URL=https://aquarius.oceanprotocol.com

# R2/S3 for aggregate file storage
R2_PUBLIC_URL=<your R2 public URL>

# Ocean Node (idle-capacity earnings)
OCEAN_NODE_ENABLED=false  # Set true when Docker is available
```

---

## WORK STREAM 9: Admin AI Benchmarking Dashboard 📊

### 9.1 What Exists
- ✅ `BenchmarkService` + `benchmark-metrics.ts` (pure metrics module)
- ✅ Two-window comparison ([2N,N) vs [N,today))
- ✅ Weighted 0–100 effectiveness score + verdict band
- ✅ AI narrative grounded only in metrics (deterministic fallback)
- ✅ Admin-only, never published, never references individuals
- ✅ `benchmark_runs` table with metrics, report, summary

### 9.2 What's Needed
| Task | Details |
|------|---------|
| **Admin dashboard UI** | Build a dedicated page or tab in `AdminPage` showing benchmark runs |
| **Run new benchmark** | Button to start a benchmark with configurable window length (N days) and optional cohort filters (country, board, grade) |
| **Results display** | Show before/after comparison for each metric, the overall score (0–100), verdict band, and AI narrative |
| **Export** | Allow downloading benchmark reports as CSV or PDF |
| **History** | List all past benchmark runs with timestamps, scores, and quick-view |
| **Scheduled benchmarks** | Optional: weekly automated benchmarks via BullMQ repeatable job |

### 9.3 Benchmark Metrics Tracked
```typescript
// From benchmark-metrics.ts
interface BenchmarkMetrics {
  // Study quantity
  focusMinutes: { before: number; after: number; delta: number };
  stpEarned: { before: number; after: number; delta: number };
  studyStreak: { before: number; after: number; delta: number };
  
  // Study quality
  quizAccuracy: { before: number; after: number; delta: number };
  examScore: { before: number; after: number; delta: number };
  teachBackDepth: { before: number; after: number; delta: number };
  campfireDepth: { before: number; after: number; delta: number };
  
  // Overall
  effectivenessScore: number; // 0-100
  verdictBand: 'excellent' | 'good' | 'moderate' | 'minimal' | 'no-effect';
  narrative: string;
}
```

### 9.4 API Endpoints
```
POST   /data-marketplace/benchmarks          → start new benchmark
GET    /data-marketplace/benchmarks          → list all runs
GET    /data-marketplace/benchmarks/:id      → get specific run with full report
```

---

## WORK STREAM 10: Anti-OverStudy & Philosophy Enforcement 🧘

### 10.1 What Exists
- ✅ `overstudy.ts` — decay curves, cooldown gates, night-rest guards
- ✅ Focus session enforcement (rest-cooldown, exhaustion, night nudge)
- ✅ Event EXP dampening past healthy optimum
- ✅ Study health meter (fresh/focused/draining/depleted)
- ✅ AI philosophy injection into all 5 surfaces
- ✅ Campfire metacognitive loop (depth question → multiplier)

### 10.2 What May Still Need Work
| Task | Details |
|------|---------|
| **Verify AI surfaces** | Test all 5 AI surfaces actually load and use the philosophy block: chat, teach-back evaluator, campfire tutor, programme architect, learning-path coach |
| **Philosophy audit** | Grep all AI prompt templates for "Studyield" → replace with "Study RPG" |
| **Frontend health copy** | Ensure all UI copy is mastery-framed, not grind-framed: "Your real-world cognitive capacity increased!" not "You earned XP!" |
| **Edge cases** | Test: student studies 12 hours straight, student studies at 3 AM, student tries to bypass rest cooldown |
| **Admin wellbeing dashboard** | Consider adding aggregate wellbeing stats to the admin system status (average daily focus, % of students hitting healthy zone, rest compliance rate) |

### 10.3 Config Defaults (from `integrity-config.ts`)
```typescript
// Anti-OverStudy thresholds (RPG wellbeing config)
OPTIMAL_DAILY_FOCUS_MINUTES: 240,  // 4 hours — diminishing returns start here
HARD_DAILY_CAP: 480,               // 8 hours — minimum multiplier at 0.2×
MIN_FOCUS_FACTOR: 0.2,             // Floor multiplier for extreme overstudy
SESSION_COOLDOWN_MINUTES: 15,      // Rest between long focus blocks
NIGHT_START_HOUR: 23,              // IST — night rest nudge starts
NIGHT_END_HOUR: 6,                 // IST — night rest nudge ends

// Reward integrity
INTEGRITY_FLOOR: 0.6,              // Minimum reward multiplier (60% accuracy)
MAX_PREMIUM_MULTIPLIER: 2.0,       // Cap on campfire × difficulty
CAMPFIRE_DAILY_CAP: 3,             // Max reflections per day
CAMPFIRE_MIN_DEPTH: 0,             // Grade 0-100
CAMPFIRE_MAX_MULTIPLIER: 1.5,      // Max campfire reward boost

// Anti-cheese
QUIZ_RATE_LIMIT_PER_HOUR: 12,
MIN_ANSWER_TIME_SECONDS: 4,
QUIZ_STP_ACCURACY_THRESHOLD: 0.9,  // 90% accuracy for STP
EXAM_CLONE_DAILY_CAP: 5,
TEACH_BACK_MIN_CHARS: 80,
```

---

## 🔒 ENVIRONMENT VARIABLES — Complete Reference

### Backend Required
```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/studyrpg
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=<random 32+ char string>
JWT_EXPIRY=7d

# AI
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://openrouter.ai/api/v1  # or direct OpenAI
AI_MODEL=gpt-4o-mini

# Qdrant (vector DB)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@studyrpg.app

# Cloudflare R2 (aggregate file storage for Ocean)
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=studyrpg-datasets
R2_PUBLIC_URL=

# Ocean Protocol (Polygon mainnet)
OCEAN_RPC_URL=https://polygon-rpc.com
OCEAN_CHAIN_ID=137
OCEAN_PUBLISHER_PRIVATE_KEY=           # NEVER COMMIT
OCEAN_AQUARIUS_URL=https://aquarius.oceanprotocol.com
OCEAN_NODE_URL=https://compute1.oceanprotocol.com/
MARKETPLACE_PUBLISH_ENABLED=false
MARKETPLACE_MIN_GROUP_SIZE=50
MARKETPLACE_CONSENT_THRESHOLD=0.8
OCEAN_NODE_ENABLED=false

# Web Push (VAPID)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@studyrpg.app

# Stripe (subscription infra — NOT game currency)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Nightmare super-admin (env-seeded on first boot)
NIGHTMARE_ADMIN_USERNAME=nightmare
NIGHTMARE_ADMIN_EMAIL=nightmare@studyrpg.app
NIGHTMARE_ADMIN_PASSWORD=<change this>

# Swagger (disabled in prod by default)
SWAGGER_ENABLED=false

# CORS
CORS_ORIGINS=http://localhost:5173,https://studyrpg.app
```

### Frontend Required
```env
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

---

## ✅ VERIFICATION CHECKLIST (run after ALL work is done)

```bash
# Backend
cd backend && npm ci
cd backend && npm run lint
cd backend && npx tsc --noEmit --skipLibCheck
cd backend && npm run build
cd backend && npm test
cd backend && npm run test:cov

# Frontend
cd frontend && npm ci
cd frontend && npm run lint
cd frontend && npx tsc --noEmit --skipLibCheck
cd frontend && npm run build
cd frontend && npm test

# Clean-room verification
git ls-tree -r --name-only 0494e1a | sort | while read f; do
  [ -f "$f" ] || echo "MISSING: $f"
done

# Brand leak check
grep -r "studyield\|Studyield\|STUDYIELD" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.html" . | grep -v node_modules | grep -v .git | grep -v archive | grep -v NOTICE | grep -v UPSTREAM

# License check (after B10)
grep -r "AGPL" --include="*.json" --include="*.md" . | grep -v node_modules | grep -v .git | grep -v archive
```

---

## 🎯 PRIORITY ORDER

1. **Work Stream 1 (B5–B10)** — Clean-room rewrite. This is the legal blocker.
2. **Work Stream 2 (CI)** — Get tests + coverage in CI immediately.
3. **Work Stream 7 (Cloudflare)** — Get frontend deployed.
4. **Work Stream 6 (Testing depth)** — Expand test coverage.
5. **Work Stream 5 (Backend refactor)** — Code quality pass.
6. **Work Stream 4 (a11y)** — Accessibility compliance.
7. **Work Stream 3 (Docs)** — Documentation can be written in parallel.
8. **Work Stream 8 (Ocean Protocol)** — Integration verification.
9. **Work Stream 9 (Benchmarking)** — Admin dashboard UI.
10. **Work Stream 10 (Philosophy audit)** — Final branding sweep.

---

## 📋 GIT COMMIT STYLE

Use Conventional Commits:
```
feat(economy): add marketplace buy/sell flow
fix(auth): prevent token reuse after logout
docs(api): add endpoint reference for RPG battles
test(rpg): add battle engine edge case coverage
refactor(content): extract document processor into pure module
chore(ci): add coverage thresholds to jest config
```

---

*Generated from the Study RPG repository state as of 2026-08-18.*
*This prompt covers all work streams identified through the conversation history.*
