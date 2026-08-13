# Configuration

The **canonical list of variables and defaults lives in `backend/.env.example`** (and
`frontend/.env.example` for the frontend) — copy it to `.env` and fill in values.
Never commit `.env` files. This page groups the variables by concern so you know what
each one is for.

## Backend (`backend/.env`)

### Core runtime

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `development` / `production` / `test` |
| `PORT` | HTTP port the API binds to (default `3000`) |
| `CORS_ORIGINS` | Comma-separated allowed origins for HTTP and Socket.IO CORS |

### Data stores

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL 15 connection string (raw SQL via `pg`) |
| `REDIS_URL` | Redis 7 connection string (cache + BullMQ queues) |
| `QDRANT_URL` | Qdrant vector database (RAG embeddings) |
| `CLICKHOUSE_URL` | ClickHouse (usage analytics) |

### Auth & identity

| Variable | Purpose |
|----------|---------|
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets (long random strings) |
| Firebase vars | Admin SDK credentials for push/identity features |

### AI pipeline

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | OpenAI-compatible LLM access (planner, RAG, teach-back, campfire, exam clone) |

### Media & email

| Variable | Purpose |
|----------|---------|
| AWS S3 vars | File uploads (notes, images, audio) |
| AWS SES vars | Transactional email |

### Payments

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Subscriptions (infrastructure only — never game progression; see Free-to-Win rules) |

## Frontend (`frontend/.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Backend base URL used by the API client (dev proxy otherwise) |

## Validation

The backend validates its environment at boot (Joi schema in `app.module.ts`), so
misconfigured deployments fail fast with a clear message instead of failing at runtime.

## Production

Production values are managed separately from local `.env` files — see the deployment
docs and the platform's environment tooling for the exact mechanism.
