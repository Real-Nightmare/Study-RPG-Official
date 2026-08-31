# Architecture Overview

How Study RPG works under the hood.

## High-Level Design

```
┌─────────────────────────────────────────────────┐
│  Browser (React 19 SPA)                         │
│  Vite + Tailwind + Radix UI + Zustand           │
│  Socket.IO client (live chat, quiz, battles)    │
└──────────────────────┬──────────────────────────┘
                       │ /api + /socket.io
┌──────────────────────▼──────────────────────────┐
│  Backend (NestJS 10 + BullMQ)                   │
│  43 feature modules, raw SQL, no ORM            │
├──────────┬──────────┬──────────┬────────────────┤
│ Postgres │  Redis   │  Qdrant  │  ClickHouse    │
│ (data)   │ (cache/  │ (vector  │ (analytics)    │
│          │  queues) │  search) │                │
└──────────┴──────────┴──────────┴────────────────┘
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │  Ollama  │  │  MinIO   │  │  Mailpit │
         │ (AI/LLM) │  │ (files)  │  │ (email)  │
         └──────────┘  └──────────┘  └──────────┘
```

## Backend

NestJS 10 with TypeScript and raw SQL (no ORM). All modules live in `backend/src/modules/`:

| Module | What It Does |
|--------|-------------|
| `auth` | JWT login, username-based registration, email optional |
| `academics` | Subjects → chapters → topics hierarchy (CBSE Grade 9 preset) |
| `ai` | Multi-agent LLM orchestration (chat, quiz gen, grading, RAG) |
| `rag` | Document ingestion → chunking → embeddings → Qdrant → retrieval |
| `content` | Study sets, flashcards, notes, document uploads |
| `focus-sessions` | Timer-based study tracking with wellbeing guards |
| `integrity` | Campfire reflections, anti-cheese guards, reward curves |
| `rpg` | Player stats, STP/XP wallet, cards, decks, battle engine |
| `economy` | Marketplace, card trading, supply ledger, extinction |
| `events` | StudyPass, daily/weekly quests, Abstracted, Great Extinction |
| `social` | Friends, direct messages, factions, parties |
| `chat` | Realtime messaging via Socket.IO |
| `programmes` | AI-built learning programmes and objectives |
| `dashboard` | Student dashboard summary (tasks, XP, streaks) |
| `admin` | Nightmare super-admin, audit logs, system health |
| `storage` | Multi-provider file uploads (MinIO/R2/Supabase/Cloudinary/Appwrite) |
| `email` | Password resets via SMTP or SES |
| `notifications` | Web push (VAPID) notifications |
| `code-sandbox` | Sandboxed code execution (Python/Node) |
| `research` | Web search via SearXNG or commercial APIs |
| `teach-back` | Feynman technique — explain a concept, AI scores depth |
| `problem-solver` | Multi-agent problem analysis and hints |
| `exam-clone` | Practice exams with AI grading and mistake analysis |

## Frontend

React 19 + Vite 7 + Tailwind CSS + Radix UI (shadcn-style).

| Directory | What's There |
|-----------|-------------|
| `src/pages/` | Public pages (landing, auth) + `dashboard/` (app) |
| `src/components/` | Shared UI components (shadcn-style) |
| `src/stores/` | Zustand state management |
| `src/services/` | API clients (axios-based) |
| `src/locales/` | 15 language files |
| `src/lib/` | Utilities, helpers, a11y |

## Database

PostgreSQL 15 is the source of truth. All queries are raw SQL (no ORM).

Key tables:

| Group | Tables |
|-------|--------|
| Users & Auth | `users`, `user_profiles`, `refresh_tokens` |
| Academic | `boards`, `subjects`, `chapters`, `topics`, `syllabus` |
| Study Tools | `focus_sessions`, `study_tasks`, `flashcards`, `notes`, `documents` |
| AI | `chat_messages`, `quiz_attempts`, `teach_back_submissions`, `mistakes` |
| RPG | `player_profiles`, `rpg_cards`, `rpg_decks`, `rpg_battles`, `wallet_ledger` |
| Economy | `marketplace_listings`, `marketplace_offers`, `card_supply_ledger` |
| Events | `study_passes`, `quests`, `study_events`, `extinction_events` |
| Social | `friendships`, `direct_messages`, `factions`, `rpg_parties` |
| Programme | `programmes`, `programme_objectives`, `learning_paths` |
| Admin | `admin_notes`, `audit_logs`, `game_config` |

Migrations live in `backend/migrations/` and run via `npm run migrate`.

## Realtime

Socket.IO gateways handle:
- Live chat messages
- Realtime quiz (synchronized questions)
- Exam clone (timed sessions)
- Social updates (friend requests, faction scores)
- Battle actions (PvP and party battles)

## AI Pipeline

1. **Upload** → document stored in object storage
2. **Ingest** → PDF parsed, text extracted, pages tracked
3. **Chunk** → text split into overlapping chunks
4. **Embed** → chunks vectorized (Ollama or cloud)
5. **Store** → vectors in Qdrant, metadata in Postgres
6. **Query** → user question → embed → search Qdrant → rerank → cite sources
7. **Answer** → LLM generates response with citations

The pipeline supports any OpenAI-compatible LLM and embedding provider.

## Free-to-Win Design

- **No pay-to-win**: XP, STP, cards, and progression are earned through study only
- **Wellbeing guards**: rest cooldowns, night-rest nudges, overstudy dampening
- **Reward curve**: exponential on accuracy × difficulty, never purchasable
- **Campfire reflection**: mandatory metacognitive check before reward cash-out
- **Subscriptions**: infrastructure only (limits, priority) — never game content

## Documentation

| Doc | Purpose |
|-----|---------|
| [Quick Start](../getting-started/quick-start.md) | Get running in 5 minutes |
| [Configuration](../getting-started/configuration.md) | All environment variables |
| [Deployment](../deployment/hosting.md) | Production setup |
| [Runbooks](../runbooks/) | Backup, restore, load testing |
| [Connector Guide](../guides/connector-guide.md) | Add a new AI module |
