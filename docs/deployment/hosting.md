# Deployment Guide

How to run Study RPG in production.

## Architecture

```
Browser (React SPA)
   │  HTTP /api  +  Socket.IO
   ▼
Backend (NestJS API + BullMQ workers)
   ├── PostgreSQL 15   — primary database
   ├── Redis 7         — cache + job queues
   ├── Qdrant          — vector search (RAG)
   ├── ClickHouse      — analytics (optional)
   ├── Ollama          — local AI (or swap to cloud)
   └── MinIO           — file storage (or swap to S3/Cloudinary)
```

## Production Setup

### 1. Clone and configure

```bash
git clone https://github.com/Real-Nightmare/Study-RPG-Official.git
cd Study-RPG-Official
cp backend/.env.example backend/.env
```

Edit `backend/.env` — at minimum set:

```bash
NODE_ENV=production
JWT_ACCESS_SECRET=<random-64-char-string>
JWT_REFRESH_SECRET=<random-64-char-string>
NIGHTMARE_ADMIN_PASSWORD=<strong-password>
CORS_ORIGINS=https://yourdomain.com
```

### 2. Start infrastructure

```bash
docker compose up -d postgres redis qdrant clickhouse ollama minio mailpit searxng
```

### 3. Run migrations

```bash
cd backend && npm ci && npm run migrate
```

### 4. Build and start

```bash
# Backend
cd backend && npm ci && npm run build
node dist/main.js

# Frontend (build once, serve statically)
cd frontend && npm ci && npm run build
# Serve frontend/dist with nginx or any static host
```

### 5. Quick start with bootstrap script

```bash
sh scripts/bootstrap.sh   # starts everything, runs migrations, seeds data
```

## Production Hardening

### Environment Variables

Change all development defaults:

| Variable | Dev Default | Production |
|----------|------------|------------|
| `NIGHTMARE_ADMIN_PASSWORD` | `123456789` | Strong unique password |
| `JWT_ACCESS_SECRET` | *(must set)* | Random 64+ char string |
| `JWT_REFRESH_SECRET` | *(must set)* | Random 64+ char string |
| `MINIO_ACCESS_KEY` | `minioadmin` | Unique access key |
| `MINIO_SECRET_KEY` | `minioadmin` | Unique secret key |
| `CORS_ORIGINS` | `http://localhost:5189` | Your production domain |

### SSL/TLS

Put a reverse proxy (nginx, Caddy, or cloud load balancer) in front of the backend:

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Database Backups

Nightly backups with the included script:

```bash
./scripts/backup.sh ./backups
```

See [../runbooks/backup-restore.md](../runbooks/backup-restore.md) for full backup/restore procedures.

### Monitoring

Health check endpoint:

```bash
curl http://localhost:3000/api/health
```

Admin status (requires admin JWT):

```bash
curl -H "Authorization: Bearer <admin-token>" http://localhost:3000/admin/status
```

## Optional: Cloud AI

Replace Ollama with a cloud AI provider for better quality:

```bash
# In backend/.env
AI_PROVIDER=openai-compatible
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_API_KEY=gsk_your_groq_key
OPENAI_MODEL=llama-3.1-70b-versatile
EMBEDDING_PROVIDER=openai
EMBEDDING_API_KEY=gsk_your_groq_key
EMBEDDING_MODEL=text-embedding-3-small
```

Any OpenAI-compatible provider works: Groq (fastest free tier), Together AI, Fireworks, OpenRouter, OpenAI, Deepseek, Mistral.

## Optional: Cloud Storage

Switch from MinIO to a managed provider:

```bash
# In backend/.env
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
```

## Optional: Production Email

Replace Mailpit with real SMTP:

```bash
# In backend/.env
EMAIL_TRANSPORT=ses
AWS_SES_REGION=us-east-1
# (configure AWS credentials via IAM role or env)
```

## Docker Compose Production

For a single-server deployment:

```bash
docker compose -f docker-compose.yml up -d --build
```

This starts all services including the backend and frontend/nginx.

## Static Frontend Hosting

The frontend builds to static files in `frontend/dist/`. Host anywhere:

- **Cloudflare Pages**: Push to `main` triggers auto-deploy (see `.github/workflows/`)
- **Nginx**: Copy `dist/` to `/var/www/` and configure SPA fallback
- **Any CDN**: Upload `dist/` with `index.html` fallback for all routes

SPA fallback rule for nginx:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

## Ports Reference

| Port | Service | Notes |
|------|---------|-------|
| 8080 | Frontend (dev) | Vite dev server |
| 3000 | Backend API | REST + Socket.IO |
| 8025 | Mailpit UI | Email testing |
| 9001 | MinIO Console | Storage browser |
| 11434 | Ollama | Local AI API |
| 5432 | PostgreSQL | Database |
| 6379 | Redis | Cache |
| 6333 | Qdrant | Vector DB |
| 8123 | ClickHouse | Analytics |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Backend won't start | Check `DATABASE_URL` and that Postgres is running: `docker compose ps postgres` |
| AI not responding | Check Ollama: `curl http://localhost:11434/api/tags`. Pull model: `docker compose exec ollama ollama pull qwen2.5:7b` |
| Uploads failing | Check MinIO: `docker compose ps minio`. Recreate bucket: `docker compose exec minio mc mb local/studyrpg-uploads` |
| Emails not sending | In dev mode, all emails go to Mailpit at http://localhost:8025 |
| Socket.IO not connecting | Check `CORS_ORIGINS` includes your frontend domain |
| Qdrant index stale | Reindex: `curl -X POST http://localhost:3000/rag/reindex -H "Authorization: Bearer <admin-token>"` |
