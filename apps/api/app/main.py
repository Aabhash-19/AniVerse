import time
import httpx
from fastapi import FastAPI, Depends, Response, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
import redis

# Auto create extensions & tables on startup
from app.database import engine, Base, get_db

try:
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
except Exception as e:
    print(f"Warning: Could not enable vector extension: {e}")

# Import models to register them in metadata
import app.anime.models
import app.admin.models
import app.auth.models
import app.lists.models
import app.media.models
import app.community.models
import app.recommendations.models
import app.notifications.models
Base.metadata.create_all(bind=engine)

from app.config import settings
from app.anime.router import router as anime_router
from app.admin.router import router as admin_router
from app.auth.router import router as auth_router
from app.lists.router import router as lists_router
from app.media.router import router as media_router
from app.community.router import router as community_router
from app.recommendations.router import router as recommendations_router
from app.notifications.router import router as notifications_router
from app.chat.router import router as chat_router

from app.shared.security_middleware import SecurityMiddleware

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)

# Register Security, Headers & Rate Limiting Middleware
app.add_middleware(SecurityMiddleware, redis_url=settings.REDIS_URL)

# Setup CORS Origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include Routers
app.include_router(anime_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(lists_router, prefix=settings.API_V1_STR)
app.include_router(media_router, prefix=settings.API_V1_STR)
app.include_router(community_router, prefix=settings.API_V1_STR)
app.include_router(recommendations_router, prefix=settings.API_V1_STR)
app.include_router(notifications_router, prefix=settings.API_V1_STR)
app.include_router(chat_router, prefix=settings.API_V1_STR)


@app.on_event("startup")
def startup_autoseed():
    """
    On backend startup, check if the database is sparse/empty (<10 anime).
    If so, launch a background task to auto-seed top popular anime from AniList.
    """
    import threading
    def _seed_task():
        try:
            from app.database import SessionLocal
            from app.anime.models import Anime
            from app.ingestion.anilist import AniListClient
            from app.ingestion.service import import_anime_payload
            
            db = SessionLocal()
            try:
                count = db.query(Anime).count()
                if count < 10:
                    print("Fresh database detected (<10 titles). Auto-seeding top popular anime from AniList...")
                    client = AniListClient()
                    try:
                        res = client.fetch_anime_page(page=1, per_page=50)
                        media_list = res.get("data", {}).get("Page", {}).get("media", [])
                        for media in media_list:
                            try:
                                import_anime_payload(db, media)
                                db.commit()
                            except Exception:
                                db.rollback()
                        print(f"Auto-seeded {len(media_list)} popular anime into database.")
                    finally:
                        client.close()
            finally:
                db.close()
        except Exception as err:
            print(f"Auto-seed background task notice: {err}")

    threading.Thread(target=_seed_task, daemon=True).start()


@app.get("/")
def read_root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}!",
        "documentation": f"{settings.API_V1_STR}/docs"
    }


@app.get(f"{settings.API_V1_STR}/health")
def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint verifying the API service,
    PostgreSQL database connection, and Redis cache availability.
    """
    health_status = {
        "status": "healthy",
        "timestamp": time.time(),
        "services": {
            "api": "healthy",
            "database": "unreachable",
            "redis": "unreachable"
        }
    }
    
    # 1. Test PostgreSQL connection
    try:
        db.execute(text("SELECT 1"))
        health_status["services"]["database"] = "healthy"
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["services"]["database"] = f"error: {str(e)}"
        
    # 2. Test Redis connection
    try:
        r = redis.from_url(settings.REDIS_URL, socket_timeout=2.0)
        r.ping()
        health_status["services"]["redis"] = "healthy"
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["services"]["redis"] = f"error: {str(e)}"
        
    return health_status


@app.get(f"{settings.API_V1_STR}/image-proxy")
async def image_proxy(url: str = Query(..., description="The external image URL to proxy")):
    """
    Proxy image URLs from trusted external sites like AniList to bypass browser
    blocking, CORS, and network routing delays.
    """
    if not (url.startswith("https://s4.anilist.co/") or url.startswith("https://media.kitsu.io/")):
        raise HTTPException(status_code=400, detail="Invalid image source URL")

    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            resp = await client.get(url, headers=headers, timeout=10.0)
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail="Failed to fetch image from source")

            content_type = resp.headers.get("content-type", "image/jpeg")
            return Response(
                content=resp.content,
                media_type=content_type,
                headers={
                    "Cache-Control": "public, max-age=31536000, immutable",
                    "Access-Control-Allow-Origin": "*"
                }
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Proxy error: {str(e)}")

