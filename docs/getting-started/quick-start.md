# Quick Start

Study RPG (formerly Studyield) is a gamified AI learning platform. This guide gets the
full stack running locally in a few minutes.

> The canonical project philosophy is in [`STUDY_RPG_PHILOSOPHY.md`](../../STUDY_RPG_PHILOSOPHY.md).
> Everything in the product — rewards, AI voice, UI copy — is built to honor it: study first,
> game second, and a 100% Free-to-Win meritocracy where real intellectual effort is the only currency.

## Repository layout

| Path | What it is |
|------|------------|
| `backend/` | NestJS 10 API (TypeScript, raw SQL via `pg`, custom migration runner) |
| `frontend/` | React 19 + Vite + Tailwind + Radix UI (15 locales, Zustand, TanStack Query, Socket.IO client) |
| `specs/` | Spec Kit features (`spec.md` → `plan.md` → `tasks.md`), one per numbered feature |
| `docs/` | Architecture, deployment, runbooks, this guide |
| `docker-compose.yml` | Postgres 15, Redis 7, Qdrant, ClickHouse, backend, frontend/nginx |

There is **no root `package.json`** — the two packages install and run independently.

## Prerequisites

- Node.js 20+ and npm
- Docker (for Postgres, Redis, Qdrant, ClickHouse) or reachable remote instances
- AI API key (e.g. OpenRouter) for the AI features — everything else works without it

## 1. Start the infrastructure

```bash
docker compose up -d postgres redis qdrant clickhouse
```

If you prefer not to run the full stack, `./start.sh` bootstraps the dev environment.

## 2. Backend

```bash
cd backend
cp .env.example .env        # then fill in values (see configuration.md)
npm ci
npm run migrate             # applies backend/migrations/*.sql in order
npm run start:dev           # http://localhost:3000
```

## 3. Frontend

```bash
cd frontend
npm ci
npm run dev                 # Vite dev server (proxies /api to the backend)
```

## Verification

```bash
# Backend
cd backend && npm run build     # nest build
cd backend && npm run lint      # eslint
cd backend && npm test          # jest (use `npx jest --runInBand` in constrained workspaces)
cd backend && npm run test:cov  # jest with coverage

# Frontend
cd frontend && npm run build    # tsc -b && vite build
cd frontend && npm run lint     # eslint (jsx-a11y included)
cd frontend && npm test         # vitest
```

## Where to look next

- [`configuration.md`](./configuration.md) — environment variables
- [`../architecture/overview.md`](../architecture/overview.md) — system design
- [`../guides/connector-guide.md`](../guides/connector-guide.md) — adding a new AI core-tool module
- [`../../docs/runbooks/`](../runbooks/) — backup, restore, audit retention, load testing
