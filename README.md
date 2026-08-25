<p align="center">
  <img src="frontend/public/logos/study-rpg-logo.svg" alt="Study RPG" width="96">
  <h1 align="center">Study RPG</h1>
  <p align="center"><strong>Learn more by doing less, better.</strong></p>
  <p align="center">An open, health-first AI learning platform that treats studying like a game worth playing — mastery over memorisation, depth over length, rest as part of the strategy.</p>
</p>

<p align="center">
  <a href="docs/STUDY_RPG_PHILOSOPHY.md"><img src="https://img.shields.io/badge/philosophy-health--first-16a34a" alt="Philosophy"></a>
  <a href="docs/architecture/overview.md"><img src="https://img.shields.io/badge/docs-architecture-2563eb" alt="Docs"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License"></a>
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

## Core ideas

- **Health first.** Anti-overstudy dampening cuts rewards as you push past a
  healthy daily load, gates new focus sessions during rest cooldowns, and
  steers late-night crammers toward sleep. Real study is still rewarded;
  grinding is heavily dampened.
- **Mastery over memorisation.** Teach-back evaluation (explain it to the AI),
  multi-agent problem solving, deep research, and metacognitive "campfire"
  check-ins verify understanding instead of rewarding recall.
- **Free-to-win integrity.** An exponential reward curve, anti-cheese guards,
  and a fully audited in-game economy keep the game honest.
- **Privacy-first data economy.** The platform never sells personal data. With
  your explicit consent, only **anonymised numeric aggregates** may be used —
  and even those are compute-to-data only: outside researchers run their
  algorithms on the aggregate inside an isolated container; nobody can buy or
  download the underlying data, and nothing PII-shaped ever passes the guard.

## Capabilities

### AI study tools
- **Exam Clone** — upload past exams; generate new practice questions in the same style and difficulty.
- **Multi-Agent Problem Solver** — analysis, solver, and verifier agents collaborate with real-time streaming.
- **Teach-Back Evaluation** — explain concepts in your own words (text or voice); an AI evaluates depth using the Feynman technique.
- **Deep Research** — RAG over your uploaded materials plus web search, with structured, cited reports.
- **Knowledge Base & RAG** — ingest PDFs/docs, semantic + lexical hybrid search with an optional reranker.
- **Code Sandbox** — secure Python execution with scientific libraries.
- **AI quizzes & SRS flashcards** — generated from your own materials, with cloze and image-occlusion cards.
- **RAG chat** — conversational AI with citations from your documents.

### Study tools
- Focus sessions with a study-health meter and rest-cooldown gates.
- Mistake notebook with cause/resolve lifecycle.
- Subject puzzles with streaks and shields.
- Exam periods, results, and revision planning.
- Academic structure (subjects, chapters, topics, learning objectives).
- Learning paths, study events, quests, and a live dashboard summary.

### The RPG layer
- Config-driven player stats, XP, levels, and an immutable STP/SLC wallet ledger.
- Original data-driven cards with restricted decks and a deterministic, server-authoritative battle engine (replayable logs).
- PvP duels with Elo ratings, faction systems, and party battles.
- Events (StudyPass, quests, limited-time card events), a card economy with supply-tied value, and a fair marketplace.
- **Campfire** — the AI asks one targeted synthesis question before you cash in rewards; depth grading is verified, not guessed.

### Data marketplace (Ocean Protocol) — compute-to-data ONLY
- **The marketplace is OFF by default** (`MARKETPLACE_ENABLED=false`): every
  endpoint answers 501 and nothing ever leaves the platform. The internal AI
  benchmarking pipeline keeps working.
- **Strictly no PII for sale.** Only privacy-guarded numeric aggregates over
  explicitly consenting students may ever be published — checked twice (field
  names AND values). There is deliberately **no download/access path**: a
  dataset is publishable only as an on-chain **Compute-to-Data** asset
  (Polygon mainnet: data NFT + datatoken + fixed-rate exchange + `compute`
  service), and if that fails the dataset simply stays a draft.
- **Isolated research environment.** Researcher algorithms run inside the
  `c2d-runner` container — no outbound network route, read-only filesystem,
  non-root, hard memory/CPU/PID caps — both locally (admin "test-compute"
  harness) and in production compute jobs. Compute jobs never get network
  access.
- Admin AI benchmarking pipeline that scores how much studying with Study RPG
  improves outcomes — from your own anonymised cohort data.

## Tech stack

| Layer | Technology |
|-------|------------|
| Backend | NestJS 10, TypeScript, PostgreSQL (raw SQL), Redis, Qdrant, ClickHouse, BullMQ, Socket.IO |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Radix UI, Zustand, TanStack Query, i18next (15 locales) |
| AI | Local Ollama by default (OpenAI-compatible API); OpenRouter/OpenAI optional upgrades |
| Web3 | Ocean Protocol (`@oceanprotocol/lib`, ethers v6) — Polygon mainnet defaults, strictly opt-in |
| Infra | Docker Compose (postgres, redis, qdrant, clickhouse, ollama, searxng, mailpit, minio, c2d-runner), Nginx, GitHub Actions CI |

## Quick start — fully local, zero accounts

Everything runs on your machine: local LLM (Ollama), local web search
(SearXNG), local email sink (Mailpit), local object storage (MinIO) and a
network-isolated code/compute runner. No API keys, no credit card.

```bash
git clone https://github.com/Real-Nightmare/Study-RPG-Official.git
cd Study-RPG-Official
docker compose --env-file .env.docker up -d   # start every service
sh scripts/bootstrap.sh                       # wait healthy → migrate → pull models
open http://localhost:5189                    # register a username and play
```

First run pulls the Ollama models (~4.5 GB, cached afterwards).

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5189 |
| API | http://localhost:3010/api/v1 |
| Mailpit UI (dev email) | http://localhost:8025 |
| MinIO console | http://localhost:9001 (`studyrpg` / `studyrpg-secret`) |
| Ollama API | http://localhost:11434 |
| SearXNG | http://localhost:8888 |

Optional hosted upgrades (all off by default): `OPENROUTER_API_KEY`,
AWS SES (`EMAIL_TRANSPORT=ses`), Stripe (`BILLING_ENABLED=true`),
on-chain C2D publishing (`MARKETPLACE_ENABLED=true` + wallet env vars).
See `backend/.env.example` for every variable.

### Manual

```bash
# Backend
cd backend && cp .env.example .env && npm install && npm run migrate && npm run start:dev

# Frontend (second terminal)
cd frontend && npm install && npm run dev
```

### One-command dev

```bash
./start.sh
```

## Documentation

- [Philosophy](docs/STUDY_RPG_PHILOSOPHY.md) — the design principles every AI surface follows.
- [Architecture overview](docs/architecture/overview.md)
- [Getting started](docs/getting-started/) — quick-start and configuration (incl. Ocean marketplace env vars).
- [Deployment](docs/deployment/hosting.md) — Docker, self-hosting, Cloudflare.
- [Runbooks](docs/runbooks/) — backup/restore, audit retention, load testing.
- [Audits](docs/audits/) — repository, licence, and upstream-file inventories.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md). Checks that must pass:

```bash
# Backend
cd backend && npm run build && npm run lint && npm test

# Frontend
cd frontend && npm run build && npm run lint && npm test
```

## Security

Report vulnerabilities privately — see [SECURITY.md](SECURITY.md).

## License

Licensed under the [GNU Affero General Public License v3.0](LICENSE).
Third-party component notices live in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md),
and upstream provenance is documented in [UPSTREAM.md](UPSTREAM.md) and
[docs/audits/UPSTREAM_FILE_INVENTORY.md](docs/audits/UPSTREAM_FILE_INVENTORY.md).
