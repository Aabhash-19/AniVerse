from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from uuid import UUID

class NotificationResponse(BaseModel):
    id: UUID
    notification_type: str
    title: str
    message: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationPreferencesResponse(BaseModel):
    episodes_enabled: bool
    trailers_enabled: bool
    movies_enabled: bool
    replies_enabled: bool
    followers_enabled: bool
    emails_enabled: bool
    push_enabled: bool

    class Config:
        from_attributes = True

class NotificationPreferencesUpdate(BaseModel):
    episodes_enabled: Optional[bool] = None
    trailers_enabled: Optional[bool] = None
    movies_enabled: Optional[bool] = None
    replies_enabled: Optional[bool] = None
    followers_enabled: Optional[bool] = None
    emails_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None

class AnimeSubscriptionResponse(BaseModel):
    anime_id: int
    trailer_alerts: bool
    episode_alerts: bool
    news_alerts: bool

    class Config:
        from_attributes = True

class AnimeSubscriptionToggle(BaseModel):
    trailer_alerts: Optional[bool] = True
    episode_alerts: Optional[bool] = True
    news_alerts: Optional[bool] = True

class AiringEpisodeEvent(BaseModel):
    anime_id: int
    anime_title: str
    cover_url: Optional[str]
    episode_number: float
    airing_at: datetime
    countdown_seconds: int
    trailer_url: Optional[str] = None
    season: Optional[str] = None
    format: Optional[str] = None
    audio_type: Optional[str] = "SUB & DUB"
