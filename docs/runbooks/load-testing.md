# Runbook: Load Testing

**Applies to**: PDF Phase 9 (Hardening) — a lightweight smoke load tester for
the API (`scripts/load-test.mjs`), not a full k6 suite.

## What it does

Hits a single URL with fixed concurrency for a fixed duration and reports:

- Requests completed / failed
- Requests/sec
- p50, p95 and max latency

It is a smoke tester: it tells you the API is alive under modest concurrent
load and gives you a baseline latency distribution. For real capacity planning,
pair it with a proper load tool (k6, artillery) and a staging environment.

## Usage

```bash
# Node.js >= 18 (global fetch). From the repo root:
node scripts/load-test.mjs --url http://localhost:3000/api/health
node scripts/load-test.mjs --url http://localhost:3000/api/health --concurrency 20 --duration 30
```

Options:

| Flag | Default | Env fallback |
|------|---------|--------------|
| `--url` | `http://localhost:3000/api/health` | `LOAD_TEST_URL` |
| `--concurrency` | `10` | `LOAD_TEST_CONCURRENCY` |
| `--duration` | `15` (seconds) | `LOAD_TEST_DURATION` |

Exit codes: `0` = all requests OK, `2` = one or more requests failed.

## Choosing targets

Start with the health/status endpoints, then move to realistic user flows:

```bash
node scripts/load-test.mjs --url http://localhost:3000/api/health
node scripts/load-test.mjs --url http://localhost:3000/api/dashboard/summary --concurrency 15 --duration 30
node scripts/load-test.mjs --url http://localhost:3000/api/rpg/leaderboard --concurrency 15 --duration 30
```

Endpoints behind JWT require an `Authorization` header — extend the script or
test public endpoints. (The script currently sends no headers.)

## Interpreting results

| Metric | What to look for |
|--------|------------------|
| Requests/sec | Should scale with concurrency; a hard ceiling indicates a bottleneck (DB connections, CPU) |
| p95 latency | Target < 300 ms for API endpoints under smoke load; > 1 s needs investigation |
| Failed requests | Any failures under load = a problem (5xx, timeouts) |

## Common bottlenecks to check

1. PostgreSQL connection pool (`PGPOOL`-style settings) — watch
   `max_connections` and pool saturation in the admin status dashboard.
2. BullMQ/Redis — queue delays show up in `GET /admin/status` queue stats.
3. Qdrant — vector search latency; ensure the active collection is the
   versioned collection the resolver points at.
4. Nginx/rate limits — the frontend proxy may clamp concurrency; check
   `frontend/nginx.conf`.

## CI integration (optional)

Add a smoke step to CI after deploy:

```bash
node scripts/load-test.mjs --url "$STAGING_URL/api/health" --concurrency 5 --duration 5
```
