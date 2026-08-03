import time
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
import redis

# Auto create tables on startup
from app.database import engine, Base, get_db
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

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)

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
