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
