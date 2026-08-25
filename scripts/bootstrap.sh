#!/bin/sh
# Study RPG — one-command bootstrap (fully local, zero external accounts).
#
#   docker compose up -d          # start every service
#   sh scripts/bootstrap.sh       # wait healthy + migrate + models + seed
#   open http://localhost:5189    # play
#
# Idempotent: safe to re-run; each step checks before acting.

set -eu

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

say()  { printf '%b\n' "${BLUE}==>${NC} $1"; }
ok()   { printf '%b\n' "${GREEN} ✔${NC} $1"; }
warn() { printf '%b\n' "${YELLOW} ! $1${NC}"; }
die()  { printf '%b\n' "${RED} ✖ $1${NC}"; exit 1; }

ENV_FILE=".env.docker"
[ -f "$ENV_FILE" ] || ENV_FILE="/dev/null"

dc() { docker compose --env-file "$ENV_FILE" "$@"; }

# 0) Sanity -----------------------------------------------------------------
command -v docker >/dev/null 2>&1 || die "docker is required (https://docs.docker.com/get-docker/)"
docker info >/dev/null 2>&1       || die "Docker daemon is not running — start it first."

# 0b) Backend env ------------------------------------------------------------
if [ ! -f backend/.env ]; then
    say "Creating backend/.env from backend/.env.example"
    cp backend/.env.example backend/.env
fi
if grep -q "^JWT_ACCESS_SECRET=your_jwt" backend/.env 2>/dev/null; then
    warn "backend/.env still contains template JWT secrets — replace them before production."
fi

# 1) Services ----------------------------------------------------------------
say "Starting all services (postgres redis qdrant clickhouse ollama searxng mailpit minio c2d-runner backend frontend)"
dc up -d

# 2) Health waits ------------------------------------------------------------
wait_healthy() { # service label, timeout seconds
    svc=$1; t=$2; waited=0
    while [ "$waited" -lt "$t" ]; do
        status=$(dc ps --format '{{.Service}} {{.Health}}' 2>/dev/null | awk -v s="$svc" '$1==s{print $2}')
        [ "$status" = "healthy" ] && { ok "$svc healthy"; return 0; }
        sleep 3; waited=$((waited + 3))
    done
    die "$svc did not become healthy within ${t}s (status: ${status:-unknown})"
}

say "Waiting for core services to become healthy"
wait_healthy postgres 90
wait_healthy redis 60
wait_healthy clickhouse 120
wait_healthy minio 90
wait_healthy mailpit 60
wait_healthy c2d-runner 90
ok "qdrant / searxng / ollama started (healthchecks not required)"

# 3) Database migrations ------------------------------------------------------
say "Running database migrations"
dc exec -T backend node scripts/migrate.js || dc exec -T backend npm run migrate \
  || warn "Migrations could not run via the backend container — run 'cd backend && npm run migrate' against the exposed postgres port."

# 4) Ollama models (first boot only — ~4.5 GB download) -----------------------
CHAT_MODEL=$(grep -E '^OLLAMA_CHAT_MODEL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2)
CHAT_MODEL=${CHAT_MODEL:-qwen2.5:7b-instruct}
EMBED_MODEL=$(grep -E '^OLLAMA_EMBEDDING_MODEL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2)
EMBED_MODEL=${EMBED_MODEL:-nomic-embed-text}

pull_model() {
    m=$1
    if dc exec -T ollama ollama list 2>/dev/null | grep -q "$m"; then
        ok "model already present: $m"
    else
        say "Pulling Ollama model: $m (first boot downloads GBs — be patient)"
        dc exec -T ollama ollama pull "$m" || warn "Could not pull $m — retry later with: docker compose exec ollama ollama pull $m"
    fi
}
if dc ps --status running 2>/dev/null | grep -q ollama; then
    pull_model "$CHAT_MODEL"
    pull_model "$EMBED_MODEL"
else
    warn "ollama container not running — chat/embeddings stay offline until it starts."
fi

# 5) Buckets ------------------------------------------------------------------
# minio-init service creates the bucket on `docker compose up` (idempotent).
dc ps | grep -q minio-init && ok "MinIO bucket handled by minio-init"

# 6) Done ----------------------------------------------------------------------
cat <<EOF

${GREEN}Study RPG is ready.${NC}
  Frontend:      http://localhost:5189
  API:           http://localhost:3010/api/v1
  Mail UI:       http://localhost:8025     (dev email sink)
  MinIO console: http://localhost:9001     (studyrpg / studyrpg-secret)
  Ollama:        http://localhost:11434

Register a username in the UI and play. The data marketplace is OFF by
default (strict compute-to-data only); billing and FCM are off too.
EOF
