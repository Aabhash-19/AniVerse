# 🍊NamiVerse — Next-Gen AI Anime Discovery, Official Media & Watchlist Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-336791?style=for-the-badge&logo=postgresql)](https://neon.tech/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Gemini AI](https://img.shields.io/badge/Gemini_AI-1.5_/_2.5-8E44AD?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![Deploys](https://img.shields.io/badge/Vercel_%2B_Render-Live-success?style=for-the-badge&logo=vercel)](https://nami-verse.vercel.app)

> **Navigated by Nami 🍊** — An enterprise-grade, full-stack anime discovery platform featuring AI-powered semantic vector search, real-time airing calendars, spoiler-controlled community forums, official media clip vault, and Nami: your official AI Straw Hat Navigator!

---

## 🚀 Live Demo & Production URLs

- 🌐 **Web Platform**: [https://nami-verse.vercel.app](https://nami-verse.vercel.app)
- ⚡ **API Service**: `https://namiverse-api.onrender.com/api/v1`
- 🩺 **System Health Check**: `https://namiverse-api.onrender.com/api/v1/health`

---

## 🎨 Key Features & System Modules

```mermaid
graph TD
    Client[User / Browser] -->|Next.js 16 Web Interface| App[NamiVerse Frontend]
    App -->|JSON APIs / JWT Auth| API[FastAPI Backend]
    API -->|Vector Cosine Search| PG[Neon PostgreSQL + pgvector]
    API -->|Key-Value Rate Limiting| Redis[Upstash Redis Cache]
    API -->|Generative Chatbot| Gemini[Google Gemini AI]
    API -->|Catalog Sync| AniList[AniList GraphQL API]
```

### 1. 🤖 Nami AI Chatbot (Official Navigator)
- **Persona & Context**: Powered by Google Gemini AI with a customized One Piece navigator persona. Nami responds to inquiries about anime recommendations, plot details, and lore.
- **Dynamic Recommendation Cards**: Nami automatically attaches interactive anime recommendation cards directly inside the chat stream.
- **Contextual Awareness**: Remembers session conversations and allows quick resets.

### 2. 🧠 AI Semantic Search & Hybrid Vector Recommendation Engine
- **Dense Vector Embeddings**: Uses SentenceTransformers (`all-MiniLM-L6-v2`) to project anime themes, synopses, and genres into 384-dimensional vector space.
- **pgvector Integration**: Executes high-speed cosine distance similarity (`1 - cosine_distance`) queries directly inside PostgreSQL.
- **Hybrid Scoring**: Merges semantic similarity with popularity metrics and user taste preferences.

### 3. 🌊 Airing Horizon Radar & Weather Report
- **Real-Time Airing Countdowns**: Displays exact days, hours, and minutes remaining for upcoming episodes.
- **Weekly Schedule Grid**: Filter airing shows by day of the week (Monday through Sunday).
- **Timezone Intelligence**: Automatically formats broadcast times according to the user's local browser timezone.

### 4. 🎬 Nami's Lounge & Video Media Vault
- **Official Media Clips**: High-definition trailer streaming powered by YouTube IFrame integration.
- **Interactive Trivia Quiz**: A 5-question One Piece & Nami trivia game featuring instant score calculations, feedback alerts, and retry options.

### 5. 💬 Spoiler-Controlled Community Discussions & Reviews
- **Threaded Forums**: Create discussions, reply to comments, and upvote community posts.
- **Spoiler Protection**: Content tagged with spoilers is blurred by default with explicit click-to-reveal overlays.
- **Review Distributions**: View score breakdowns, written reviews, and community sentiment metrics.

### 6. 📑 User Watchlist & Progress Tracking
- **Custom Status Management**: Organize titles into *Watching*, *Completed*, *Plan to Watch*, *On Hold*, and *Dropped*.
- **Episode & Score Logs**: Track current episode progress and rate titles on a 1–10 scale.
- **User Profiles & Data Export**: Personalize profile avatars, review activity stats, and export user data in JSON format.

### 7. ⚙️ Admin Curator Queue & Dynamic Ingestion
- **Automated Catalog Backfilling**: Dynamic fallback fetching ensures that opening un-indexed titles seamlessly fetches and caches full metadata from AniList.
- **Security & Rate Limiting**: Built-in `SecurityMiddleware` protects endpoints with token bucket rate-limiting and security headers.

---

## 🛠️ Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16 (App Router)** | Built with React 19, TypeScript, and Turbopack |
| **Styling** | **Tailwind CSS v4** | Modern dark-mode palette, glassmorphism, and responsive layout |
| **Backend API** | **FastAPI (Python 3.11+)** | Asynchronous RESTful API with Pydantic V2 & SQLAlchemy ORM |
| **Database** | **PostgreSQL 16 + pgvector** | Serverless relational database with vector similarity extension |
| **Caching & Limits** | **Redis (Upstash / Memory)** | Token bucket rate limiting and session caching |
| **AI Models** | **Google Gemini AI + SentenceTransformers** | Generative conversational chatbot & 384d semantic vector search |
| **Deployment** | **Vercel + Render** | Global edge frontend deployment & containerized API web service |

---

## 🛠️ Monorepo Directory Structure

```text
NamiVerse/
├── apps/
│   ├── api/                      # FastAPI Python Backend
│   │   ├── app/
│   │   │   ├── admin/            # Curator Queue & Catalog Sync
│   │   │   ├── anime/            # Anime Catalog & Search Endpoints
│   │   │   ├── auth/             # User Auth & JWT Management
│   │   │   ├── chat/             # Nami Gemini AI Chatbot Router
│   │   │   ├── community/        # Discussions, Reviews & Comments
│   │   │   ├── lists/            # Watchlists & Progress Tracking
│   │   │   ├── media/            # Video Vault & Airing Schedules
│   │   │   ├── notifications/    # User System Notifications
│   │   │   ├── recommendations/  # pgvector Semantic Search Engine
│   │   │   ├── shared/           # Cache, Security & Middleware
│   │   │   ├── config.py         # App Environment Configurations
│   │   │   ├── database.py       # SQLAlchemy Engine & Session
│   │   │   └── main.py           # FastAPI Application Entrypoint
│   │   ├── requirements.txt      # Python Dependencies
│   │   └── seed_anilist.py       # Catalog Seeding Utility
│   │
│   └── web/                      # Next.js 16 Frontend
│       ├── app/                  # Next.js App Router Pages
│       │   ├── (auth)/           # Login & Register Modals
│       │   ├── (user)/           # Watchlist & User Dashboard
│       │   ├── admin/            # Admin Curator Dashboard
│       │   ├── anime/[slug]/     # Anime Detail & Media Page
│       │   ├── calendar/         # Airing Weekly Schedule Grid
│       │   ├── discover/         # Catalog Search & Filters
│       │   ├── discussions/      # Community Discussion Threads
│       │   ├── profile/          # Public User Profiles
│       │   ├── settings/         # Data Export & Privacy Controls
│       │   ├── upcoming/         # Horizon Radar Airing Countdowns
│       │   └── videos/           # Nami's Lounge & Video Vault
│       ├── components/           # Reusable UI Components & Headers
│       ├── lib/                  # Auth Helpers & API Client Utils
│       ├── package.json          # Node Dependencies
│       └── tsconfig.json         # TypeScript Configuration
│
├── docs/                         # Deployment & Architecture Guides
├── docker-compose.yml            # Local Multi-Container Setup
└── README.md                     # Project Documentation
```

---

## ⚙️ Environment Variables Reference

### Backend (`apps/api/.env`)
```env
PROJECT_NAME="NamiVerse API"
API_V1_STR="/api/v1"
DATABASE_URL="postgresql://user:password@localhost:5432/namiverse_db"
REDIS_URL="redis://localhost:6379/0"
JWT_SECRET="your-super-secret-jwt-key"
GEMINI_API_KEY="your-google-gemini-api-key"
BACKEND_CORS_ORIGINS="https://nami-verse.vercel.app,http://localhost:3000"
```

### Frontend (`apps/web/.env.local`)
```env
NEXT_PUBLIC_API_URL="https://namiverse-api.onrender.com/api/v1"
```

---

## 💻 Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Aabhash-19/NamiVerse.git
cd NamiVerse
```

### 2. Backend Setup (`apps/api`)
```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start local FastAPI server
PYTHONPATH=. uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Frontend Setup (`apps/web`)
```bash
cd apps/web
npm install

# Start Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ Free Production Deployment Architecture

The NamiVerse platform is deployed **100% for free** using serverless tiers:

1. **Vercel** (Frontend): Deploys `apps/web` on git push with instant edge caching.
2. **Render** (Backend): Hosts `apps/api` FastAPI service with automatic HTTPS.
3. **Neon** (PostgreSQL): Serverless Postgres database with native `pgvector` support.
4. **Upstash** (Redis): Serverless key-value caching & rate limiting.
5. **Cron-Job.org** (Keep-Alive): Pings `https://namiverse-api.onrender.com/api/v1/health` every 10 minutes to prevent Render free-tier cold starts.

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<p align="center">
  Made with ❤️ & 🍊 for all weeblets especially worshipping <b> NAMI</b>
</p>
