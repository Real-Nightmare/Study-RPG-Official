# Backup & Restore

## Create a Backup

```bash
./scripts/backup.sh ./backups
# Creates: backups/studyrpg-YYYYMMDDTHHMMSSZ.dump
```

Uses `DATABASE_URL` or `PG*` env vars.

## Schedule Nightly Backups

```bash
# crontab -e
0 2 * * *  cd /srv/studyrpg && ./scripts/backup.sh /srv/studyrpg/backups >> /var/log/studyrpg-backup.log 2>&1
```

Keep 14 days of backups. Copy off-host (S3, rsync, etc.).

## Restore

```bash
# Target database must exist
createdb studyrpg
./scripts/restore.sh backups/studyrpg-latest.dump
```

## After Restore

1. Restart the API
2. Reindex vectors: `curl -X POST localhost:3000/rag/reindex -H "Authorization: Bearer <admin-token>"`
3. Verify: `curl localhost:3000/api/health`

## What's Backed Up

| Component | Backed Up | Recovery |
|-----------|-----------|----------|
| PostgreSQL | ✅ `pg_dump` | `restore.sh` |
| File storage | ⚠️ Bucket separately | Restore from backup |
| Redis | ❌ Ephemeral | Jobs re-run automatically |
| Qdrant | ❌ Derived | Rebuilt via `/rag/reindex` |
