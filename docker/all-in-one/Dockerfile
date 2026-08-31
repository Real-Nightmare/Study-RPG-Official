# ============================================================
# Study RPG — All-in-One Docker Image
# For free hosting tiers (Render, Koyeb, etc.) — 512MB RAM
# Bundles: Frontend (nginx) + Backend (NestJS) + PostgreSQL
# ============================================================

# ── Stage 1: Build Frontend ──
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --prefer-offline --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build Backend ──
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --prefer-offline --no-audit --no-fund
COPY backend/ ./
RUN npm run build

# ── Stage 3: Runtime ──
FROM node:20-alpine

# Install PostgreSQL and nginx
RUN apk add --no-cache \
    postgresql16-client \
    postgresql16 \
    nginx \
    su-exec \
    bash \
    curl \
    dumb-init

# Create postgres user and data directory
RUN addgroup -g 1001 -S app && \
    adduser -u 1001 -S app -G app && \
    mkdir -p /var/lib/postgresql/data && \
    chown -R 1001:1001 /var/lib/postgresql/data && \
    mkdir -p /var/run/postgresql && \
    chown -R 1001:1001 /var/run/postgresql

WORKDIR /app

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Copy built backend
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules
COPY --from=backend-build /app/backend/package.json ./backend/

# Copy startup script
COPY docker/all-in-one/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Copy nginx config
COPY docker/all-in-one/nginx.conf /etc/nginx/http.d/default.conf

# Environment defaults (all configurable via env vars at runtime)
ENV NODE_ENV=production \
    BACKEND_PORT=3000 \
    DB_HOST=localhost \
    DB_PORT=5432 \
    DB_NAME=studyrpg \
    DB_USER=studyrpg \
    DB_PASSWORD=studyrpg \
    DATABASE_URL=postgresql://studyrpg:studyrpg@localhost:5432/studyrpg \
    PORT=8080 \
    JWT_SECRET=change-me-in-production \
    AI_PROVIDER=openai-compatible \
    OPENAI_BASE_URL=https://api.groq.com/openai/v1 \
    OPENAI_MODEL=llama-3.1-70b-versatile \
    EMBEDDING_PROVIDER=openai \
    EMBEDDING_MODEL=text-embedding-3-small \
    STORAGE_PROVIDER=local \
    EMAIL_TRANSPORT=smtp \
    SMTP_HOST=127.0.0.1 \
    SMTP_PORT=1025 \
    SEARCH_PROVIDER=none \
    MARKETPLACE_ENABLED=false \
    BILLING_ENABLED=false \
    CORS_ORIGIN=*

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -sf http://localhost:8080/api/health || exit 1

# Start everything
ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/start.sh"]
