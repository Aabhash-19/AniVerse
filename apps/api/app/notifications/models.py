import enum
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, Boolean, DateTime, ForeignKey, Enum, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.auth.models import User
from app.anime.models import Anime

class NotificationType(str, enum.Enum):
    NEW_EPISODE = "NEW_EPISODE"
    NEW_TRAILER = "NEW_TRAILER"
    PREMIERE = "PREMIERE"
    SEQUEL_ANNOUNCEMENT = "SEQUEL_ANNOUNCEMENT"
    STATUS_CHANGE = "STATUS_CHANGE"
    NEW_PV = "NEW_PV"
    REPLY_COMMENT = "REPLY_COMMENT"
    REPLY_REVIEW = "REPLY_REVIEW"
    NEW_FOLLOWER = "NEW_FOLLOWER"
    REVIEW_LIKE = "REVIEW_LIKE"
    MAINTENANCE = "MAINTENANCE"
    ACCOUNT_UPDATE = "ACCOUNT_UPDATE"

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    notification_type = Column(Enum(NotificationType, name="notificationtype"), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    entity_type = Column(String(50), nullable=True)  # "anime", "discussion", "comment", "review"
    entity_id = Column(String(100), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    read_at = Column(DateTime, nullable=True)

    user = relationship("User", backref="notifications_received")

class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    episodes_enabled = Column(Boolean, default=True, nullable=False)
    trailers_enabled = Column(Boolean, default=True, nullable=False)
    movies_enabled = Column(Boolean, default=True, nullable=False)
    replies_enabled = Column(Boolean, default=True, nullable=False)
    followers_enabled = Column(Boolean, default=True, nullable=False)
    emails_enabled = Column(Boolean, default=True, nullable=False)
    push_enabled = Column(Boolean, default=True, nullable=False)

    user = relationship("User", backref="notification_preferences")

class AnimeSubscription(Base):
    __tablename__ = "anime_subscriptions"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    anime_id = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), primary_key=True)
    trailer_alerts = Column(Boolean, default=True, nullable=False)
    episode_alerts = Column(Boolean, default=True, nullable=False)
    news_alerts = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", backref="anime_subscriptions")
    anime = relationship("Anime", backref="subscribers")
