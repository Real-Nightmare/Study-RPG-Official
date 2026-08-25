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

### Data marketplace (Ocean Protocol) — compute-to-data ONLY

> **Owner policy (2026-08-25):** the marketplace is **strictly compute-to-data
> only and off by default** — nothing PII-related is ever for sale, there is
> **no download/access path**, and researcher algorithms run in a
> network-isolated `c2d-runner` container. While `MARKETPLACE_ENABLED=false`
> every `/data-marketplace` endpoint answers 501; the internal AI benchmark
> pipeline keeps working.

Publishes **aggregate statistics only** — the privacy guard (`data-marketplace/privacy-guard.ts`) rejects anything that is not a numeric aggregate over an adequately sized, consenting cohort (checked at field-name AND value level: emails, IPs, phone-like runs, long digit IDs are all blocked). Raw rows, free text and per-user values never leave the module.

| Variable | Purpose |
|----------|---------|
| `MARKETPLACE_ENABLED` | Master switch for the whole marketplace (default `false` → all endpoints 501). The idle-capacity node also requires this |
| `OCEAN_AQUARIUS_URL` | Aquarius metadata-store base URL (default mainnet) — used for DDO re-submission only |
| `OCEAN_PUBLISHER_ADDRESS` | Publisher wallet address (**required to publish**) |
| `OCEAN_PUBLISHER_PRIVATE_KEY` | Publisher wallet private key (**required to publish** — never commit, manage via secrets) |
| `OCEAN_CHAIN_ID` | Chain id embedded in the `did:op` DID (default `137` — Polygon mainnet) |
| `MARKETPLACE_PUBLISH_ENABLED` | Secondary switch for outbound publish calls (default `true`) |
| `MARKETPLACE_MIN_GROUP_SIZE` | Minimum cohort size before an aggregate may be published (default `10`) |
| `MARKETPLACE_CONSENT_THRESHOLD` | Minimum consent coverage 0–1 (default `0.8`) |
| `MARKETPLACE_DATASET_LICENSE` | License string stamped into published DDOs (default `CC-BY-4.0 (aggregate statistics only)`) |
| `MARKETPLACE_AGGREGATE_WINDOW_DAYS` | Snapshot window for published aggregates (default `90`) |

#### Compute-to-Data (C2D) — the ONLY publish path

A dataset is publishable **only** as an on-chain compute asset: an ERC721 data
NFT + ERC20 datatoken (+ a fixed-rate exchange when the dataset has a price)
with a **`compute` service**, so buyers/researchers run algorithms on the
aggregate inside an isolated environment — they can never download it. The
aggregate JSON must be reachable by the node (`R2_PUBLIC_URL`/MinIO public
URL). If anything is missing or fails, **the dataset stays a draft** with
`c2d_error` explaining why — there is deliberately no metadata-only fallback.

| Variable | Purpose |
|----------|---------|
| `OCEAN_NODE_URL` | Ocean Node / provider endpoint used to encrypt files + DDO and to run compute jobs (default `https://compute1.oceanprotocol.com/`) |
| `OCEAN_RPC_URL` | RPC of the chain the assets are deployed on (default `https://polygon-rpc.com` — Polygon mainnet) |
| `OCEAN_ERC721_FACTORY` | ERC721Factory address for the configured chain (default: Ocean's Polygon-mainnet factory) |
| `OCEAN_FIXED_RATE_EXCHANGE` | FixedRateExchange address (default: Ocean's Polygon-mainnet FRE) |
| `OCEAN_TOKEN_ADDRESS` | Ocean (base) token address (default: mOCEAN on Polygon) |
| `OCEAN_C2D_ALLOW_RAW_ALGORITHM` | Allow buyers to submit raw algorithms (default `true` — safe on sanitized aggregates; disable to restrict) |
| `OCEAN_C2D_TRUSTED_ALGORITHM_PUBLISHERS` | Comma-separated allowlist of algorithm publisher addresses (default empty = any published algorithm) |
| `R2_PUBLIC_URL` / `MINIO_PUBLIC_URL` | Public base URL of the object-storage bucket the aggregate is uploaded to (**required for C2D**) |

#### Isolated compute runner + local research harness

The `c2d-runner` compose service executes algorithms with **no outbound
network route** (internal Docker network), a read-only filesystem, non-root
user and hard resource caps — compute jobs additionally have network access
disabled in their on-chain policy (`allowNetworkAccess` is permanently
`false`; requests to enable it are rejected). Researchers test our system
locally via `POST /data-marketplace/datasets/:id/test-compute` (admin): their
algorithm receives the sanitized aggregate as JSON on stdin inside that
container.

| Variable | Purpose |
|----------|---------|
| `C2D_RUNNER_URL` | Base URL of the c2d-runner sidecar (compose default `http://c2d-runner:9000`) |
| `C2D_RUNNER_TIMEOUT_S` | Max wall-clock seconds per research job (default `30`) |

> **Network note (2026)**: the Ocean ecosystem now runs on Ocean Nodes (the same `@oceanprotocol/lib` stack this module uses). Polygon mainnet (chain 137) is supported. The current public mainnet node is `https://compute1.oceanprotocol.com/`.

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
