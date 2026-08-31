<p align="center">
  <img src="frontend/public/logos/study-rpg-logo.svg" alt="Study RPG" width="96">
  <h1 align="center">Study RPG</h1>
  <p align="center"><strong>Learn more by doing less, better.</strong></p>
  <p align="center">An open, health-first AI learning platform that treats studying like a game worth playing — mastery over memorisation, depth over length, rest as part of the strategy.</p>
</p>

<p align="center">
  <a href="docs/STUDY_RPG_PHILOSOPHY.md"><img src="https://img.shields.io/badge/philosophy-health--first-16a34a" alt="Philosophy"></a>
  <a href="docs/architecture/overview.md"><img src="https://img.shields.io/badge/docs-architecture-2563eb" alt="Docs"></a>
  <a href="docs/PRD_v1.0_GA.md"><img src="https://img.shields.io/badge/PRD-v1.0_GA-7c3aed" alt="PRD"></a>
</p>

---

## What is Study RPG?

Study RPG is an AI-powered learning platform built on a simple premise: the
best study plan is the one you can actually sustain. It combines serious study
tools (exam practice, spaced-repetition flashcards, knowledge bases, AI
tutoring) with a fair, integrity-first RPG layer — and an anti-overstudy
guardian that makes *stopping* part of the game.

The platform is intentionally **free to win**: real academic achievement is
the only way to earn premium rewards. No pay-to-win, no grinding rewarded,
no "study more" pressure — smarter studying is the whole point.

**Everything runs locally.** One command boots the entire stack — AI, search,
email, storage, code execution — no API keys, no credit cards, no cloud accounts required.

---

## Quick Start

### One command (recommended)

```bash
git clone https://github.com/Real-Nightmare/Study-RPG-Official.git
cd Study-RPG-Official
sh scripts/bootstrap.sh
```

This will:
1. Start all Docker services (PostgreSQL, Redis, Qdrant, ClickHouse, Ollama, MinIO, Mailpit, SearXNG, code-runner)
2. Wait for services to be healthy
3. Pull AI models (~4.5 GB on first run)
4. Create storage buckets
5. Run database migrations
6. Print the URLs

### Manual start

```bash
git clone https://github.com/Real-Nightmare/Study-RPG-Official.git
cd Study-RPG-Official
docker compose up -d
# Wait 2-3 minutes for first-time model pull, then:
open http://localhost:8080
```

### First run

1. Open **http://localhost:8080** in your browser
2. Register a new account (username + password, no email required)
3. You're in — dashboard, study tools, RPG, battles, everything works

---

## Ports & Services

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:8080 | Study RPG web app |
| **Backend API** | http://localhost:3010 | NestJS API |
| **Mail UI** | http://localhost:8025 | Password reset emails (Mailpit) |
| **MinIO Console** | http://localhost:9001 | File storage browser |
| **Ollama** | http://localhost:11434 | Local LLM API |
| **SearXNG** | http://localhost:8888 | Local web search |

---

## What Runs Locally (Zero External Dependencies)

| Capability | Local Service | Replaces |
|-----------|--------------|----------|
| **AI Chat/Grading** | Ollama (qwen2.5:7b) | OpenRouter/OpenAI |
| **Embeddings** | Ollama (nomic-embed-text) | text-embedding-3-small |
| **Web Search** | SearXNG | Tavily/Serper |
| **Email** | Mailpit (SMTP) | AWS SES |
| **File Storage** | MinIO (S3-compatible) | Cloudflare R2 |
| **Code Execution** | Local code-runner | External sandbox |

All of these run from `docker compose up` — no accounts, no keys, no credit cards.

---

## Optional Upgrades

Want better AI, cloud email, or other features? Add these to your `.env`:

```bash
# Better AI models (Claude, GPT-4, etc.)
OPENROUTER_API_KEY=sk-or-v1-your-key-here
AI_PROVIDER=openrouter
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-sonnet

# Production email (AWS SES)
EMAIL_TRANSPORT=ses
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# Stripe billing (infrastructure tiers only — never game currency)
BILLING_ENABLED=true
STRIPE_SECRET_KEY=sk_test_your-key

# Ocean Protocol data marketplace
MARKETPLACE_ENABLED=true
```

---

## Storage Providers

Switch storage backends by setting `STORAGE_PROVIDER` in `.env`:

| Provider | Free Tier | Credit Card? | Setup |
|----------|-----------|--------------|-------|
| **MinIO** (default) | Unlimited (your disk) | No | Zero-config |
| **Supabase Storage** | 1 GB | No | Set `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` |
| **Cloudinary** | ~25 GB bandwidth/mo | No | Set `CLOUDINARY_CLOUD_NAME` + keys |
| **Appwrite Storage** | 2 GB | No | Set `APPWRITE_ENDPOINT` + keys |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Study RPG Stack                          │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React 19 + Vite + Tailwind + shadcn)            │
├─────────────────────────────────────────────────────────────┤
│  Backend (NestJS 10 + Socket.IO + raw SQL)                  │
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬───────────┤
│ PgSQL│ Redis│Qdrant│Click │Ollama│MinIO │Mail  │SearXNG   │
│      │      │      │House │  LLM │Store │Pit   │Search     │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴───────────┘
```

See [docs/architecture/overview.md](docs/architecture/overview.md) for the full system design.

---

## Documentation

- [Philosophy](docs/STUDY_RPG_PHILOSOPHY.md) — design principles
- [Architecture](docs/architecture/overview.md) — system design
- [PRD v1.0](docs/PRD_v1.0_GA.md) — product requirements
- [Completion Plan](docs/COMPLETION_PLAN.md) — full build-out roadmap
- [Getting Started](docs/getting-started/) — configuration guide
- [Deployment](docs/deployment/hosting.md) — Docker, self-hosting
- [Runbooks](docs/runbooks/) — backup, audit, load testing

---

## Development

```bash
# Backend
cd backend && npm install && npm run migrate && npm run start:dev

# Frontend (second terminal)
cd frontend && npm install && npm run dev
```

### Checks

```bash
# Backend
cd backend && npm run build && npm run lint && npm test

# Frontend
cd frontend && npm run build && npm run lint && npm test
```

---

## Troubleshooting

**Ollama models won't pull:**
```bash
docker compose exec ollama ollama pull qwen2.5:7b-instruct
```

**Port conflict:**
```bash
# Change ports in .env
FRONTEND_PORT=8081
BACKEND_PORT=3011
```

**Apple Silicon (M1/M2/M3):**
Ollama runs natively on ARM — no special config needed.

**Backend won't start:**
```bash
docker compose logs backend | tail -50
```

---

## Security

Report vulnerabilities privately — see [SECURITY.md](SECURITY.md).

---

## License

Licensed under the [GNU Affero General Public License v3.0](LICENSE).
Third-party component notices live in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
