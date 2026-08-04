<p align="center">
  <img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcXl0cXJvdGNuZnpwbXZzZHBnOWdtbW03NDZpZHFzbjFjbmUwdzJ4MyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/9aIVEZ6CsheqQ/giphy.gif" alt="Nami Navigator GIF" width="450" style="border-radius: 20px; box-shadow: 0 10px 30px rgba(245, 158, 11, 0.4);" />
</p>

<h1 align="center">🍊 ⚡ 🌊 NAMIVERSE (ナミ・バース)</h1>

<p align="center">
  <b>Chart your course through the ultimate anime universe — Navigated by Nami!</b><br />
  <i>Next-Gen AI Anime Discovery, Dense Vector Recommendation Engine, Airing Radar & Official Media Vault.</i>
</p>

<p align="center">
  <a href="https://nami-verse.vercel.app"><img src="https://img.shields.io/badge/🌐_Live_App-nami--verse.vercel.app-F59E0B?style=for-the-badge&logoColor=white" /></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js" /></a>
  <a href="https://fastapi.tiangolo.com"><img src="https://img.shields.io/badge/FastAPI-0.109-009688?style=for-the-badge&logo=fastapi" /></a>
  <a href="https://neon.tech"><img src="https://img.shields.io/badge/PostgreSQL-pgvector-336791?style=for-the-badge&logo=postgresql" /></a>
  <a href="https://ai.google.dev"><img src="https://img.shields.io/badge/Gemini_AI-1.5_/_2.5-8E44AD?style=for-the-badge&logo=google" /></a>
</p>

---

## 🍊 Meet Your Navigator: Nami

<table align="center">
  <tr>
    <td width="30%" align="center" valign="middle">
      <img src="./apps/web/public/nami-outfits/nami-readme.png" alt="Nami Navigator" width="100%" height="225" style="border-radius: 12px; display: block; object-fit: cover;" />
    </td>
    <td width="70%" valign="middle">
      <h3><i>"Yosh! Welcome aboard NamiVerse!"</i> ⛵</h3>
      <p>
        I'm <b>Nami</b>, your official Straw Hat Navigator! Whether you're searching for a 10/10 masterpiece, checking the upcoming airing weather, or looking for official media clips, I've mapped out the entire Grand Line of anime just for you!
      </p>
      <ul>
        <li>⚡ <b>Clima-Tact Weather Intelligence</b>: Airing countdowns & weekly release radars.</li>
        <li>💰 <b>Bounty & Score Tracking</b>: Log your watchlist progress and personal scores.</li>
        <li>🤖 <b>Log Pose AI Chatbot</b>: Ask me for personalized recommendations anytime!</li>
      </ul>
    </td>
  </tr>
</table>

---

## ⚡ Key Modules & Platform Features

```mermaid
graph TD
    User[Straw Hat Crew / User] -->|Loads Web Interface| Web[NamiVerse Next.js 16 App]
    Web -->|Log Pose Queries| Chat[Nami Gemini AI Chatbot]
    Web -->|Vector Similarity Search| Vector[PostgreSQL + pgvector Engine]
    Web -->|Media Vault & Clips| Vault[YouTube Media & Quiz Engine]
    Web -->|Airing Horizon Radar| Radar[Airing Schedule & Weather Engine]
    Vector -->|Dense 384d Cosine Match| DB[(Neon Postgres Database)]
```

### 🤖 1. Nami's Log Pose AI Chatbot
- **Gemini AI Integration**: Powered by Google Gemini AI with a custom One Piece navigator persona. Nami answers questions about anime plots, character lore, and genre suggestions.
- **Interactive Recommendation Cards**: Automatically embeds clickable anime recommendation cards directly inside live chat streams.
- **Session Memory**: Maintains conversation context with instant clear & reset controls.

### 🧠 2. Tactical Vector Recommendation Engine
- **Dense Embeddings**: Uses SentenceTransformers (`all-MiniLM-L6-v2`) to project anime synopses and themes into 384-dimensional vector space.
- **High-Speed Cosine Search**: Uses `pgvector` inside PostgreSQL (`1 - cosine_distance`) to calculate exact semantic similarity.
- **Hybrid Weighting**: Merges vector similarity with genre filters, popularity metrics, and user preferences.

### 🌊 3. Airing Horizon Radar & Weather Report
- **Real-Time Airing Countdowns**: Displays exact days, hours, and minutes remaining for upcoming episodes.
- **Weekly Schedule Grid**: Filter airing shows by broadcast day (Monday through Sunday).
- **Local Timezone Intelligence**: Formats broadcast times dynamically according to the user's local timezone.

### 🎬 4. Nami's Lounge & Media Vault
- **HD Official Clips & Trailers**: Stream verified YouTube trailers and official opening sequences.
- **Navigator's Knowledge Test**: A 6-question trivia quiz covering One Piece & Nami lore with instant score calculation and feedback.

### 💬 5. Grand Line Community & Spoiler Shield
- **Threaded Forums**: Create discussion threads, reply to comments, and upvote community posts.
- **Spoiler Blur Protection**: Spoilers are blurred by default with explicit click-to-reveal overlays.
- **Review Sentiment**: View community score distributions and written reviews.

### 📑 6. Watchlist & Progress Logbook
- **Custom Status Categories**: Organize shows into *Watching*, *Completed*, *Plan to Watch*, *On Hold*, and *Dropped*.
- **Episode & Score Logging**: Track episode counts and log 1–10 scores.
- **Data Export**: Export user data and watchlist footprints in JSON format.

---

## 🛠️ Nautical Tech Stack

| Ship Component | Technology | Role & Description |
| :--- | :--- | :--- |
| 🚢 **Main Deck** | **Next.js 16 (App Router)** | React 19, TypeScript, Turbopack, Tailwind CSS v4 |
| ⚡ **Engine Room** | **FastAPI (Python 3.11+)** | Asynchronous RESTful API with Pydantic V2 & SQLAlchemy ORM |
| 💎 **Treasure Vault** | **PostgreSQL 16 + pgvector** | Serverless relational database with vector similarity search |
| 🌀 **Wind & Weather** | **Redis (Upstash / Memory)** | Token bucket rate limiting and session caching |
| 🗺️ **Log Pose AI** | **Google Gemini AI** | Conversational AI chatbot & semantic recommendation system |
| ⚓ **Lighthouse** | **Vercel + Render** | Global edge frontend deployment & containerized API web service |

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

## 💻 Local Development Guide

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

## ☁️ 100% Free Cloud Deployment Stack

- 🌐 **Vercel** (Frontend): `https://nami-verse.vercel.app`
- ⚡ **Render** (Backend): `https://namiverse-api.onrender.com`
- 🐘 **Neon** (PostgreSQL): Serverless Postgres database with native `pgvector`
- 🔴 **Upstash / Memory** (Redis): Rate limiting & caching
- ⏰ **Cron-Job.org** (Keep-Alive): Pings health endpoint every 10 minutes to prevent Render free-tier cold starts

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<p align="center">
  <img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcjFqZnM3bTN0Ym1xcDhhMnJ1OHlyMmcwNDVlcnl6ZWJndnBhMDFwdyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/L5aXkshtnAUmI/giphy.gif" width="300" style="border-radius: 15px;" /><br /><br />
  Made with 🍊 & ❤️ by a faithful <b>Nami</b> worshipper
</p>
