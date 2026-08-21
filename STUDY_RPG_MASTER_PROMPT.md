# Study RPG — Comprehensive Master Prompt for AI

> **Repository**: [Real-Nightmare/Study-RPG-Official](https://github.com/Real-Nightmare/Study-RPG-Official)
> **Purpose**: This prompt tells an AI EVERYTHING about the Study RPG project so it can continue development without needing to inspect the codebase itself.

---

## 1. What Study RPG Is

**Study RPG** is a gamified AI learning platform built on top of the open-source **Studyield** project. It wraps an academic learning system in an RPG layer where all progression is earned through real study — never purchased.

**Core Philosophy**:
- Depth over length — quality study matters more than hours logged
- Health-first anti-overstudy — the platform actively discourages cramming
- Free-to-Win — zero pay-to-win paths; subscriptions only gate infrastructure
- Game-to-reality framing — RPG rewards map to real cognitive improvement
- Mastery over memorisation — understanding is tested, not just recall

**Target Audience**: Students (currently CBSE Grade 9 preset, but extensible)

**Tech Stack**:
- **Backend**: NestJS 10, TypeScript, raw SQL via `pg` (no ORM), custom migration runner
- **Frontend**: React 19, Vite 7, Tailwind CSS, Radix UI (shadcn-style), Zustand, TanStack Query
- **Database**: PostgreSQL 15, Redis 7 (caching/BullMQ queues), Qdrant (vector search), ClickHouse (analytics)
- **Auth**: JWT (email-optional), username-based login
- **Realtime**: Socket.IO (chat, live quiz, exam clone, social, battles)
- **AI**: OpenRouter/LLM integration (chat, RAG, teach-back, campfire reflections, programme building)
- **Payments**: Stripe (infra-level only, never game currency)
- **Deployment**: Docker Compose (full stack)
- **Licence**: AGPL-3.0 (upstream Studyield) — clean-room rewrite in progress

---

## 2. Repository Structure

```
Study-RPG-Official/
├── backend/                          # NestJS API
│   ├── src/
│   │   ├── common/                   # Shared decorators, guards, interceptors, gateways
│   │   ├── modules/                  # Feature modules (43 total)
│   │   │   ├── academics/            # Subjects → chapters → topics structure
│   │   │   ├── admin/                # Nightmare super-admin, audit logs
│   │   │   ├── admin-notes/          # Universal admin notes with PDF page selection
│   │   │   ├── ai/                   # Multi-agent LLM orchestration
│   │   │   ├── analytics/            # Usage analytics
│   │   │   ├── auth/                 # JWT auth, email-optional
│   │   │   ├── blog/                 # Blog posts
│   │   │   ├── chat/                 # Realtime chat
│   │   │   ├── clickhouse/           # ClickHouse analytics wrapper
│   │   │   ├── code-sandbox/         # Code execution sandbox
│   │   │   ├── content/              # Documents, study sets, flashcards, notes
│   │   │   ├── dashboard/            # Student dashboard summary
│   │   │   ├── database/             # PostgreSQL connection
│   │   │   ├── economy/              # Marketplace, scraper/burner, supply ledger
│   │   │   ├── email/                # Email service (SES)
│   │   │   ├── events/               # StudyPass, quests, Abstracted, Great Extinction
│   │   │   ├── exam-clone/           # Exam simulation
│   │   │   ├── exam-periods/         # Exam scheduling
│   │   │   ├── factions/             # Auto-balanced factions, monthly settlement
│   │   │   ├── firebase/             # FCM push notifications
│   │   │   ├── focus-sessions/       # Pomodoro-style focus tracking
│   │   │   ├── integrity/            # Campfire loop, anti-cheese guards
│   │   │   ├── knowledge-base/       # RAG chunking, document processing
│   │   │   ├── learning-paths/       # Personalised learning paths
│   │   │   ├── mistakes/             # Mistake notebook
│   │   │   ├── notifications/        # Web push, in-app notifications
│   │   │   ├── planner/              # Task planner (core tool pattern)
│   │   │   ├── problem-solver/       # AI problem solving with agents
│   │   │   ├── programmes/           # AI-built programmes, templates, review queue
│   │   │   ├── puzzles/              # Per-subject puzzles with streaks
│   │   │   ├── qdrant/               # Qdrant vector store wrapper
│   │   │   ├── queue/                # BullMQ job queue
│   │   │   ├── quiz/                 # Live quiz, quiz generation
│   │   │   ├── rag/                  # RAG retrieval, evaluation, reranking
│   │   │   ├── redis/                # Redis connection
│   │   │   ├── research/             # Deep research with web search
│   │   │   ├── rpg/                  # RPG core: stats, STP ledger, cards, battles
│   │   │   ├── social/               # Friends, DMs, user search
│   │   │   ├── storage/              # File storage
│   │   │   ├── subscription/         # Stripe (infra-level only)
│   │   │   ├── teach-back/           # Feynman technique evaluation
│   │   │   └── users/                # User profiles, XP, levels
│   │   ├── types/                    # TypeScript type definitions
│   │   ├── app.module.ts             # Root NestJS module
│   │   ├── health.controller.ts      # Health check endpoint
│   │   └── main.ts                   # Application entry point
│   ├── migrations/                   # SQL migrations (000-030)
│   ├── scripts/                      # migrate.js, backup/restore, load-test
│   └── Dockerfile
├── frontend/                         # React SPA
│   ├── src/
│   │   ├── components/               # Reusable UI components
│   │   │   ├── ui/                   # shadcn-style Radix components
│   │   │   ├── landing/              # Landing page sections
│   │   │   ├── notes/                # Mind map, presentation views
│   │   │   ├── problem-solver/       # Interactive graph
│   │   │   └── documents/            # Document tabs
│   │   ├── pages/                    # Route pages
│   │   │   ├── dashboard/            # Authenticated pages (70+ pages)
│   │   │   └── [public pages]        # Landing, auth, legal
│   │   ├── services/                 # API client functions
│   │   ├── stores/                   # Zustand state stores
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── contexts/                 # Auth context
│   │   ├── providers/                # Query provider (TanStack)
│   │   ├── layouts/                  # Dashboard layout, public layout
│   │   ├── locales/                  # 15 locale JSON files (en, ar, bn, de, es, fr, hi, it, ja, ko, nl, pt-BR, ru, uk, zh)
│   │   ├── types/                    # TypeScript types
│   │   ├── lib/                      # Utilities, i18n config
│   │   ├── config/                   # API configuration
│   │   └── main.tsx                  # React entry point
│   ├── public/                       # Static assets (logos, service worker)
│   ├── Dockerfile
│   └── nginx.conf
├── docs/                             # Documentation
│   ├── audits/                       # Repository audits
│   ├── architecture/                 # Architecture docs, decisions
│   ├── implementation/               # Master plan
│   ├── deployment/                   # Hosting guide
│   └── runbooks/                     # Ops runbooks
├── specs/                            # Feature specs (Spec Kit format)
├── docker-compose.yml                # Full stack orchestration
├── start.sh                          # Dev environment bootstrap
├── AGENTS.md                         # AI agent operating guide
├── IMPLEMENTATION_STATUS.md          # Living implementation tracker
└── UPSTREAM.md                       # Upstream Studyield provenance
```

---

## 3. Database Schema (Key Tables)

### Core Academic
- `users` — id, email (nullable), username (unique), password, role (student/admin/teacher), is_active, faction_id, created_at
- `academic_profiles` — user_id, board, grade, school_name
- `subjects` — id, profile_id, name, color, icon
- `chapters` — id, subject_id, name, position
- `topics` — id, chapter_id, name, position, difficulty

### Study Tools
- `focus_sessions` — id, user_id, subject_id, task_id, started_at, ended_at, duration_minutes, completed, verification (JSONB)
- `study_sets` — id, user_id, title, description, created_at
- `flashcards` — id, study_set_id, front, back, interval, ease_factor, next_review
- `notes` — id, user_id, title, content, subject_id, chapter_id, topic_id
- `documents` — id, user_id, filename, content, status, ingestion_state
- `study_tasks` — id, user_id, title, description, priority, type, subject_id, due_date, recurrence, completed

### RPG System
- `player_profiles` — user_id, xp, level, stp_balance, battle_rating, study_streak, puzzle_streak, event_exp
- `wallet_ledger` — id, user_id, currency, amount, balance_before, balance_after, type, reason, idempotency_key
- `card_definitions` — id, card_key, name, rarity, ability_type, ability_value, lore, supply, official_value
- `card_instances` — id, user_id, card_definition_id, acquired_at, tradeable, location (inventory/vault)
- `decks` — id, user_id, name, active
- `deck_cards` — id, deck_id, card_definition_id, slot (0-4)
- `battles` — id, user_id, monster_id, world, status, log (JSONB), rewards, created_at
- `pvp_duels` — id, challenger_id, defender_id, deck_snapshots (JSONB), battle_id, winner, ratings

### Economy
- `marketplace_listings` — id, seller_id, card_instance_id, price, status, created_at, expires_at
- `marketplace_offers` — id, buyer_id, listing_id, amount, status
- `card_supply_ledger` — id, card_definition_id, change, reason, created_at
- `card_price_history` — id, card_definition_id, price, recorded_at
- `card_burn_instalments` — id, user_id, card_instance_id, instalment_number, amount, due_at, paid

### Events
- `events` — id, slug, name, description, status (scheduled/active/ended), start_at, end_at, config (JSONB)
- `user_event_state` — id, user_id, event_id, study_pass_level, event_exp, gold_track
- `quests` — id, event_id, name, description, type, objectives (JSONB), rewards (JSONB)
- `user_quests` — id, user_id, quest_id, progress, claimed
- `event_items` — id, event_id, name, type, rarity
- `user_event_items` — id, user_id, item_id, quantity
- `abstracted_instances` — id, user_id, card_instance_id, status
- `event_extinction_targets` — id, event_id, card_definition_id, burned_count, target_count
- `event_global_milestones` — id, event_id, threshold, rewards (JSONB)
- `user_milestone_claims` — id, user_id, milestone_id

### Social
- `friendships` — id, requester_id, addressee_id, status (pending/accepted/blocked)
- `direct_messages` — id, sender_id, receiver_id, content, read_at
- `factions` — id, name, color, member_count, target_size
- `faction_members` — id, faction_id, user_id, joined_at
- `faction_score_events` — id, faction_id, user_id, event_type, points, ist_period
- `faction_settlements` — id, faction_id, ist_period, settled_at
- `rpg_parties` — id, leader_id, name, created_at
- `rpg_party_members` — id, party_id, user_id
- `rpg_party_battles` — id, party_id, monster_id, battle_id

### Integrity
- `campfire_reflections` — id, user_id, source, question, answer, depth_score, multiplier, created_at
- `audit_logs` — id, actor_id, action, target_type, target_id, reason, metadata, created_at

### Programme System
- `programmes` — id, creator_id, name, description, kind, objectives (JSONB), milestones (JSONB), activities (JSONB), reward_policy (JSONB), status, ai_review (JSONB), review_history (JSONB)
- `programme_members` — id, programme_id, user_id, joined_at
- `programme_templates` — id, name, description, kind, outline (JSONB), active
- `learning_paths` — id, user_id, name, steps (JSONB), programme_id, programme_name, review (JSONB), needs_regeneration

### Data Marketplace
- `data_consent` — id, user_id, granted, revoked_at
- `marketplace_datasets` — id, user_id, consent_id, aggregate_data (JSONB), ddo, privacy_report, checksum, status
- `benchmark_runs` — id, admin_id, window_start, window_end, metrics (JSONB), score, narrative

### Infrastructure
- `game_config` — key, value (JSONB) — stores all RPG/economy/event/wellbeing thresholds
- `audit_retention_config` — days, set_by, set_at, reason
- `web_push_subscriptions` — user_id, endpoint (PK), keys

---

## 4. Key Features Explained

### 4.1 Study Tools
- **Focus Sessions**: Pomodoro-style timer with rest-cooldown gates, night-rest nudges, and server-verified engagement
- **Study Tasks**: Priority-based task planner with due dates, recurrence, and subject links
- **Flashcards**: Spaced repetition with ease factors
- **Notes**: Rich text with mind map and presentation views
- **Quizzes**: AI-generated quizzes with live multiplayer mode
- **Exam Clone**: AI simulates past exams with hints and difficulty levels
- **Puzzles**: Per-subject puzzles with streaks and ranked mode
- **Mistake Notebook**: Categorised mistakes with resolve/reopen lifecycle

### 4.2 AI Features
- **Chat Assistant**: RAG-powered with the study philosophy injected
- **Teach-Back (Feynman)**: Students explain concepts; AI evaluates depth
- **Campfire Reflection**: ONE targeted question before cashing out rewards (1.0-1.5× multiplier)
- **Problem Solver**: Multi-agent system (analysis → solver → verifier → hints → alternatives)
- **Deep Research**: Web search + RAG for comprehensive reports
- **Programme Builder**: AI creates personalised learning programmes
- **Learning Paths**: AI maps programme objectives into ordered steps
- **Content Extraction**: PDF/DOCX parsing with chunking and embedding

### 4.3 RPG System
- **Player Stats**: XP, level, STP (in-game currency), battle rating
- **STP Ledger**: Immutable wallet with idempotent mutations
- **Cards**: 9 original cards with rarities, abilities, and lore
- **Decks**: Exactly 5 cards with restricted-ability validation
- **Battle Engine**: Deterministic, server-authoritative, fully replayable
- **PvP Duels**: Async ghost battles via deck snapshots
- **Party Battles**: Up to 4 friends vs exam bosses

### 4.4 Economy
- **Marketplace**: Buy/sell cards, make offers
- **Scraper**: Permanent card removal for immediate STP payout
- **Burner**: Card removal with instalment payouts
- **Supply Ledger**: Tracks card supply with extinction mechanics

### 4.5 Events
- **StudyPass**: 14-level progression with Free/Gold tracks
- **Quests**: Daily, weekly, study, and puzzle quests
- **Abstracted Event**: Untradeable Legendary cards, Limbo redemption
- **Great Extinction**: Global pyre with Extinction Sigils

### 4.6 Community
- **Factions**: Auto-balanced groups with monthly IST settlement
- **Friends & Chat**: Realtime DMs via Socket.IO
- **Programmes**: AI-built learning programmes with review queue
- **Admin Notes**: Universal notes merged into RAG context

### 4.7 Integrity System
- **Campfire Loop**: Mandatory reflection before reward cash-out
- **Anti-Cheese Guards**: Rate limiting, answer time sanity, focus verification
- **Exponential Reward Curve**: Accuracy-based with difficulty multipliers
- **Wellbeing Guards**: Rest cooldowns, night-rest nudges, overstudy dampening

---

## 5. API Endpoints (Key Routes)

### Auth
- `POST /auth/register` — Create account (username and/or email)
- `POST /auth/login` — Get JWT token

### Academics
- `GET/POST /academics/profiles` — School profiles
- `GET/POST /academics/profiles/:id/subjects` — Subjects
- Nested chapters/topics CRUD

### Dashboard
- `GET /dashboard/summary` — Today's plan, tasks, exams, stats
- `GET/PUT /dashboard/preferences` — Hide game stats toggle

### Focus Sessions
- `POST /focus-sessions/start` — Start timer
- `POST /focus-sessions/:id/complete` — Finish session
- `GET /focus-sessions/study-health` — Current health band

### RPG
- `GET /rpg/profile` — Player stats
- `GET /rpg/wallet/ledger` — STP history
- `GET/POST /rpg/cards` — Card collection
- `GET/POST /rpg/decks` — Deck management
- `POST /rpg/battles` — Start battle
- `POST /rpg/battles/:id/action` — Battle action
- `GET /rpg/battles/:id` — Battle state
- `POST /rpg/pvp/duels` — Challenge/matchmake
- `GET /rpg/pvp/leaderboard` — Top players

### Economy
- `GET /economy/marketplace` — Browse listings
- `POST /economy/marketplace` — List card
- `POST /economy/marketplace/:id/buy` — Purchase
- `POST /economy/cards/:id/scrape` — Remove for STP
- `POST /economy/cards/:id/burn` — Start burn instalments

### Events
- `GET /events/current` — Active event
- `POST /events/current/study-pass/track` — Earn EXP
- `POST /events/current/study-pass/claim` — Claim reward
- `GET /events/quests` — Active quests
- `POST /events/quests/:id/claim` — Complete quest

### Integrity
- `GET /study-integrity/campfire/status` — Can cash out?
- `POST /study-integrity/campfire` — Get reflection question
- `POST /study-integrity/campfire/:id/answer` — Submit answer

### Programme System
- `GET /programmes` — List programmes
- `POST /programmes` — Create programme
- `GET /programmes/templates` — Browse templates
- `POST /programmes/:id/learning-path` — Generate path

### Admin
- `GET /admin/users` — List users
- `GET /admin/audit-logs` — View audit trail
- `GET /admin/status` — System health
- `POST /admin/audit/purge` — Clean old logs

---

## 6. Frontend Pages

### Public
- Landing page (hero, features, testimonials, CTA)
- Auth pages (login, register, forgot password, reset)
- Legal pages (privacy, terms, cookies, data deletion)
- Blog, features, about, contact, FAQ, support

### Dashboard (Authenticated)
- **Home**: Widget grid with today's plan, stats, quests
- **Academics**: Subjects, chapters, topics, exams
- **Study Tools**: Focus sessions, tasks, flashcards, notes, quizzes
- **RPG**: Character, decks, battle, duels, leaderboard
- **Economy**: Marketplace, my cards, supply report
- **Events**: StudyPass, quests, items, abstracted, extinction
- **Social**: Friends, chat, factions
- **Programmes**: Browse, create, templates, review queue
- **Learning Paths**: Personalised paths with regeneration
- **Admin**: Users, audit, notes, syllabus, system status
- **Settings**: Account, notifications, appearance

---

## 7. Environment Variables Required

### Backend (.env)
```
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/studyrpg
REDIS_URL=redis://localhost:6379

# AI
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-3-sonnet

# JWT
JWT_SECRET=your-secret-here
JWT_EXPIRY=7d

# Stripe (infra only)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Qdrant (vector search)
QDRANT_URL=http://localhost:6333

# ClickHouse (analytics)
CLICKHOUSE_URL=http://localhost:8123

# Email (SES)
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY=...
AWS_SES_SECRET_KEY=...
EMAIL_FROM=noreply@studyrpg.app

# Firebase (push notifications)
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# Web Push (VAPID)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# Ocean Protocol (data marketplace)
OCEAN_PUBLISHER_WALLET=0x...
OCEAN_NODE_URL=https://...

# Nightmar e Admin
NIGHTMARE_ADMIN_USERNAME=nightmare
NIGHTMARE_ADMIN_EMAIL=nightmare@studyrpg.app
NIGHTMARE_ADMIN_PASSWORD=changeme
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

---

## 8. Running the Project

### Quick Start
```bash
# Start all services
docker-compose up -d

# Run migrations
cd backend && npm run migrate

# Seed admin user (auto-seeds on first boot if no admins exist)
```

### Development
```bash
# Backend
cd backend && npm install && npm run start:dev

# Frontend
cd frontend && npm install && npm run dev
```

### Commands
```bash
# Backend
npm run build          # Compile TypeScript
npm run start:dev      # Dev server with hot reload
npm run migrate        # Run database migrations
npm test               # Run unit tests
npm run lint           # Lint code

# Frontend
npm run build          # Production build
npm run dev            # Dev server
npm test               # Run vitest tests
npm run lint           # Lint code
```

---

## 9. Testing

- **Backend**: Jest with 430+ unit tests across 53 suites
- **Frontend**: Vitest + jsdom + Testing Library
- Run `npm test` in either directory

---

## 10. Deployment

### Docker Compose Services
- PostgreSQL 15
- Redis 7
- Qdrant (vector search)
- ClickHouse (analytics)
- Backend (NestJS)
- Frontend (Nginx)

### Production
- Build frontend: `npm run build` → outputs to `dist/`
- Backend: `npm run build` → `dist/`
- Run migrations: `npm run migrate`
- Start: `npm run start:prod`

---

## 11. Clean-Room Rewrite Status

The repository is being rewritten from the upstream Studyield project to remove AGPL-3.0 obligations. See `docs/audits/REWRITE_LEDGER.md` for progress.

**Completed**: B1-B4 (root files, branding, backend common, backend modules)
**Pending**: B5-B10 (migrations, backend configs, frontend source, locales, frontend configs, final AGPL removal)

---

## 12. Key Files for New Developers

1. `AGENTS.md` — How to work in this repo
2. `IMPLEMENTATION_STATUS.md` — What's built and what's pending
3. `docs/STUDY_RPG_PHILOSOPHY.md` — The vision
4. `docs/architecture/overview.md` — Technical map
5. `specs/` — Feature specifications
6. `UPSTREAM.md` — Provenance and rewrite program

---

## 13. Important Conventions

### Backend
- Raw SQL only — no ORM
- Modules follow `src/modules/<feature>/` pattern
- CamelCase responses via interceptor
- DTOs enforced with `forbidNonWhitelisted`
- Migrations: `NNN_name.sql` with unique prefixes

### Frontend
- shadcn-style Radix components
- Zustand stores for client state
- TanStack Query for server state
- i18n: add keys to ALL 15 locale files
- Pages under `src/pages/dashboard/`

### Git
- Conventional Commits
- Single `main` branch
- Freebuff-managed credentials

---

## 14. What Makes Study RPG Unique

1. **Health-First Anti-Overstudy**: The platform actively discourages unhealthy study patterns
2. **Campfire Reflections**: Mandatory metacognitive questions before rewards
3. **Free-to-Win Meritocracy**: Zero pay-to-win; subscriptions only gate infrastructure
4. **Exponential Reward Curve**: Accuracy-based with difficulty multipliers
5. **Ghost PvP**: Fair async duels via deck snapshots
6. **Exam Bosses**: Party battles against curriculum-themed bosses
7. **Data Marketplace**: Privacy-first Ocean Protocol integration
8. **AI Benchmarking**: Measures actual learning improvement

---

**This prompt is the single source of truth for the Study RPG project.** An AI reading this should be able to continue development without inspecting the codebase.
