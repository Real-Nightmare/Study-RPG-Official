# Runbook: Audit-Log Retention & Export

**Applies to**: PDF Phase 9 (Hardening) — the audit log is the owner's
anti-cheating evidence trail. Retention keeps it bounded; export makes it
durable; the whole thing stays visible to teachers.

## How it works

- Every mutating admin action writes an `audit_logs` row with a **required
  reason** (enforced in `AuditService.log`).
- Retention is configured in `game_config` under `security.audit`:

  ```json
  { "retentionDays": 365 }
  ```

- A repeatable BullMQ job (`audit-retention`, daily) purges entries older than
  the window. It runs under a Postgres advisory lock so concurrent runs never
  double-purge, and the purge run is itself audited.
- **Safety default**: a window of `0` days (or a missing/malformed config)
  disables purging entirely — a misconfiguration can never wipe the evidence.

## Viewing

Admins **and teachers** can read the audit log (`GET /admin/audit-logs`) so
teachers can verify admins are not cheating.

## Configuring retention

Via the Admin UI (Audit tab → retention control) or API:

```bash
# read current window
GET /admin/audit-logs/retention            # { "retentionDays": 365 }

# set a new window (admin only, reason required — audited)
POST /admin/audit-logs/retention
{ "retentionDays": 180, "reason": "Policy change approved by owner" }
```

## Manual purge

```bash
POST /admin/audit-logs/purge               # runs the purge now (audited)
```

The scheduled daily job does the same thing automatically; the manual endpoint
is for immediate housekeeping after a config change.

## Exporting

Admins and teachers can export the same filtered view they see in the UI:

```bash
GET /admin/audit-logs/export?format=csv    # CSV (default), Content-Disposition attachment
GET /admin/audit-logs/export?format=json   # JSON array
```

Optional filters: `actorId`, `action`, `targetType`, `limit` (default 5000).

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| Nothing is ever purged | `retentionDays` is `0` (safety default) or the config key is missing — set a positive window |
| "Could not schedule retention job" warning at boot | Redis unavailable at startup; the worker retries nothing, but the daily job re-registers on next boot |
| Export returns old data | Exports reflect the current `audit_logs` table — purge first if you need a bounded export |

## Verify it works

1. Trigger several admin actions (each requires a reason).
2. `GET /admin/audit-logs` → entries present with reasons.
3. Set retention to `1` day, `POST /admin/audit-logs/purge` → stale entries
   removed, and a `audit.purge` entry documents the run.
4. Export CSV/JSON and confirm the same fields as the list view.
