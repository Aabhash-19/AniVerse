import enum
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, Boolean, DECIMAL,
    DateTime, ForeignKey, Enum, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import relationship
from app.database import Base
from app.auth.models import User
from app.anime.models import Anime

class UserEventType(str, enum.Enum):
    IMPRESSION = "IMPRESSION"
    PLAY = "PLAY"
    PAUSE = "PAUSE"
    COMPLETE = "COMPLETE"
    LIKE = "LIKE"
    WATCHLIST_ADD = "WATCHLIST_ADD"
    SHARE = "SHARE"
    RECOMMENDATION_INTEREST = "RECOMMENDATION_INTEREST"
    RECOMMENDATION_DISINTEREST = "RECOMMENDATION_DISINTEREST"

class AnimeEmbedding(Base):
    __tablename__ = "anime_embeddings"

    anime_id = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), primary_key=True)
    model_name = Column(String(100), nullable=False)
    embedding = Column(Vector(384), nullable=False)  # 384 dimensions for all-MiniLM-L6-v2
    content_hash = Column(String(64), nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    anime = relationship("Anime", backref="vector_embedding")

class UserEmbedding(Base):
    __tablename__ = "user_embeddings"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    model_name = Column(String(100), nullable=False)
    embedding = Column(Vector(384), nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", backref="vector_embedding")

class RecommendationResult(Base):
    __tablename__ = "recommendation_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    anime_id = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), nullable=False)
    score = Column(DECIMAL(5, 4), nullable=False)
    reason_codes = Column(JSONB, nullable=False)  # List of reasons
    model_version = Column(String(50), nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)

    user = relationship("User", backref="recommendations")
    anime = relationship("Anime", backref="recommendation_mentions")

class UserEvent(Base):
    __tablename__ = "user_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    session_id = Column(UUID(as_uuid=True), nullable=True)
    event_type = Column(Enum(UserEventType, name="usereventtype"), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)  # "anime", "video", "discussion"
    entity_id = Column(String(100), nullable=False)
    action_metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", backref="events")
