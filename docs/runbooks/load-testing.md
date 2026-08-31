# Load Testing

## Quick Smoke Test

```bash
node scripts/load-test.mjs --url http://localhost:3000/api/health
node scripts/load-test.mjs --url http://localhost:3000/api/health --concurrency 20 --duration 30
```

## Options

| Flag | Default | Purpose |
|------|---------|---------|
| `--url` | `http://localhost:3000/api/health` | Target endpoint |
| `--concurrency` | `10` | Concurrent requests |
| `--duration` | `15` | Test duration (seconds) |

## What to Look For

| Metric | Target |
|--------|--------|
| Requests/sec | Should scale with concurrency |
| p95 latency | < 300ms for API endpoints |
| Failed requests | 0 — any failure needs investigation |

## Common Bottlenecks

1. **PostgreSQL pool** — check `max_connections` and pool saturation
2. **Redis/Queues** — check queue stats in `GET /admin/status`
3. **Qdrant** — vector search latency under load
4. **Nginx** — check rate limits in `frontend/nginx.conf`
