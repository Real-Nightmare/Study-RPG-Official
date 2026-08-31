#!/bin/bash
set -e

echo "═══════════════════════════════════════════"
echo "  Study RPG — Starting All-in-One Server"
echo "═══════════════════════════════════════════"

# ── 1. Initialize PostgreSQL ──
echo "[1/5] Initializing PostgreSQL..."

PGDATA="/var/lib/postgresql/data"

# Only initialize if data directory is empty
if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "  → First run: initializing database cluster..."
    initdb -D "$PGDATA" --encoding=UTF8 --locale=C --username=postgres
    
    # Configure PostgreSQL for low-memory usage
    cat >> "$PGDATA/postgresql.conf" <<EOF
# Study RPG — Low-memory configuration for free hosting
shared_buffers = 32MB
effective_cache_size = 64MB
work_mem = 1MB
maintenance_work_mem = 16MB
max_connections = 20
listen_addresses = 'localhost'
port = 5432
unix_socket_directories = '/var/run/postgresql'
logging = off
EOF
    
    # Allow local passwordless connections
    echo "local all all trust" > "$PGDATA/pg_hba.conf"
    echo "host all all 127.0.0.1/32 trust" >> "$PGDATA/pg_hba.conf"
    echo "host all all ::1/128 trust" >> "$PGDATA/pg_hba.conf"
fi

# Start PostgreSQL (must run as postgres user)
echo "  → Starting PostgreSQL..."
su-exec postgres pg_ctl -D "$PGDATA" -l /var/log/postgresql.log start -w

# Wait for PostgreSQL to be ready
echo "  → Waiting for PostgreSQL..."
for i in $(seq 1 30); do
    if su-exec postgres pg_isready -q; then
        echo "  → PostgreSQL ready!"
        break
    fi
    sleep 1
done

# ── 2. Create Database ──
echo "[2/5] Setting up database..."

# Create user and database if they don't exist
su-exec postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
    su-exec postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"

su-exec postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
    su-exec postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

su-exec postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true

echo "  → Database '${DB_NAME}' ready!"

# ── 3. Run Migrations ──
echo "[3/5] Running migrations..."

cd /app/backend
node scripts/migrate.js 2>&1 || echo "  ⚠ Migration script encountered issues (may be expected on first run)"

# ── 4. Start Backend ──
echo "[4/5] Starting backend..."

# Start NestJS in background (on port 3000, nginx proxies 8080→3000)
PORT=${BACKEND_PORT:-3000} node dist/main.js &
BACKEND_PID=$!
echo "  → Backend started (PID: $BACKEND_PID)"

# Wait for backend to be ready
echo "  → Waiting for backend..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:${BACKEND_PORT:-3000}/api/health > /dev/null 2>&1; then
        echo "  → Backend ready!"
        break
    fi
    sleep 1
done

# ── 5. Start Nginx (Frontend) ──
echo "[5/5] Starting nginx (frontend)..."

# Ensure nginx directories exist
mkdir -p /var/log/nginx /var/lib/nginx/tmp

# Start nginx
nginx
echo "  → Nginx ready!"

echo ""
echo "═══════════════════════════════════════════"
echo "  Study RPG is running!"
echo "  Frontend: http://localhost:${PORT:-8080}"
echo "  Backend:  http://localhost:${PORT:-8080}/api"
echo "═══════════════════════════════════════════"

# Keep running and handle signals
trap 'echo "Shutting down..."; kill $BACKEND_PID 2>/dev/null; su-exec postgres pg_ctl -D "$PGDATA" stop -m fast; nginx -s stop 2>/dev/null; exit 0' SIGTERM SIGINT

wait $BACKEND_PID
