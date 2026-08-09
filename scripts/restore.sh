#!/usr/bin/env bash
# Studyield PostgreSQL restore (PDF Phase 9 ops deliverable).
#
# Usage:
#   ./scripts/restore.sh <backup.dump> [DATABASE_URL]
#
# The database URL defaults to $DATABASE_URL. The target database must exist;
# existing objects are dropped and recreated (--clean --if-exists).
set -euo pipefail

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <backup.dump> [DATABASE_URL]" >&2
  exit 1
fi
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

DB_URL="${2:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "Set DATABASE_URL or pass it as the second argument." >&2
  exit 1
fi

echo "Restoring ${BACKUP_FILE} into ${DB_URL}"

# Drop open connections so --clean can drop objects (best-effort; safe to skip).
psql "$DB_URL" \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();" \
  >/dev/null 2>&1 || true

pg_restore --no-owner --no-privileges --clean --if-exists --dbname="$DB_URL" "$BACKUP_FILE"

echo "Restore complete."
echo "Next steps: restart the API, then reindex Qdrant if RAG data is required"
echo "(admin endpoint: POST /rag/reindex)."
