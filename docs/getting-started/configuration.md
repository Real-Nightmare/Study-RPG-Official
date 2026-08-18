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
| `OCEAN_PUBLISHER_PRIVATE_KEY` | Publisher wallet private key (optional for metadata-first; **required for on-chain Compute-to-Data** — never commit, manage via secrets) |
| `OCEAN_CHAIN_ID` | Chain id embedded in the `did:op` DID (default `137` — Polygon mainnet) |
| `MARKETPLACE_PUBLISH_ENABLED` | Master switch for outbound publish calls (default `true`) |
| `MARKETPLACE_MIN_GROUP_SIZE` | Minimum cohort size before an aggregate may be published (default `10`) |
| `MARKETPLACE_CONSENT_THRESHOLD` | Minimum consent coverage 0–1 (default `0.8`) |
| `MARKETPLACE_DATASET_LICENSE` | License string stamped into published DDOs (default `CC-BY-4.0 (aggregate statistics only)`) |
| `MARKETPLACE_AGGREGATE_WINDOW_DAYS` | Snapshot window for published aggregates (default `90`) |

#### Compute-to-Data (C2D) — on-chain publishing (optional)

When a funded wallet, an RPC URL and an Ocean Node are configured, publishing a dataset deploys a real on-chain asset — an ERC721 data NFT + ERC20 datatoken (+ a fixed-rate exchange when the dataset has a price) — and registers a **`compute` service**, so buyers can run algorithms on the aggregate instead of downloading it. The aggregate JSON is uploaded to R2 first, so `R2_PUBLIC_URL` must be set for the node to reach it. Anything missing or failing falls back to metadata-first publishing (the dataset still becomes discoverable).

| Variable | Purpose |
|----------|---------|
| `OCEAN_NODE_URL` | Ocean Node / provider endpoint used to encrypt files + DDO and to run compute jobs (default `https://compute1.oceanprotocol.com/`) |
| `OCEAN_RPC_URL` | RPC of the chain the assets are deployed on (default `https://polygon-rpc.com` — Polygon mainnet, where the owner holds MATIC) |
| `OCEAN_ERC721_FACTORY` | ERC721Factory address for the configured chain (default: Ocean's Polygon-mainnet factory) |
| `OCEAN_FIXED_RATE_EXCHANGE` | FixedRateExchange address (default: Ocean's Polygon-mainnet FRE) |
| `OCEAN_TOKEN_ADDRESS` | Ocean (base) token address (default: mOCEAN on Polygon) |
| `OCEAN_C2D_ALLOW_RAW_ALGORITHM` | Allow buyers to submit raw algorithms (default `true` — safe on sanitized aggregates; disable to restrict) |
| `OCEAN_C2D_ALLOW_NETWORK_ACCESS` | Allow compute jobs internet access (default `false` — blocks exfiltration) |
| `OCEAN_C2D_TRUSTED_ALGORITHM_PUBLISHERS` | Comma-separated allowlist of algorithm publisher addresses (default empty = any published algorithm) |
| `R2_PUBLIC_URL` | **Required for C2D** — public base URL of the R2 bucket the aggregate is uploaded to |

> **Network note (2026)**: the Ocean ecosystem now runs on Ocean Nodes (the same `@oceanprotocol/lib` stack this module uses). Polygon mainnet (chain 137) is supported — 2 MATIC is enough gas for dozens of publishes. The current public mainnet node is `https://compute1.oceanprotocol.com/`; the legacy `aquarius.mainnet.oceanprotocol.com` endpoint is retired, so metadata-first DDOs are recorded as drafts for manual/CLI export.

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
