import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Text, Boolean, DECIMAL, DateTime, Date, ForeignKey, Enum, UniqueConstraint, PrimaryKeyConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class ListStatus(str, enum.Enum):
    PLANNING = "PLANNING"
    WATCHING = "WATCHING"
    COMPLETED = "COMPLETED"
    PAUSED = "PAUSED"
    DROPPED = "DROPPED"
    REWATCHING = "REWATCHING"


class FavouriteType(str, enum.Enum):
    ANIME = "ANIME"
    CHARACTER = "CHARACTER"
    STAFF = "STAFF"
    STUDIO = "STUDIO"


class AnimeListEntry(Base):
    __tablename__ = "anime_list_entries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    anime_id = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(Enum(ListStatus, name="liststatus"), nullable=False, default=ListStatus.PLANNING)
    progress = Column(Integer, default=0, nullable=False)
    score = Column(DECIMAL(4, 2), nullable=True)
    rewatch_count = Column(Integer, default=0, nullable=False)
    started_at = Column(Date, nullable=True)
    completed_at = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    is_private = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="list_entries")
    anime = relationship("Anime")

    __table_args__ = (
        UniqueConstraint("user_id", "anime_id", name="uq_user_anime_list_entry"),
    )


class Favourite(Base):
    __tablename__ = "favourites"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    entity_type = Column(Enum(FavouriteType, name="favouritetype"), nullable=False)
    entity_id = Column(BigInteger, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        PrimaryKeyConstraint("user_id", "entity_type", "entity_id", name="pk_user_favourites"),
    )
