from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import date
from app.anime.models import AnimeFormat, AnimeStatus, CharacterRole, RelationType


class TitleSchema(BaseModel):
    english: Optional[str] = None
    romaji: Optional[str] = None
    native: Optional[str] = None


class AnimeSummarySchema(BaseModel):
    id: int
    anilist_id: int
    slug: str
    title: TitleSchema
    cover_url: Optional[str] = None
    format: Optional[str] = None
    status: Optional[str] = None
    season: Optional[str] = None
    season_year: Optional[int] = None
    episode_count: Optional[int] = None
    average_score: Optional[float] = None
    genres: List[str] = []

    model_config = {
        "from_attributes": True
    }


class CharacterSchema(BaseModel):
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    native_name: Optional[str] = None
    image_url: Optional[str] = None
    role: str
    voice_actor_name: Optional[str] = None
    voice_actor_image: Optional[str] = None

    model_config = {
        "from_attributes": True
    }


class RelationSchema(BaseModel):
    relation_type: str
    anime: AnimeSummarySchema

    model_config = {
        "from_attributes": True
    }


class AnimeDetailSchema(BaseModel):
    id: int
    anilist_id: int
    slug: str
    title: TitleSchema
    description: Optional[str] = None
    format: Optional[str] = None
    status: Optional[str] = None
    source_material: Optional[str] = None
    season: Optional[str] = None
    season_year: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    episode_count: Optional[int] = None
    episode_duration: Optional[int] = None
    country_code: Optional[str] = None
    is_adult: bool
    average_score: Optional[float] = None
    popularity: int
    favourites: int
    cover_large_url: Optional[str] = None
    banner_url: Optional[str] = None
    official_site_url: Optional[str] = None
    genres: List[str] = []
    tags: List[str] = []
    studios: List[str] = []

    model_config = {
        "from_attributes": True
    }
