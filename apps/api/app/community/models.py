import enum
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, Boolean,
    DateTime, ForeignKey, Enum, UniqueConstraint, Index, SmallInteger
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


# ── Enums ──────────────────────────────────────────────────────────────────

class ModerationStatus(str, enum.Enum):
    VISIBLE  = "VISIBLE"
    PENDING  = "PENDING"
    HIDDEN   = "HIDDEN"
    REMOVED  = "REMOVED"


class ReactionType(str, enum.Enum):
    LIKE        = "LIKE"
    LOVE        = "LOVE"
    INSIGHTFUL  = "INSIGHTFUL"
    FUNNY       = "FUNNY"


class ReportReason(str, enum.Enum):
    SPAM          = "SPAM"
    HARASSMENT    = "HARASSMENT"
    SPOILER       = "SPOILER"
    MISINFORMATION = "MISINFORMATION"
    INAPPROPRIATE = "INAPPROPRIATE"
    OTHER         = "OTHER"


class ReportStatus(str, enum.Enum):
    OPEN     = "OPEN"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class ModerationAction(str, enum.Enum):
    HIDE    = "HIDE"
    REMOVE  = "REMOVE"
    RESTORE = "RESTORE"
    WARN    = "WARN"
    DISMISS = "DISMISS"


# ── Reviews ────────────────────────────────────────────────────────────────

class Review(Base):
    __tablename__ = "reviews"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    anime_id    = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), nullable=False, index=True)
    score       = Column(SmallInteger, nullable=True)          # 1-100
    body        = Column(Text, nullable=False)
    has_spoiler = Column(Boolean, default=False, nullable=False)
    status      = Column(Enum(ModerationStatus, name="reviewstatus"), nullable=False, default=ModerationStatus.VISIBLE)
    helpful_count = Column(Integer, default=0, nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user        = relationship("User")
    anime       = relationship("Anime")
    reactions   = relationship("ReviewReaction", back_populates="review", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("user_id", "anime_id", name="uq_user_anime_review"),
        Index("ix_reviews_anime_status", "anime_id", "status"),
    )


class ReviewReaction(Base):
    """A user's like/love/insightful reaction on a review."""
    __tablename__ = "review_reactions"

    user_id   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    review_id = Column(UUID(as_uuid=True), ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False)
    reaction  = Column(Enum(ReactionType, name="reactiontype"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    review = relationship("Review", back_populates="reactions")

    __table_args__ = (
        UniqueConstraint("user_id", "review_id", name="uq_user_review_reaction"),
    )

    from sqlalchemy import PrimaryKeyConstraint
    __table_args__ = (
        PrimaryKeyConstraint("user_id", "review_id", name="pk_review_reactions"),
        UniqueConstraint("user_id", "review_id", name="uq_user_review_reaction"),
    )


# ── Discussions ────────────────────────────────────────────────────────────

class Discussion(Base):
    __tablename__ = "discussions"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    anime_id    = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), nullable=False, index=True)
    episode     = Column(SmallInteger, nullable=True)   # None = general discussion
    title       = Column(String(300), nullable=False)
    body        = Column(Text, nullable=False)
    has_spoiler = Column(Boolean, default=False, nullable=False)
    is_pinned   = Column(Boolean, default=False, nullable=False)
    status      = Column(Enum(ModerationStatus, name="discussionstatus"), nullable=False, default=ModerationStatus.VISIBLE)
    comment_count = Column(Integer, default=0, nullable=False)
    view_count  = Column(Integer, default=0, nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user     = relationship("User")
    anime    = relationship("Anime")
    comments = relationship("Comment", back_populates="discussion", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_discussions_anime_episode", "anime_id", "episode"),
    )


# ── Comments ───────────────────────────────────────────────────────────────

class Comment(Base):
    __tablename__ = "comments"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    discussion_id = Column(UUID(as_uuid=True), ForeignKey("discussions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id     = Column(UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)  # nested replies
    body          = Column(Text, nullable=False)
    has_spoiler   = Column(Boolean, default=False, nullable=False)
    status        = Column(Enum(ModerationStatus, name="commentstatus"), nullable=False, default=ModerationStatus.VISIBLE)
    like_count    = Column(Integer, default=0, nullable=False)
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user       = relationship("User")
    discussion = relationship("Discussion", back_populates="comments")
    replies    = relationship("Comment", back_populates="parent", cascade="all, delete-orphan")
    parent     = relationship("Comment", back_populates="replies", remote_side="Comment.id")
    likes      = relationship("CommentLike", back_populates="comment", cascade="all, delete-orphan")


class CommentLike(Base):
    __tablename__ = "comment_likes"

    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    comment_id = Column(UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    comment = relationship("Comment", back_populates="likes")

    from sqlalchemy import PrimaryKeyConstraint
    __table_args__ = (
        PrimaryKeyConstraint("user_id", "comment_id", name="pk_comment_likes"),
    )


# ── Reports ────────────────────────────────────────────────────────────────

class Report(Base):
    __tablename__ = "reports"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    # Polymorphic target: review, discussion, or comment
    target_type     = Column(String(20), nullable=False)   # "review" | "discussion" | "comment"
    target_id       = Column(UUID(as_uuid=True), nullable=False)
    reason          = Column(Enum(ReportReason, name="reportreason"), nullable=False)
    description     = Column(Text, nullable=True)
    status          = Column(Enum(ReportStatus, name="reportstatus"), nullable=False, default=ReportStatus.OPEN)
    resolved_by_id  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at     = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    reporter    = relationship("User", foreign_keys=[reporter_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])

    __table_args__ = (
        Index("ix_reports_status_created", "status", "created_at"),
    )


# ── User Blocks ────────────────────────────────────────────────────────────

class UserBlock(Base):
    __tablename__ = "user_blocks"

    blocker_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    blocked_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    blocker = relationship("User", foreign_keys=[blocker_id])
    blocked = relationship("User", foreign_keys=[blocked_id])

    from sqlalchemy import PrimaryKeyConstraint
    __table_args__ = (
        PrimaryKeyConstraint("blocker_id", "blocked_id", name="pk_user_blocks"),
    )


# AuditLog table is imported from app.admin.models to avoid collision.
