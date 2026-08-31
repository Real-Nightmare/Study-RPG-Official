# Quick Start — Get Study RPG Running in 5 Minutes

Study RPG is a gamified AI learning platform. Everything runs locally with Docker — no API keys, no cloud accounts, no credit cards needed.

## One-Command Start

```bash
git clone https://github.com/Real-Nightmare/Study-RPG-Official.git
cd Study-RPG-Official
sh scripts/bootstrap.sh
```

Open **http://localhost:8080** and you're in.

## What Happens on First Boot

The bootstrap script:
1. Starts all services (Postgres, Redis, Qdrant, ClickHouse, Ollama, MinIO, Mailpit, SearXNG)
2. Waits for health checks to pass
3. Pulls AI models (~4.5 GB one-time download): `qwen2.5:7b` (chat) + `nomic-embed-text` (embeddings)
4. Runs database migrations
5. Seeds CBSE Grade 9 curriculum, game config, and a demo admin account
6. Creates storage buckets

## Ports

| Port | Service | What's There |
|------|---------|-------------|
| 8080 | Frontend | The web app |
| 3000 | Backend API | REST + Socket.IO |
| 8025 | Mailpit | Email inbox UI (password resets land here) |
| 9001 | MinIO Console | File storage browser |
| 11434 | Ollama | Local AI (OpenAI-compatible API) |
| 5432 | PostgreSQL | Database |
| 6379 | Redis | Cache + queues |
| 6333 | Qdrant | Vector search |
| 8123 | ClickHouse | Analytics |

## First-Time Login

1. Open **http://localhost:8080**
2. Click **Sign Up** — create a username (email is optional)
3. Or use the seeded admin:
   - Username: `nightmare`
   - Password: `123456789`

## What Works Immediately (Zero Config)

- ✅ User registration and login (username-only, no email required)
- ✅ AI chat with your uploaded notes (Ollama runs locally)
- ✅ Focus sessions with Campfire reflections
- ✅ AI-generated quizzes and teach-back scoring
- ✅ RPG progression, card battles, deck building
- ✅ File uploads (MinIO — local S3-compatible storage)
- ✅ Marketplace, economy, events, factions
- ✅ Realtime chat and social features
- ✅ Password reset emails (visible in Mailpit at :8025)
- ✅ Browser push notifications (auto-generated VAPID keys)

## What's Optional (Add Your Own Keys)

You can upgrade any of these later — the defaults work fine without them:

| Feature | Default | Upgrade To |
|---------|---------|-----------|
| **AI Quality** | Ollama (local, free) | OpenRouter or any OpenAI-compatible cloud API |
| **Search** | SearXNG (local, free) | Any search API |
| **Storage** | MinIO (local, unlimited) | Supabase / Cloudinary / Appwrite (free tiers) |
| **Email** | Mailpit (local, dev only) | AWS SES or any SMTP server |
| **Code Execution** | Local code-runner (sandboxed) | E2B (cloud sandbox) |
| **Payments** | Disabled | Stripe (infrastructure tiers only) |
| **Data Marketplace** | Disabled | Ocean Protocol (Polygon mainnet) |

See [configuration.md](./configuration.md) for all environment variables.

## Backend Development (Without Docker)

If you prefer to run services individually:

```bash
# Start just the databases
docker compose up -d postgres redis qdrant clickhouse ollama

# Backend
cd backend
npm ci
cp .env.example .env        # edit with your values
npm run migrate
npm run start:dev           # http://localhost:3000

# Frontend (separate terminal)
cd frontend
npm ci
npm run dev                 # http://localhost:5189
```

## Verification

```bash
# Backend builds and tests pass
cd backend && npm run build && npm test

# Frontend builds and tests pass
cd frontend && npm run build && npm test
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `docker compose up` fails on port | Check if another service uses the port: `lsof -i :8080` |
| Ollama model pull is slow | First pull downloads ~4.5 GB. Subsequent starts are instant. |
| AI responses are slow | Ollama runs on CPU by default. For GPU: install CUDA and Ollama auto-detects it. |
| Email not arriving | Check Mailpit UI at http://localhost:8025 — all SMTP goes there in dev mode |
| Uploads fail | Check MinIO is running: `docker compose ps minio`. Console at http://localhost:9001 |

## Next Steps

- [Configuration reference](./configuration.md) — all environment variables
- [Architecture overview](../architecture/overview.md) — how the system works
- [Deployment guide](../deployment/hosting.md) — production setup
