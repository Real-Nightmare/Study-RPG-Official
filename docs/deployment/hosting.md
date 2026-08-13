# Deployment Guide: Studyield / Study RPG

**Applies to**: PDF Phase 9 (Hardening) ops deliverable — how to run the stack
in production, with the env vars each service needs.

## Architecture at a glance

```
                    ┌─────────────────────────────┐
 Browser ──HTTPS──▶ │  Frontend (static)          │
                    │  Vite build → nginx / CDN   │
                    └──────────────┬──────────────┘
                                   │ /api, /socket.io
                    ┌──────────────▼──────────────┐
                    │  Backend (NestJS, BullMQ)   │
                    └───┬──────┬──────┬──────┬────┘
                        │      │      │      │
                   PostgreSQL  Redis  Qdrant  (Object storage / ClickHouse)
```

- **Frontend**: static build (`frontend/dist`) — host on Cloudflare Pages, a
  CDN + nginx, or any static host. SPA fallback to `index.html` required.
- **Backend**: long-running Node process (Docker recommended). Runs the HTTP
  API **and** the BullMQ workers in one process.
- **PostgreSQL 18**, **Redis 8.10**, **Qdrant**: required. **ClickHouse**: only if
  analytics features are enabled. **Object storage / SMTP / Firebase**: only for
  uploads, email, and FCM push respectively.

## Env vars

Copy `.env.example` (backend) to `.env` and fill in secrets. Key groups:

### Required
| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | BullMQ + caching |
| `QDRANT_URL` | Qdrant gRPC/HTTP endpoint |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Auth tokens (≥ 32 chars, unique per env) |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |

### Governance (Phase 6)
| Var | Purpose |
|-----|---------|
| `NIGHTMARE_ADMIN_USERNAME` / `NIGHTMARE_ADMIN_EMAIL` / `NIGHTMARE_ADMIN_PASSWORD` | Seed the super-admin on first boot (default `123456789` — change it!) |

### Push notifications (Phase 9)
| Var | Purpose |
|-----|---------|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Standards-based Web Push. **Optional** — when absent the subscribe UI is hidden and sends are silent no-ops. Generate: `npx web-push generate-vapid-keys` |
| `FIREBASE_*` | FCM push (primary channel) — optional |

### AI / RAG (Phase 3)
| Var | Purpose |
|-----|---------|
| `OPENROUTER_API_KEY` / `OPENAI_API_KEY` | LLM for AI features |
| `EMBEDDING_PROVIDER` / `EMBEDDING_MODEL` / `EMBEDDING_API_KEY` | Embeddings |
| `RERANKER_PROVIDER` / `RERANKER_MODEL` / `RERANKER_API_KEY` | Optional reranker |
| `QDRANT_COLLECTION_VERSION` | Optional pin for the active vector collection |

### Security (Phase 1)
| Var | Purpose |
|-----|---------|
| `SWAGGER_ENABLED` | Keep `false` in production |
| `CORS_ORIGINS` | Strict allowlist; unknown origins get 403 |

## Deploying

### Option A — Docker Compose (single host)

```bash
docker compose up -d postgres redis qdrant
docker compose up -d --build backend frontend
```

`start.sh` bootstraps a dev environment; for production prefer compose with
tuned env values.

#### SSH debug into the app containers

The backend and frontend images ship with an **always-on** SSH server (port
22 in the container, mapped to `${BACKEND_SSH_PORT:-3022}` and
`${FRONTEND_SSH_PORT:-3222}` on the host) for interactive debugging:

```bash
ssh -i /path/to/id_studyield_debug root@host -p 3022    # backend
ssh -i /path/to/id_studyield_debug root@host -p 3222    # frontend
```

The **public** half of the `studyield-docker-debug` keypair is baked into the
images; the **private** key is never stored in the repo or image (it lives in
the operator's keychain / session). Optional extras set at runtime:

| Var | Purpose |
|-----|---------|
| `SSH_PASSWORD` | Enable root password login
| `SSH_PUBLIC_KEY` | Add an extra root authorized key (also a way to rotate access)

> ⚠️ Debug tool only. Because access is baked in, bind the SSH ports to
> localhost or a VPN (do not expose them publicly), rotate the keypair if it
> leaks (regenerate the key, then set `SSH_PUBLIC_KEY` at runtime or rebuild),
> and consider overriding `/root/.ssh/authorized_keys` via a volume mount on
> production hosts.

### Option B — Backend on a VM + static frontend

```bash
# backend
cd backend && npm ci && npm run build
DATABASE_URL=... REDIS_HOST=... QDRANT_URL=... node dist/main.js

# frontend — build once, serve statically
cd frontend && npm ci && npm run build
# point nginx/Cloudflare Pages at frontend/dist with SPA fallback
```

### Option C — Cloudflare Pages (automatic, zero Worker usage)

The frontend is wired for **automatic Cloudflare Pages deploys**: pushing to
`main` runs `.github/workflows/deploy-frontend-cloudflare.yml`, which builds
`frontend/dist` and uploads it with wrangler.

**Zero Worker invocations by design.** The frontend is deployed as a **pure
static site**: there is no `frontend/functions/` directory and no Worker
script anywhere in the deploy path, so every request is answered straight
from Cloudflare's edge CDN — no Worker compute, no per-request Worker cost.
Three pieces make this work:

1. `frontend/public/_redirects` — SPA fallback (`/* → /index.html 200`),
   a plain edge rule, not a Function.
2. `frontend/public/_headers` — hashed `/assets/*` are cached **immutable
   for 1 year** (browser + edge), while `index.html` and `sw.js` are
   revalidated every load so new deploys propagate immediately. Repeat
   visits therefore hit the browser cache and the CDN — never an origin.
3. `frontend/wrangler.toml` — Pages project config (`pages_build_output_dir
   = "dist"`) for local `wrangler pages deploy`.

The API is **not** proxied through a Worker: the browser calls the NestJS
backend directly, either same-origin via a reverse proxy on the Pages custom
domain or cross-origin with `CORS_ORIGINS` allowlisted.

**GitHub configuration needed once** (repo → Settings → Secrets and
variables → Actions):

| Kind | Name | Purpose |
|------|------|---------|
| Secret | `CLOUDFLARE_API_TOKEN` | API token with **Cloudflare Pages: Edit** permission (create at https://dash.cloudflare.com/profile/api-tokens) |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| Variable | `CLOUDFLARE_PROJECT_NAME` | Pages project name (defaults to `study-rpg`; auto-created on first deploy) |
| Variable | `VITE_API_URL` | **Production API origin** — REQUIRED, e.g. `https://api.study-rpg.com`. Without it the build falls back to `http://localhost:3010` with a workflow warning |

After the first deploy: attach a custom domain in the Cloudflare dashboard,
add that origin to the backend's `CORS_ORIGINS` (or reverse-proxy `/api` and
`/socket.io` on the same domain), and set `VITE_API_URL` to the same origin.

### Database migrations

Migrations run on boot? No — run them explicitly:

```bash
cd backend && npm run migrate   # requires DATABASE_URL; applies backend/migrations/*.sql in order
```

Run migrations **before** starting the new API version. Prefixes are unique and
ordered (current max: `028`).

## Health checks

- `GET /api/health` (or your health endpoint) — process liveness.
- `GET /admin/status` (admin JWT) — DB/Redis/Qdrant health flags, queue stats,
  user/audit/event/faction counts. Use this as the ops pane of glass.

## Backups

Follow `docs/runbooks/backup-restore.md`. Nightly `pg_dump` + off-host copy +
monthly restore test. Qdrant is rebuilt via `POST /rag/reindex` after restore.

## Runbooks

- `docs/runbooks/backup-restore.md` — backups, restore, restore testing
- `docs/runbooks/audit-retention.md` — audit-log retention & export
- `docs/runbooks/load-testing.md` — smoke load tests (`scripts/load-test.mjs`)
