#!/bin/sh
# Study RPG frontend container entrypoint.
# Starts nginx to serve the SPA.
set -e

echo "[entrypoint] Starting nginx..."
exec nginx -g "daemon off;"
