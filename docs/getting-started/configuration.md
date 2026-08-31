# Configuration Reference

Everything works out of the box with Docker defaults. This page documents every environment variable for when you want to customize something.

## Backend Variables

All backend variables go in `backend/.env` (copy from `backend/.env.example`). The backend validates its config at boot — misconfigured values fail fast with a clear error.

### Core

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `development` | `development`, `production`, or `test` |
| `PORT` | `3000` | HTTP port |
| `CORS_ORIGINS` | `http://localhost:5189` | Allowed frontend origins (comma-separated) |

### Database

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://studyrpg:studyrpg@postgres:5432/studyrpg` | PostgreSQL connection string |

### Cache & Queues

| Variable | Default | Purpose |
|----------|---------|---------|
| `REDIS_HOST` | `redis` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | *(empty)* | Redis password |

### Vector Search

| Variable | Default | Purpose |
|----------|---------|---------|
| `QDRANT_URL` | `http://qdrant:6333` | Qdrant vector database endpoint |
| `QDRANT_COLLECTION_VERSION` | *(auto)* | Pin a specific vector collection version |

### Analytics

| Variable | Default | Purpose |
|----------|---------|---------|
| `CLICKHOUSE_URL` | `http://clickhouse:8123` | ClickHouse analytics endpoint |

### Auth

| Variable | Default | Purpose |
|----------|---------|---------|
| `JWT_ACCESS_SECRET` | *(must set)* | Access token signing secret (≥32 chars) |
| `JWT_REFRESH_SECRET` | *(must set)* | Refresh token signing secret (≥32 chars) |
| `NIGHTMARE_ADMIN_USERNAME` | `nightmare` | Super-admin username (seeded on first boot) |
| `NIGHTMARE_ADMIN_PASSWORD` | `123456789` | Super-admin password — **change in production!** |

### AI — Choose Your Provider

The AI service supports any OpenAI-compatible endpoint. Pick one:

#### Option A: Ollama (default, zero-config)

No configuration needed. Ollama runs in Docker and is pre-configured.

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_PROVIDER` | `openai-compatible` | Use OpenAI-compatible API mode |
| `OPENAI_BASE_URL` | `http://ollama:11434/v1` | Ollama's OpenAI-compatible endpoint |
| `OPENAI_MODEL` | `qwen2.5:7b` | Chat model |
| `EMBEDDING_PROVIDER` | `ollama` | Use Ollama for embeddings |
| `EMBEDDING_MODEL` | `nomic-embed-text` | Embedding model |

#### Option B: Cloud AI (OpenRouter, Groq, Together, etc.)

| Variable | Purpose |
|----------|---------|
| `AI_PROVIDER` | `openrouter` or `openai-compatible` |
| `OPENROUTER_API_KEY` | Your API key |
| `OPENROUTER_MODEL` | e.g. `anthropic/claude-3-haiku` |
| `OPENAI_BASE_URL` | Set to the provider's API base URL |
| `OPENAI_API_KEY` | Your API key |
| `OPENAI_MODEL` | e.g. `gpt-4o-mini` |

Any OpenAI-compatible provider works: Groq, Together AI, Fireworks, Deepseek, Mistral, etc. Just set `OPENAI_BASE_URL` and `OPENAI_API_KEY`.

#### Reranker (optional)

| Variable | Default | Purpose |
|----------|---------|---------|
| `RERANKER_PROVIDER` | `ollama` | Reranker provider |
| `RERANKER_MODEL` | *(none)* | Reranker model name |

### Email

#### Default: Mailpit (local dev)

No configuration needed. All emails land in the Mailpit web UI at http://localhost:8025.

#### Production: SMTP or SES

| Variable | Default | Purpose |
|----------|---------|---------|
| `EMAIL_TRANSPORT` | `smtp` | `smtp` for Mailpit/SMTP, `ses` for AWS SES |
| `SMTP_HOST` | `mailpit` | SMTP server host |
| `SMTP_PORT` | `1025` | SMTP server port |
| `SMTP_USER` | *(empty)* | SMTP username |
| `SMTP_PASS` | *(empty)* | SMTP password |
| `SMTP_FROM` | `noreply@studyrpg.app` | Sender email address |
| `AWS_SES_REGION` | `us-east-1` | AWS region (if using SES) |

### File Storage

#### Default: MinIO (local dev)

No configuration needed. MinIO runs in Docker with auto-created buckets.

#### Other Providers

| Variable | Default | Purpose |
|----------|---------|---------|
| `STORAGE_PROVIDER` | `minio` | `minio`, `r2`, `supabase`, `cloudinary`, or `appwrite` |
| `STORAGE_BUCKET` | `studyrpg-uploads` | Bucket/container name |

##### MinIO (self-hosted, default)

| Variable | Default | Purpose |
|----------|---------|---------|
| `MINIO_ENDPOINT` | `http://minio:9000` | MinIO endpoint |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO secret key |
| `MINIO_PUBLIC_URL` | `http://localhost:9001` | Public URL for downloads |

##### Cloudflare R2

| Variable | Purpose |
|----------|---------|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET` | R2 bucket name |
| `R2_PUBLIC_URL` | Public URL for the bucket |

##### Supabase Storage (free, 1 GB)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon/service key |
| `SUPABASE_BUCKET` | Storage bucket name |

##### Cloudinary (free, ~25 GB bandwidth)

| Variable | Purpose |
|----------|---------|
| `CLOUDINARY_CLOUD_NAME` | Cloud name |
| `CLOUDINARY_API_KEY` | API key |
| `CLOUDINARY_API_SECRET` | API secret |
| `CLOUDINARY_FOLDER` | Upload folder |

##### Appwrite Storage (free, 2 GB)

| Variable | Purpose |
|----------|---------|
| `APPWRITE_ENDPOINT` | Appwrite endpoint |
| `APPWRITE_PROJECT_ID` | Project ID |
| `APPWRITE_API_KEY` | API key |
| `APPWRITE_BUCKET_ID` | Bucket ID |

### Web Search

#### Default: SearXNG (local dev)

No configuration needed. SearXNG runs in Docker.

| Variable | Default | Purpose |
|----------|---------|---------|
| `SEARCH_PROVIDER` | `searxng` | Search provider |
| `SEARXNG_URL` | `http://searxng:8080` | SearXNG endpoint |

### Web Push Notifications

VAPID keys are auto-generated on first boot. No configuration needed.

| Variable | Default | Purpose |
|----------|---------|---------|
| `VAPID_PUBLIC_KEY` | *(auto-generated)* | Web push public key |
| `VAPID_PRIVATE_KEY` | *(auto-generated)* | Web push private key |
| `VAPID_SUBJECT` | `mailto:admin@studyrpg.app` | Push notification contact |

### Code Execution

#### Default: Local code-runner (sandboxed)

No configuration needed. Runs in a network-isolated Docker container.

| Variable | Default | Purpose |
|----------|---------|---------|
| `CODE_RUNNER_URL` | `http://code-runner:9000` | Code execution endpoint |

### Payments (disabled by default)

| Variable | Default | Purpose |
|----------|---------|---------|
| `BILLING_ENABLED` | `false` | Enable Stripe billing |
| `STRIPE_SECRET_KEY` | *(none)* | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | *(none)* | Stripe webhook secret |

When disabled, the app uses generous static plan limits. No checkout routes are mounted.

### Data Marketplace (disabled by default)

| Variable | Default | Purpose |
|----------|---------|---------|
| `MARKETPLACE_ENABLED` | `false` | Enable Ocean Protocol data marketplace |
| `OCEAN_AQUARIUS_URL` | *(mainnet)* | Aquarius metadata store |
| `OCEAN_PUBLISHER_ADDRESS` | *(none)* | Publisher wallet address |
| `OCEAN_PUBLISHER_PRIVATE_KEY` | *(none)* | Publisher wallet private key |
| `OCEAN_CHAIN_ID` | `137` | Polygon mainnet |

When disabled, marketplace endpoints return 501. No wallet or funds needed.

## Frontend Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | *(proxied in dev)* | Backend API URL for production builds |

In development, Vite proxies `/api` to the backend automatically — no frontend config needed.

## Docker Compose Defaults

The `docker-compose.yml` ships with sensible defaults for local development. Key service settings:

| Service | Image | Default Config |
|---------|-------|---------------|
| PostgreSQL | `postgres:15-alpine` | User: `studyrpg`, Pass: `studyrpg`, DB: `studyrpg` |
| Redis | `redis:7-alpine` | No password |
| Qdrant | `qdrant/qdrant` | Default config |
| ClickHouse | `clickhouse/clickhouse-server` | Default config |
| Ollama | `ollama/ollama` | Auto-pulls `qwen2.5:7b` + `nomic-embed-text` |
| MinIO | `minio/minio` | Access: `minioadmin`, Secret: `minioadmin` |
| Mailpit | `axllent/mailpit` | SMTP: 1025, UI: 8025 |
| SearXNG | `searxng/searxng` | JSON API enabled |
| Code Runner | Local Dockerfile | Network-isolated, CPU/mem capped |

All secrets above are development defaults — **change them for production**.
