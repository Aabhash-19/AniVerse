from typing import List
from dotenv import load_dotenv
import os

load_dotenv()

from pydantic import AnyHttpUrl, BeforeValidator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Annotated


def parse_cors(v: str | List[str]) -> List[str]:
    if isinstance(v, str) and not v.startswith("["):
        return [i.strip() for i in v.split(",")]
    elif isinstance(v, list):
        return v
    # If it is a string JSON list representation
    import json
    try:
        return json.loads(v)
    except Exception:
        return []


class Settings(BaseSettings):
    PROJECT_NAME: str = "AniVerse API"
    API_V1_STR: str = "/api/v1"
    
    # Database Settings
    DATABASE_URL: str = "postgresql://aniverse_user:aniverse_password@localhost:5432/aniverse_db"
    
    # Redis Settings
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # JWT Settings
    JWT_SECRET: str = "supersecretjwtkeyforaniverseprojectdevelopmentonly123!"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Gemini AI Settings
    GEMINI_API_KEY: str = ""
    
    # CORS Origins

    BACKEND_CORS_ORIGINS: Annotated[
        List[str], 
        BeforeValidator(parse_cors)
    ] = ["http://localhost:3000", "http://localhost:3001"]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
