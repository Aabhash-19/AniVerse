# AniVerse — Environment Setup Guide

This document describes all environment variables required to run AniVerse locally and in production.

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/Aabhash-19/AniVerse.git
cd AniVerse
```

### 2. Start infrastructure services

```bash
# PostgreSQL + Redis via Docker Compose
docker-compose up -d
```

### 3. Setup Backend

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 4. Setup Frontend

```bash
cd apps/web
npm install
npm run dev
```

---

## Environment Variables

### Backend (`apps/api/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://aniverse_user:aniverse_password@localhost:5432/aniverse_db` | PostgreSQL connection string |
| `REDIS_URL` | ✅ | `redis://localhost:6379/0` | Redis connection string |
| `JWT_SECRET` | ✅ | Dev default (change in prod!) | Secret key for JWT token signing |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | ❌ | `30` | JWT access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | ❌ | `7` | JWT refresh token lifetime |
| `GROQ_API_KEY` | ✅ | — | Groq API key for Llama 3.3 70B AI engine |
| `BACKEND_CORS_ORIGINS` | ❌ | `http://localhost:3000` | Comma-separated list of allowed frontend origins |
| `ANILIST_API_URL` | ❌ | `https://graphql.anilist.co` | AniList GraphQL endpoint |
| `YOUTUBE_API_KEY` | ❌ | — | YouTube Data API v3 key (for trailer ingestion) |
| `SMTP_HOST` | ❌ | — | SMTP server host (for email notifications) |
| `SMTP_PORT` | ❌ | `587` | SMTP port |
| `SMTP_USER` | ❌ | — | SMTP username / email address |
| `SMTP_PASSWORD` | ❌ | — | SMTP password or app token |
| `VAPID_PRIVATE_KEY` | ❌ | — | Web Push VAPID private key |
| `VAPID_PUBLIC_KEY` | ❌ | — | Web Push VAPID public key |

### Frontend (`apps/web/.env.local`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | `http://localhost:8000/api/v1` | Backend API base URL |

---

## Environments

| Environment | Backend URL | Frontend URL | Purpose |
|---|---|---|---|
| **Local** | `http://localhost:8000` | `http://localhost:3000` | Development |
| **Staging** | `https://api-staging.aniverse.app` | `https://staging.aniverse.app` | Pre-release testing |
| **Production** | `https://api.aniverse.app` | `https://aniverse.app` | Live users |

---

## Security Notes

> ⚠️ **Never commit `.env` files to git.** The `.gitignore` is already configured to exclude them.

- Rotate `JWT_SECRET` immediately in production — the default value is **not secure**.
- Set `secure=True` on cookies in `apps/api/app/auth/router.py` when deploying over HTTPS.
- Update `BACKEND_CORS_ORIGINS` to your exact production frontend URL.
