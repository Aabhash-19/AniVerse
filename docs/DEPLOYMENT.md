# AniVerse — Deployment Guide

This guide covers deploying AniVerse (FastAPI backend + Next.js frontend) to a production environment using [Railway](https://railway.app) or any Docker-compatible host.

---

## Architecture Overview

```
Users → CDN (Vercel/Cloudflare) → Next.js Frontend
                                         ↓
                                  FastAPI Backend (Railway/Render)
                                         ↓
                              PostgreSQL ← Redis
                                         ↓
                               Background Workers
```

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 18+ |
| Python | 3.11+ |
| PostgreSQL | 15+ |
| Redis | 7+ |
| Docker | 24+ (optional) |

---

## 1. Backend Deployment (FastAPI)

### Using Railway

1. Connect your GitHub repository to Railway.
2. Set the **root directory** to `apps/api`.
3. Set the **start command**: `.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Configure environment variables (see [ENVIRONMENT.md](./ENVIRONMENT.md)).

### Using Docker

```bash
# Build image
docker build -t aniverse-api ./apps/api

# Run container
docker run -p 8000:8000 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e JWT_SECRET="your-secret" \
  aniverse-api
```

### Run Database Migrations

After deploying, ensure all tables are created:

```bash
# Tables auto-create via Base.metadata.create_all on startup.
# Or run Alembic if configured:
alembic upgrade head
```

---

## 2. Frontend Deployment (Next.js)

### Using Vercel (Recommended)

1. Import the repository on [vercel.com](https://vercel.com).
2. Set **root directory** to `apps/web`.
3. Set environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-api.railway.app/api/v1
   ```
4. Vercel automatically builds and deploys on every `git push`.

### Using Docker

```bash
cd apps/web
npm run build
npm start
```

---

## 3. Smoke Tests After Deployment

Run these checks after every deployment:

```bash
# 1. API health check
curl https://your-api.railway.app/api/v1/health

# 2. Anime listing
curl https://your-api.railway.app/api/v1/anime?limit=5

# 3. Search
curl "https://your-api.railway.app/api/v1/search?q=titan"
```

Expected: `{"status": "healthy", "services": {"database": "healthy", "redis": "healthy"}}`

---

## 4. CI/CD Pipeline

Every push to `main` triggers the GitHub Actions workflow at `.github/workflows/ci.yml` which:

1. Spins up Postgres + Redis test containers
2. Runs `pytest` against the backend
3. Runs `npm run build` against the frontend

> ⚠️ **Do NOT merge to `main` if the pipeline is red.**
