# Deployment Guide: Study RPG

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
ssh -i /path/to/id_studyrpg_debug root@host -p 3022    # backend
ssh -i /path/to/id_studyrpg_debug root@host -p 3222    # frontend
```

The **public** half of the `studyrpg-docker-debug` keypair is baked into the
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

### Option C — Cloudflare Pages (automatic, free static serving)

The frontend is wired for **automatic Cloudflare Pages deploys**: pushing to
`main` runs `.github/workflows/deploy-frontend-cloudflare.yml`, which builds
`frontend/dist` and uploads it with wrangler.

**How Cloudflare billing works for this setup.** Static asset requests on
Pages are **free and unlimited** on every plan — the 100k/day Workers free
tier is a shared pool for **Workers + Pages Functions only**, and static
asset requests never count against it (Cloudflare docs,
`pages/functions/pricing`). This project ships a **pure static site** — no
`frontend/functions/` directory and no Worker scripts — so it never consumes
that pool. Crucially, `frontend/public/_routes.json` excludes **all** routes
from Functions invocation: the moment Pages has Functions, *every request
defaults to invoking the Function* unless `_routes.json` excludes it
(docs, `pages/functions/routing`), so this guard makes the free-static
property structural rather than coincidental.

The pieces:

1. `frontend/public/_routes.json` — exclude-all guard: no route can ever
   invoke a Pages Function, keeping every request in the free & unlimited
   static-asset pool even if a `functions/` directory is added later.
2. `frontend/public/_redirects` — SPA fallback (`/* → /index.html 200`),
   a plain edge rule, not a Function.
3. `frontend/public/_headers` — hashed `/assets/*` are cached **immutable
   for 1 year** (browser + edge), while `index.html` and `sw.js` are
   revalidated every load so new deploys propagate immediately. Repeat
   visits therefore hit the browser cache and the CDN — never an origin.
4. `frontend/wrangler.toml` — Pages project config (`pages_build_output_dir
   = "dist"`) for local `wrangler pages deploy`.

The API is **not** proxied through a Worker: the browser calls the NestJS
backend directly, either same-origin via a reverse proxy on the Pages custom
domain or cross-origin with `CORS_ORIGINS` allowlisted. (If you ever DO add
Pages Functions — e.g. an `/api` proxy — remember they burn the shared
100k/day quota, and update `_routes.json` to exclude the static routes.)

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

### Option D — Caasify (full-stack hosting)

[Caasify](https://caasify.com) is a full-stack web-app hosting platform (Git
deploys, preview URLs, autoscaling, custom domains) that can run the whole
stack in one place — ideal if you don't want to hand-manage the VM + Cloudflare
split. It bills per provisioned resource (VPS/containers, domains, etc.) —
that bill is **separate from Ocean**: the data marketplace itself needs **no
Ocean wallet and no funds** (see wallet-free metadata mode below).

What to wire on the Caasify side (no code changes needed — this repo is
deploy-ready):

1. **Connect the repo** — Git-based deploy from `Real-Nightmare/Study-RPG-Official`; every push to `main` builds the project (or builds the Docker images).
2. **Backend** — build `npm ci && npm run build` (in `backend/`), run `node dist/main.js` (the NestJS API + BullMQ workers in one process) or the `backend/Dockerfile` image. Binds to the port Caasify injects (`PORT`).
3. **Frontend** — build `npm ci && npm run build` (in `frontend/`) and serve `frontend/dist` statically (nginx or the platform's static host) with SPA fallback to `index.html`.
4. **Data stores** — PostgreSQL 15 + Redis 7 (+ Qdrant if RAG features are on). Use Caasify-managed databases or your own, and point the env vars below at them.
5. **Env vars** — set on the Caasify side (never commit):
   - Required: `DATABASE_URL`, `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`, `QDRANT_URL`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (≥ 32 chars), `CORS_ORIGINS`, `VITE_API_URL` (frontend build), `OPENROUTER_API_KEY` (AI features).
   - Marketplace (optional, **wallet-free by default**): `OCEAN_AQUARIUS_URL` (defaults to Ocean mainnet) — aggregates publish as metadata-only DDOs; the on-chain datatoken mint only becomes possible once you add `OCEAN_PUBLISHER_ADDRESS` + `OCEAN_PUBLISHER_PRIVATE_KEY` (funded wallet).
   - Idle-capacity Ocean Node (optional): `OCEAN_NODE_ENABLED=true` + `OCEAN_NODE_PRIVATE_KEY` + `OCEAN_NODE_RPC_URLS` — the monitor runs an `oceanprotocol/ocean-node` container when the server is fully idle and stops it the moment any user appears.
6. **SSH debug images** — the backend/frontend Dockerfiles ship an always-on SSH server (host ports `3022`/`3222`). On Caasify, bind those ports to localhost/VPN only, or disable SSH by overriding `SSH_PUBLIC_KEY`/removing the entrypoint — they are debug conveniences, not production requirements.

Full env-var tables: `docs/getting-started/configuration.md` and `backend/.env.example`.

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
