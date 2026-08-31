# Audit Log Retention

## How It Works

Every admin action writes an `audit_logs` row with a required reason. A daily BullMQ job purges entries older than the configured retention window.

## Configure Retention

```bash
# Read current window
GET /admin/audit-logs/retention

# Set new window (admin only, audited)
POST /admin/audit-logs/retention
{ "retentionDays": 180, "reason": "Policy update" }
```

Default: 365 days. Setting to 0 disables purging (safety default).

## Manual Purge

```bash
POST /admin/audit-logs/purge
```

## Export

```bash
GET /admin/audit-logs/export?format=csv
GET /admin/audit-logs/export?format=json
```

Filters: `actorId`, `action`, `targetType`, `limit`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Nothing purged | `retentionDays` is 0 — set a positive window |
| Export has old data | Purge first, then export |
