# 🌌 AniVerse — AI-Powered Anime Discovery, Media & Community Platform

AniVerse is a full-stack, state-of-the-art web application designed for anime fans to discover, track, watch official media, and engage in spoiler-controlled community discussions. Unlike generic indexers, AniVerse acts as a central hub featuring an automated, curator-supervised official video ingestion queue, personalized hybrid recommendations, and vector-based semantic search.

---

## 🚀 Product Vision & Differentiators

1.  **Verified Official Video Discovery:** An automated discovery pipeline scan that crawls and scores YouTube trailers, openings, and endings, filtering out reactions and unlicensed clips through a strict curator moderation panel.
2.  **AI-Powered Semantic Search:** Natural language semantic querying (e.g., *"dark fantasy anime with political conflict and morally complex characters"*) powered by `pgvector` embeddings.
3.  **Personalized Recommendations:** A hybrid recommendation engine blending content-based tag profiles, user watchlist history, popularity ratings, and decay factors.
4.  **Unified Watchlist Tracking:** Clean tracking dashboard containing episode progress counters, personal ratings, status filters, and public/private visibility configurations.
5.  **Spoiler-Controlled Community:** A fully integrated social layer with user reviews, discussion threads, nested comment replies, emoji reactions, and built-in spoiler blur features.

---

## 📊 Project Roadmap & Implementation Status (66% Complete)

| Phase | Description | Status |
| :--- | :--- | :---: |
| **Phase 1** | **Foundation:** Monorepo architecture, JWT cookie-based auth, DB/Redis setup. | **100%** |
| **Phase 2** | **Anime Catalogue:** AniList API Sync adapter, detail layouts, advanced filters. | **100%** |
| **Phase 3** | **Official Media Hub:** Youtube discovery pipeline, video candidates, curation queue. | **100%** |
| **Phase 4** | **Watchlist & Favourites:** List entry CRUD, AniList profile imports, favourites toggles. | **100%** |
| **Phase 5** | **Community Features:** Reviews, discussions, comments, direct blockings, moderation. | **40%** |
| **Phase 6** | **AI Search & Recs:** Semantic search querying, hybrid recommender engines. | *Pending* |
| **Phase 7** | **Calendar & Notifications:** Airing schedule logs, notification alerts. | *Pending* |
| **Phase 8** | **Production Hardening:** Rate limit rules, security headers, observability. | *Pending* |

---

## 🛠️ Technology Stack

*   **Frontend:** [Next.js 15 (Turbopack)](https://nextjs.org/) + [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Tailwind CSS](https://tailwindcss.com/)
*   **Backend:** [FastAPI (Python 3.13)](https://fastapi.tiangolo.com/) + [SQLAlchemy 2.0](https://www.sqlalchemy.org/) + [Uvicorn](https://www.uvicorn.org/)
*   **Databases:** [PostgreSQL](https://www.postgresql.org/) (Data store of record) + [Redis](https://redis.io/) (Session and query cache)
*   **Vector Engine:** [pgvector](https://github.com/pgvector/pgvector) (For upcoming semantic search embeddings)
*   **External API Integrations:** [AniList GraphQL API](https://anilist.gitbook.io/anilist-apiv2-doc/) + [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)

---

## 📂 Repository Directory Structure

```text
aniverse/
├── apps/
│   ├── web/                    # Next.js 15 Frontend
│   │   ├── app/
│   │   │   ├── (auth)/         # Login & registration flows
│   │   │   ├── (user)/         # Watchlist management, favourites, profile sync
│   │   │   ├── admin/          # Curator dashboards
│   │   │   ├── anime/          # Info detail pages with trailer player
│   │   │   └── videos/         # Official media catalog
│   │   ├── components/         # Reusable layouts and community sections
│   │   └── lib/                # Auth wrappers and API fetch configs
│   │
│   └── api/                    # FastAPI REST API Backend
│       ├── app/
│       │   ├── admin/          # Catalogue ingestion trigger controls
│       │   ├── anime/          # Database querying and filters
│       │   ├── auth/           # Cookie JWT session security
│       │   ├── community/      # Reviews, discussions, nested comments, reporting
│       │   ├── ingestion/      # AniList GraphQL sync service
│       │   ├── lists/          # Watchlists & favourites routers
│       │   ├── media/          # Video candidate discovery algorithms
│       │   └── database.py     # SQLAlchemy session factory connection
│       └── main.py             # App initialization and middlewares
│
└── docker-compose.yml          # Container configuration for DB and cache services
```

---

## ⚙️ Local Development Setup

### 1. Prerequisites
Ensure you have the following installed on your machine:
*   [Node.js (v18+)](https://nodejs.org/)
*   [Python (v3.13+)](https://www.python.org/)
*   [Docker Desktop](https://www.docker.com/)

---

### 2. Database & Cache Services Setup
Start the local PostgreSQL and Redis containers:
```bash
docker-compose up -d
```

---

### 3. Backend (FastAPI) Installation & Run
Navigate to the API folder, initialize the Python virtual environment, install dependencies, and start the development server:
```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start uvicorn with hot reload
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The interactive Swagger API documentation will be available at [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs).

---

### 4. Frontend (Next.js) Installation & Run
Navigate to the web folder, install the Node modules, and launch the Next development server:
```bash
cd apps/web
npm install
npm run dev
```
Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

---

## 🎬 Core Workflows Implemented

### Watchlist & Favourites Management
Users can customize their lists directly from any anime detail page or sync their complete watchlist from a public **AniList** profile. Watchlist stats, progress ticks, and favourite hearts sync instantly:

*   **Watchlist Toggles:** PLANNING, WATCHING, COMPLETED, PAUSED, DROPPED, REWATCHING.
*   **Quick Actions:** Incremental `+1` episode count progress tracker and Rating score sliders.
*   **Favourites:** Direct support for pinning favorite titles.

### Official Video Discovery
FastAPI background rules engine crawls potential video links from target YouTube channels matching anime metadata:
*   **Confidence Scoring Engine:** Points are awarded for official channel matches (+50), exact title matches (+20), and trailer keywords (+15), while reaction clips (-50) are auto-flagged.
*   **Curator Verification Queue:** Verified high-confidence candidates (80%+) are auto-published; uncertain candidates are held in the moderator dashboard (`/admin`) for manual curator review.
*   **YouTube Player Embedding:** Published media renders inside a premium custom overlay using the official YouTube IFrame player API.

### Community Social Layer
*   **Anime Reviews:** Submit scores (1-100), tags, and detailed writeups. Users can react with emojis (👍, ❤️, 💡, 😂) and delete their own posts.
*   **Discussions Forums:** Create episode-specific or general threads, filter discussion views, and track comment/view counts.
*   **Moderation Controls:** Direct reporting logic allows users to flag inappropriate threads. Suspicious spoiler posts are blurred behind warning flags, which reveal content on click.
