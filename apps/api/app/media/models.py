import enum
from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Text, Boolean, DECIMAL, DateTime, ForeignKey, Enum, UniqueConstraint, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class VerificationStatus(str, enum.Enum):
    VERIFIED = "VERIFIED"
    UNVERIFIED = "UNVERIFIED"


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class VideoProvider(str, enum.Enum):
    YOUTUBE = "YOUTUBE"
    CRUNCHYROLL = "CRUNCHYROLL"
    NETFLIX = "NETFLIX"
    BILIBILI = "BILIBILI"


class VideoType(str, enum.Enum):
    TRAILER = "TRAILER"
    TEASER = "TEASER"
    OPENING = "OPENING"
    ENDING = "ENDING"
    CLIP = "CLIP"
    FULL_EPISODE = "FULL_EPISODE"


class CandidateStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class OfficialChannel(Base):
    __tablename__ = "official_channels"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    youtube_channel_id = Column(String, unique=True, nullable=False, index=True)
    channel_name = Column(String, nullable=False)
    organization_name = Column(String, nullable=True)
    country_code = Column(String(2), nullable=True)
    official_site_url = Column(Text, nullable=True)
    verification_status = Column(Enum(VerificationStatus, name="verificationstatus"), nullable=False, default=VerificationStatus.VERIFIED)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    risk_level = Column(Enum(RiskLevel, name="risklevel"), nullable=False, default=RiskLevel.LOW)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Video(Base):
    __tablename__ = "videos"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    anime_id = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), nullable=False, index=True)
    episode_id = Column(BigInteger, ForeignKey("episodes.id", ondelete="SET NULL"), nullable=True)
    provider = Column(Enum(VideoProvider, name="videoprovider"), nullable=False, default=VideoProvider.YOUTUBE)
    provider_video_id = Column(String, nullable=False, index=True)
    video_type = Column(Enum(VideoType, name="videotype"), nullable=False, default=VideoType.TRAILER)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    thumbnail_url = Column(Text, nullable=True)
    channel_id = Column(BigInteger, ForeignKey("official_channels.id", ondelete="SET NULL"), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    language = Column(String, default="Japanese", nullable=False)
    published_at = Column(DateTime, nullable=True)
    verification_status = Column(Enum(VerificationStatus, name="verificationstatus"), nullable=False, default=VerificationStatus.VERIFIED)
    confidence_score = Column(DECIMAL(5, 2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    anime = relationship("Anime")
    episode = relationship("Episode")

    __table_args__ = (
        UniqueConstraint("provider", "provider_video_id", name="uq_provider_video_id"),
    )


class VideoCandidate(Base):
    __tablename__ = "video_candidates"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    anime_id = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_video_id = Column(String, nullable=False, index=True)
    raw_payload = Column(JSON, nullable=True)
    confidence_score = Column(DECIMAL(5, 2), nullable=True)
    matched_rules = Column(JSON, nullable=True)
    status = Column(Enum(CandidateStatus, name="candidatestatus"), nullable=False, default=CandidateStatus.PENDING)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
