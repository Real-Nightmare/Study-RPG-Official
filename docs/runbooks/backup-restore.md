# Runbook: Backup & Restore

**Applies to**: PDF Phase 9 (Hardening) ops deliverable. Verified backups and a
repeatable restore procedure are part of the Definition of Done.

## What is backed up

| Component | Backed up? | How |
|-----------|-----------|-----|
| PostgreSQL (all data) | ✅ | `pg_dump` custom-format archive via `scripts/backup.sh` |
| Uploaded files / storage | ⚠️ | Back up your object storage bucket or the `storage/` volume separately |
| Redis | ❌ | Ephemeral (caches + BullMQ queues); jobs are dropped or re-run |
| Qdrant vectors | 🔄 | Rebuilt from the documents in Postgres via the admin reindex endpoint |

The **Postgres database is the source of truth**. Qdrant is a derived index:
after a restore, run `POST /rag/reindex` (admin) to rebuild the active
collection from the restored documents.

## Create a backup

```bash
# From the repo root (requires pg_dump + DATABASE_URL or PG* env vars)
./scripts/backup.sh ./backups
# -> backups/studyrpg-20260806T103000Z.dump
```

The script uses `DATABASE_URL` when set, otherwise `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE`.

Sanity-check an archive without restoring it:

```bash
pg_restore --list backups/studyrpg-*.dump | head
```

## Schedule backups

Recommended: nightly at 02:00 UTC via cron/systemd timer:

```cron
0 2 * * *  cd /srv/studyrpg && ./scripts/backup.sh /srv/studyrpg/backups >> /var/log/studyrpg-backup.log 2>&1
```

Retain N daily backups (e.g. keep 14) and copy archives off-host (object
storage, rsync to another machine) — a backup on the same disk as the database
is not a backup.

## Restore

```bash
# The target database must already exist (createdb studyrpg)
./scripts/restore.sh /srv/studyrpg/backups/studyrpg-20260806T103000Z.dump
```

`restore.sh`:

1. Terminates open connections (best-effort).
2. Runs `pg_restore --clean --if-exists` — existing objects are dropped and
   recreated from the archive.

## Restore testing (mandatory)

A backup that has never been restored is not trusted. Monthly, at minimum:

1. Restore the latest archive into a scratch database (e.g. `studyrpg_restore_test`).
2. Start the API against the scratch DB and smoke-test login + one core flow.
3. Drop the scratch database.

```bash
createdb studyrpg_restore_test
./scripts/restore.sh /srv/studyrpg/backups/studyrpg-latest.dump postgresql://.../studyrpg_restore_test
# smoke test…
dropdb studyrpg_restore_test
```

## After a production restore

1. Restart the API so pooled connections pick up the restored data.
2. Run `POST /rag/reindex` (admin) to rebuild the Qdrant collection.
3. Confirm BullMQ workers reconnect to Redis (they do so automatically).
4. Verify the admin status dashboard (`GET /admin/status`) shows green health.
