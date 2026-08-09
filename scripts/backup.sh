#!/usr/bin/env bash
# Studyield PostgreSQL backup (PDF Phase 9 ops deliverable).
#
# Usage:
#   ./scripts/backup.sh [output-dir]          # defaults to ./backups
#
# Connection:
#   Uses $DATABASE_URL if set, otherwise the standard PG* variables
#   (PGHOST / PGPORT / PGUSER / PGPASSWORD / PGDATABASE).
#
# Restore testing:
#   pg_restore --list "$FILE" | head          # sanity check the archive
#   ./scripts/restore.sh "$FILE"              # full restore (see restore.sh)
set -euo pipefail

# --- Resolve connection -----------------------------------------------------
if [[ -n "${DATABASE_URL:-}" ]]; then
  DB_URL="$DATABASE_URL"
else
  : "${PGHOST:=localhost}"
  : "${PGPORT:=5432}"
  : "${PGUSER:=postgres}"
  : "${PGDATABASE:=studyield}"
  DB_URL="postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
fi

# --- Output location --------------------------------------------------------
OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${OUT_DIR}/studyield-${STAMP}.dump"

echo "Backing up to: ${OUT_FILE}"
pg_dump --no-owner --no-privileges --format=custom "$DB_URL" > "$OUT_FILE"

SIZE="$(du -h "$OUT_FILE" | awk '{print $1}')"
echo "Backup complete (${SIZE})."
echo "Verify the archive with: pg_restore --list \"${OUT_FILE}\" | head"

# --- Notes on the rest of the stack -----------------------------------------
# Redis and Qdrant are treated as recreate-from-source:
#   * Redis  — ephemeral caches/queues (BullMQ jobs re-run or are dropped).
#   * Qdrant — the RAG vector collection is rebuilt from the knowledge base
#              via the admin reindex endpoint (POST /rag/reindex), so the
#              documents in Postgres are the source of truth.
