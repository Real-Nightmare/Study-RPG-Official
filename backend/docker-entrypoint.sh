#!/bin/sh
# Study RPG backend container entrypoint.
# Runs migrations then starts the NestJS API.
set -e

echo "[entrypoint] Running database migrations..."
npm run migrate

echo "[entrypoint] Starting NestJS application..."
exec node dist/main.js
