#!/bin/bash
# Study RPG dev bootstrap: infra containers + backend + frontend dev servers.

set -u

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Docker must be running first.
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker is not running. Start Docker Desktop first.${NC}"
    exit 1
fi

# Prepare backend env if missing.
if [ ! -f backend/.env ]; then
    echo -e "${YELLOW}No backend/.env found — creating from .env.example.${NC}"
    cp backend/.env.example backend/.env
    echo -e "${GREEN}Created backend/.env — add your credentials before the API runs.${NC}"
fi

echo -e "${BLUE}Starting infrastructure (postgres, redis, qdrant, clickhouse)...${NC}"
docker compose --env-file .env.docker up -d postgres redis qdrant clickhouse

# Wait for PostgreSQL to become healthy.
timeout=60
counter=0
until docker compose --env-file .env.docker ps | grep -q "studyield-postgres.*healthy" || [ "$counter" -ge "$timeout" ]; do
    echo -n "."
    sleep 2
    counter=$((counter + 2))
done
echo ""

if [ "$counter" -ge "$timeout" ]; then
    echo -e "${RED}PostgreSQL did not become healthy within ${timeout}s.${NC}"
    echo -e "${YELLOW}Inspect with: docker compose logs postgres${NC}"
    exit 1
fi
echo -e "${GREEN}PostgreSQL is healthy.${NC}"

echo -n "Checking Redis... "
if docker compose --env-file .env.docker ps | grep -q "studyield-redis.*healthy"; then
    echo -e "${GREEN}healthy.${NC}"
else
    echo -e "${YELLOW}not yet — continuing anyway.${NC}"
fi

echo ""
echo -e "${GREEN}Infrastructure is up.${NC}"
echo "   PostgreSQL: localhost:5432"
echo "   Redis:      localhost:6379"
echo "   Qdrant:     http://localhost:6333/dashboard"
echo "   ClickHouse: localhost:8123"
echo ""

# --- Backend ---
cd backend || exit 1
if [ ! -d node_modules ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    npm install
fi

echo -e "${BLUE}Running migrations...${NC}"
npm run migrate 2>/dev/null || echo -e "${YELLOW}No pending migrations (or the script is unavailable).${NC}"

echo -e "${BLUE}Starting backend (NestJS)...${NC}"
npm run start:dev &
BACKEND_PID=$!
sleep 5
cd ..

# --- Frontend ---
cd frontend || exit 1
if [ ! -f .env ]; then
    echo -e "${YELLOW}No frontend/.env found — creating from .env.example.${NC}"
    cp .env.example .env
    echo -e "${GREEN}Created frontend/.env.${NC}"
fi

if [ ! -d node_modules ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install
fi

echo ""
echo -e "${GREEN}Dev servers starting.${NC}"
echo -e "${BLUE}   Backend API: ${GREEN}http://localhost:3010${NC}"
echo -e "${BLUE}   Frontend:    ${GREEN}http://localhost:5189${NC}"
echo -e "${YELLOW}Ctrl+C stops the frontend; stop infra with: docker compose down${NC}"
echo ""

npm run dev
