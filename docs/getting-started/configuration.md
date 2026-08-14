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

### Data marketplace (Ocean Protocol)

Publishes **aggregate statistics only** — the privacy guard (`data-marketplace/privacy-guard.ts`) rejects anything that is not a numeric aggregate over an adequately sized, consenting cohort. Raw rows, free text and per-user values never leave the module.

| Variable | Purpose |
|----------|---------|
| `OCEAN_AQUARIUS_URL` | Aquarius metadata-store base URL (default mainnet) — DDOs are POSTed to `<url>/api/aquarius/assets/ddo` |
| `OCEAN_PUBLISHER_ADDRESS` | Publisher wallet address (optional for metadata-first publish) |
| `OCEAN_PUBLISHER_PRIVATE_KEY` | Publisher wallet private key (optional; required for the on-chain datatoken step — never commit, manage via secrets) |
| `OCEAN_CHAIN_ID` | Chain id embedded in the `did:op` DID (default `1`) |
| `MARKETPLACE_PUBLISH_ENABLED` | Master switch for outbound publish calls (default `true`) |
| `MARKETPLACE_MIN_GROUP_SIZE` | Minimum cohort size before an aggregate may be published (default `10`) |
| `MARKETPLACE_CONSENT_THRESHOLD` | Minimum consent coverage 0–1 (default `0.8`) |
| `MARKETPLACE_DATASET_LICENSE` | License string stamped into published DDOs (default `CC-BY-4.0 (aggregate statistics only)`) |
| `MARKETPLACE_AGGREGATE_WINDOW_DAYS` | Snapshot window for published aggregates (default `90`) |

#### Idle-capacity Ocean Node (optional)

When the server is fully idle (no active users for the idle window), the monitor can start an official `oceanprotocol/ocean-node` container that earns provider fees on the Ocean network; it stops the moment any user appears. Opt-in and best-effort — without docker or a node wallet key it simply logs and stays off.

| Variable | Purpose |
|----------|---------|
| `OCEAN_NODE_ENABLED` | Master switch for the idle-capacity node (default `false`) |
| `OCEAN_NODE_PRIVATE_KEY` | Node operator wallet private key (0x…) — required to start, never commit |
| `OCEAN_NODE_RPC_URLS` | JSON map of chainId → RPC URL for payment settlement, e.g. `{"1":"https://eth.llamarpc.com"}` |
| `OCEAN_NODE_IDLE_WINDOW_MIN` | How long the server must be fully idle before the node starts (default `10`) |
| `OCEAN_NODE_COOLDOWN_MIN` | Cooldown after a stop before the node may start again (default `60`) |
| `OCEAN_NODE_MAX_STARTS_PER_DAY` | Hard cap on node starts per rolling 24h (default `3`) |
| `OCEAN_NODE_CHECK_INTERVAL_S` | Idle-monitor sampling interval in seconds (default `60`) |
| `OCEAN_NODE_IMAGE` / `OCEAN_NODE_CONTAINER_NAME` | Docker image (default `oceanprotocol/ocean-node:latest`) and container name |
| `OCEAN_NODE_HTTP_API_PORT` / `OCEAN_NODE_P2P_PORT` | Host ports mapped to the container's 8000/9000 (defaults `8000` / `9000`) |
| `OCEAN_NODE_DOCKER_BINARY` | Docker binary path (default `docker`) |

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
