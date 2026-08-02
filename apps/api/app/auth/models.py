import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class UserRole(str, enum.Enum):
    USER = "USER"
    CURATOR = "CURATOR"
    MODERATOR = "MODERATOR"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"


class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"


class UserPreferredLanguage(str, enum.Enum):
    ROMAJI = "ROMAJI"
    ENGLISH = "ENGLISH"
    NATIVE = "NATIVE"


class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    display_name = Column(String, nullable=True)
    password_hash = Column(String, nullable=True)
    avatar_url = Column(Text, nullable=True)
    banner_url = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    role = Column(Enum(UserRole, name="userrole"), nullable=False, default=UserRole.USER)
    status = Column(Enum(UserStatus, name="userstatus"), nullable=False, default=UserStatus.ACTIVE)
    email_verified = Column(Boolean, default=False, nullable=False)
    preferred_language = Column(String, default="English", nullable=False)
    timezone = Column(String, default="UTC", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)

    # Relationships
    preferences = relationship("UserPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    list_entries = relationship("AnimeListEntry", back_populates="user", cascade="all, delete-orphan")


class UserPreference(Base):
    __tablename__ = "user_preferences"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    adult_content_enabled = Column(Boolean, default=False, nullable=False)
    autoplay_videos = Column(Boolean, default=True, nullable=False)
    email_notifications = Column(Boolean, default=True, nullable=False)
    push_notifications = Column(Boolean, default=False, nullable=False)
    profile_visibility = Column(String, default="PUBLIC", nullable=False)  # PUBLIC, PRIVATE
    list_visibility = Column(String, default="PUBLIC", nullable=False)     # PUBLIC, PRIVATE
    theme = Column(String, default="DARK", nullable=False)
    preferred_title_language = Column(Enum(UserPreferredLanguage, name="userpreferredlanguage"), nullable=False, default=UserPreferredLanguage.ENGLISH)

    user = relationship("User", back_populates="preferences")


class UserSession(Base):
    __tablename__ = "user_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    refresh_token_hash = Column(String, nullable=False)
    ip_hash = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="sessions")
