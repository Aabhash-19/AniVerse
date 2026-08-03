import uuid
import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.auth.models import User, UserRole
from app.auth.dependencies import get_current_user
from app.anime.models import Anime
from app.community.models import (
    Review, ReviewReaction, Discussion, Comment, CommentLike,
    Report, UserBlock,
    ModerationStatus, ReactionType, ReportReason, ReportStatus, ModerationAction
)
from app.admin.models import AuditLog

logger = logging.getLogger("community_router")

router = APIRouter(tags=["Community"])


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def require_moderator(user: User) -> User:
    if user.role not in (UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=403, detail="Moderator access required.")
    return user


def _user_is_blocked(db: Session, viewer_id, author_id) -> bool:
    if viewer_id == author_id:
        return False
    from sqlalchemy import or_
    block = db.query(UserBlock).filter(
        UserBlock.blocker_id == viewer_id,
        UserBlock.blocked_id == author_id
    ).first()
    return block is not None


def _write_audit(db: Session, moderator: User, action: ModerationAction, target_type: str, target_id, reason: str = None):
    log = AuditLog(
        actor_id=moderator.id,
        action=action.value,
        entity_type=target_type,
        entity_id=str(target_id),
        after_data={"reason": reason} if reason else None
    )
    db.add(log)


# ─────────────────────────────────────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class UserMini(BaseModel):
    id: str
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    model_config = {"from_attributes": True}


class ReviewCreate(BaseModel):
    score: Optional[int] = Field(None, ge=1, le=100)
    body: str = Field(..., min_length=20, max_length=10000)
    has_spoiler: bool = False


class ReviewUpdate(BaseModel):
    score: Optional[int] = Field(None, ge=1, le=100)
    body: Optional[str] = Field(None, min_length=20, max_length=10000)
    has_spoiler: Optional[bool] = None


class ReviewResponse(BaseModel):
    id: str
    anime_id: int
    score: Optional[int]
    body: str
    has_spoiler: bool
    status: str
    helpful_count: int
    created_at: datetime
    updated_at: datetime
    user: UserMini
    reaction_counts: dict
    user_reaction: Optional[str] = None
    model_config = {"from_attributes": True}


class DiscussionCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=300)
    body: str = Field(..., min_length=10, max_length=20000)
    episode: Optional[int] = Field(None, ge=1)
    has_spoiler: bool = False


class DiscussionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=5, max_length=300)
    body: Optional[str] = Field(None, min_length=10, max_length=20000)
    has_spoiler: Optional[bool] = None


class DiscussionResponse(BaseModel):
    id: str
    anime_id: int
    episode: Optional[int]
    title: str
    body: str
    has_spoiler: bool
    is_pinned: bool
    status: str
    comment_count: int
    view_count: int
    created_at: datetime
    updated_at: datetime
    user: UserMini
    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)
    has_spoiler: bool = False
    parent_id: Optional[str] = None


class CommentResponse(BaseModel):
    id: str
    discussion_id: str
    parent_id: Optional[str]
    body: str
    has_spoiler: bool
    status: str
    like_count: int
    created_at: datetime
    updated_at: datetime
    user: UserMini
    reply_count: int = 0
    model_config = {"from_attributes": True}


class ReportCreate(BaseModel):
    target_type: str = Field(..., pattern="^(review|discussion|comment)$")
    target_id: str
    reason: ReportReason
    description: Optional[str] = Field(None, max_length=1000)


class ModerationDecision(BaseModel):
    action: ModerationAction
    reason: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# REVIEWS
# ─────────────────────────────────────────────────────────────────────────────

def _build_review_response(review: Review, db: Session, current_user: Optional[User]) -> dict:
    reaction_counts = {}
    for r in review.reactions:
        reaction_counts[r.reaction.value] = reaction_counts.get(r.reaction.value, 0) + 1

    user_reaction = None
    if current_user:
        ur = db.query(ReviewReaction).filter(
            ReviewReaction.review_id == review.id,
            ReviewReaction.user_id == current_user.id
        ).first()
        if ur:
            user_reaction = ur.reaction.value

    return {
        "id": str(review.id),
        "anime_id": review.anime_id,
        "score": review.score,
        "body": review.body,
        "has_spoiler": review.has_spoiler,
        "status": review.status.value,
        "helpful_count": review.helpful_count,
        "created_at": review.created_at,
        "updated_at": review.updated_at,
        "user": {
            "id": str(review.user.id),
            "username": review.user.username,
            "display_name": review.user.display_name,
            "avatar_url": review.user.avatar_url,
        },
        "reaction_counts": reaction_counts,
        "user_reaction": user_reaction,
    }


@router.get("/anime/{anime_id}/reviews")
def list_reviews(
    anime_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(lambda: None)
):
    """List visible reviews for an anime, newest first."""
    anime = db.query(Anime).filter((Anime.id == anime_id) | (Anime.anilist_id == anime_id)).first()
    if not anime:
        raise HTTPException(status_code=404, detail="Anime not found.")

    q = db.query(Review).filter(
        Review.anime_id == anime.id,
        Review.status == ModerationStatus.VISIBLE
    ).order_by(Review.helpful_count.desc(), Review.created_at.desc())

    total = q.count()
    reviews = q.offset((page - 1) * per_page).limit(per_page).all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "items": [_build_review_response(r, db, current_user) for r in reviews]
    }


@router.post("/anime/{anime_id}/reviews", status_code=201)
def create_review(
    anime_id: int,
    data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit a review for an anime (one per user)."""
    anime = db.query(Anime).filter((Anime.id == anime_id) | (Anime.anilist_id == anime_id)).first()
    if not anime:
        raise HTTPException(status_code=404, detail="Anime not found.")

    existing = db.query(Review).filter(
        Review.user_id == current_user.id,
        Review.anime_id == anime.id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You have already reviewed this anime. Edit your existing review.")

    review = Review(
        user_id=current_user.id,
        anime_id=anime.id,
        score=data.score,
        body=data.body,
        has_spoiler=data.has_spoiler,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return _build_review_response(review, db, current_user)


@router.patch("/reviews/{review_id}")
def update_review(
    review_id: str,
    data: ReviewUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Edit your own review."""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")
    if str(review.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only edit your own reviews.")

    if data.body is not None:
        review.body = data.body
    if data.score is not None:
        review.score = data.score
    if data.has_spoiler is not None:
        review.has_spoiler = data.has_spoiler
    review.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(review)
    return _build_review_response(review, db, current_user)


@router.delete("/reviews/{review_id}", status_code=204)
def delete_review(
    review_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete your own review (or mod/admin can remove any)."""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")
    is_owner = str(review.user_id) == str(current_user.id)
    is_mod = current_user.role in (UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
    if not (is_owner or is_mod):
        raise HTTPException(status_code=403, detail="Permission denied.")
    db.delete(review)
    db.commit()
    return None


@router.put("/reviews/{review_id}/react/{reaction}", status_code=200)
def react_to_review(
    review_id: str,
    reaction: ReactionType,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle a reaction on a review."""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")

    existing = db.query(ReviewReaction).filter(
        ReviewReaction.user_id == current_user.id,
        ReviewReaction.review_id == review_id
    ).first()

    if existing:
        if existing.reaction == reaction:
            db.delete(existing)
            db.flush()
            review.helpful_count = db.query(ReviewReaction).filter(ReviewReaction.review_id == review_id).count()
            db.commit()
            return {"message": "Reaction removed"}
        else:
            existing.reaction = reaction
            db.commit()
            return {"message": "Reaction updated"}
    else:
        r = ReviewReaction(user_id=current_user.id, review_id=uuid.UUID(review_id), reaction=reaction)
        db.add(r)
        db.flush()
        review.helpful_count = db.query(ReviewReaction).filter(ReviewReaction.review_id == review_id).count()
        db.commit()
        return {"message": "Reaction added"}


# ─────────────────────────────────────────────────────────────────────────────
# DISCUSSIONS
# ─────────────────────────────────────────────────────────────────────────────

def _disc_to_dict(d: Discussion) -> dict:
    return {
        "id": str(d.id),
        "anime_id": d.anime_id,
        "episode": d.episode,
        "title": d.title,
        "body": d.body,
        "has_spoiler": d.has_spoiler,
        "is_pinned": d.is_pinned,
        "status": d.status.value,
        "comment_count": d.comment_count,
        "view_count": d.view_count,
        "created_at": d.created_at,
        "updated_at": d.updated_at,
        "user": {
            "id": str(d.user.id),
            "username": d.user.username,
            "display_name": d.user.display_name,
            "avatar_url": d.user.avatar_url,
        }
    }


@router.get("/anime/{anime_id}/discussions")
def list_discussions(
    anime_id: int,
    episode: Optional[int] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """List discussions for an anime, optionally filtered by episode."""
    anime = db.query(Anime).filter((Anime.id == anime_id) | (Anime.anilist_id == anime_id)).first()
    if not anime:
        raise HTTPException(status_code=404, detail="Anime not found.")

    q = db.query(Discussion).filter(
        Discussion.anime_id == anime.id,
        Discussion.status == ModerationStatus.VISIBLE
    )
    if episode is not None:
        q = q.filter(Discussion.episode == episode)

    q = q.order_by(Discussion.is_pinned.desc(), Discussion.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()

    return {"total": total, "page": page, "per_page": per_page, "items": [_disc_to_dict(d) for d in items]}


@router.post("/anime/{anime_id}/discussions", status_code=201)
def create_discussion(
    anime_id: int,
    data: DiscussionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    anime = db.query(Anime).filter((Anime.id == anime_id) | (Anime.anilist_id == anime_id)).first()
    if not anime:
        raise HTTPException(status_code=404, detail="Anime not found.")

    disc = Discussion(
        user_id=current_user.id,
        anime_id=anime.id,
        title=data.title,
        body=data.body,
        episode=data.episode,
        has_spoiler=data.has_spoiler,
    )
    db.add(disc)
    db.commit()
    db.refresh(disc)
    return _disc_to_dict(disc)


@router.get("/discussions/{discussion_id}")
def get_discussion(discussion_id: str, db: Session = Depends(get_db)):
    disc = db.query(Discussion).filter(Discussion.id == discussion_id).first()
    if not disc or disc.status == ModerationStatus.REMOVED:
        raise HTTPException(status_code=404, detail="Discussion not found.")
    disc.view_count += 1
    db.commit()
    return _disc_to_dict(disc)


@router.patch("/discussions/{discussion_id}")
def update_discussion(
    discussion_id: str,
    data: DiscussionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    disc = db.query(Discussion).filter(Discussion.id == discussion_id).first()
    if not disc:
        raise HTTPException(status_code=404, detail="Discussion not found.")
    if str(disc.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Permission denied.")

    if data.title is not None:
        disc.title = data.title
    if data.body is not None:
        disc.body = data.body
    if data.has_spoiler is not None:
        disc.has_spoiler = data.has_spoiler
    disc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(disc)
    return _disc_to_dict(disc)


@router.delete("/discussions/{discussion_id}", status_code=204)
def delete_discussion(
    discussion_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    disc = db.query(Discussion).filter(Discussion.id == discussion_id).first()
    if not disc:
        raise HTTPException(status_code=404, detail="Discussion not found.")
    is_owner = str(disc.user_id) == str(current_user.id)
    is_mod = current_user.role in (UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
    if not (is_owner or is_mod):
        raise HTTPException(status_code=403, detail="Permission denied.")
    db.delete(disc)
    db.commit()
    return None


# ─────────────────────────────────────────────────────────────────────────────
# COMMENTS
# ─────────────────────────────────────────────────────────────────────────────

def _comment_to_dict(c: Comment, db: Session) -> dict:
    reply_count = db.query(Comment).filter(Comment.parent_id == c.id).count()
    return {
        "id": str(c.id),
        "discussion_id": str(c.discussion_id),
        "parent_id": str(c.parent_id) if c.parent_id else None,
        "body": c.body,
        "has_spoiler": c.has_spoiler,
        "status": c.status.value,
        "like_count": c.like_count,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
        "reply_count": reply_count,
        "user": {
            "id": str(c.user.id),
            "username": c.user.username,
            "display_name": c.user.display_name,
            "avatar_url": c.user.avatar_url,
        }
    }


@router.get("/discussions/{discussion_id}/comments")
def list_comments(
    discussion_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db)
):
    disc = db.query(Discussion).filter(Discussion.id == discussion_id).first()
    if not disc:
        raise HTTPException(status_code=404, detail="Discussion not found.")

    q = db.query(Comment).filter(
        Comment.discussion_id == discussion_id,
        Comment.parent_id == None,  # top-level only
        Comment.status != ModerationStatus.REMOVED
    ).order_by(Comment.created_at.asc())

    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": [_comment_to_dict(c, db) for c in items]}


@router.get("/comments/{comment_id}/replies")
def list_replies(comment_id: str, db: Session = Depends(get_db)):
    replies = db.query(Comment).filter(
        Comment.parent_id == comment_id,
        Comment.status != ModerationStatus.REMOVED
    ).order_by(Comment.created_at.asc()).all()
    return [_comment_to_dict(c, db) for c in replies]


@router.post("/discussions/{discussion_id}/comments", status_code=201)
def create_comment(
    discussion_id: str,
    data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    disc = db.query(Discussion).filter(Discussion.id == discussion_id).first()
    if not disc or disc.status == ModerationStatus.REMOVED:
        raise HTTPException(status_code=404, detail="Discussion not found.")

    # Validate parent exists in same discussion
    parent_uuid = None
    if data.parent_id:
        parent = db.query(Comment).filter(Comment.id == data.parent_id).first()
        if not parent or str(parent.discussion_id) != discussion_id:
            raise HTTPException(status_code=400, detail="Invalid parent comment.")
        parent_uuid = parent.id

    comment = Comment(
        discussion_id=uuid.UUID(discussion_id),
        user_id=current_user.id,
        parent_id=parent_uuid,
        body=data.body,
        has_spoiler=data.has_spoiler,
    )
    db.add(comment)
    disc.comment_count += 1
    db.commit()
    db.refresh(comment)
    return _comment_to_dict(comment, db)


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(
    comment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found.")
    is_owner = str(comment.user_id) == str(current_user.id)
    is_mod = current_user.role in (UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
    if not (is_owner or is_mod):
        raise HTTPException(status_code=403, detail="Permission denied.")
    if comment.discussion:
        comment.discussion.comment_count = max(0, comment.discussion.comment_count - 1)
    db.delete(comment)
    db.commit()
    return None


@router.put("/comments/{comment_id}/like", status_code=200)
def toggle_comment_like(
    comment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found.")

    existing = db.query(CommentLike).filter(
        CommentLike.user_id == current_user.id,
        CommentLike.comment_id == comment_id
    ).first()
    if existing:
        db.delete(existing)
        comment.like_count = max(0, comment.like_count - 1)
        db.commit()
        return {"liked": False, "like_count": comment.like_count}
    else:
        like = CommentLike(user_id=current_user.id, comment_id=uuid.UUID(comment_id))
        db.add(like)
        comment.like_count += 1
        db.commit()
        return {"liked": True, "like_count": comment.like_count}


# ─────────────────────────────────────────────────────────────────────────────
# REPORTS
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/reports", status_code=201)
def submit_report(
    data: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit a report against a review, discussion, or comment."""
    report = Report(
        reporter_id=current_user.id,
        target_type=data.target_type,
        target_id=uuid.UUID(data.target_id),
        reason=data.reason,
        description=data.description,
    )
    db.add(report)
    db.commit()
    return {"message": "Report submitted. Our moderators will review it shortly."}


# ─────────────────────────────────────────────────────────────────────────────
# USER BLOCKING
# ─────────────────────────────────────────────────────────────────────────────

@router.put("/users/{username}/block", status_code=200)
def block_user(
    username: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.auth.models import User as UserModel
    target = db.query(UserModel).filter(UserModel.username == username).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if str(target.id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="You cannot block yourself.")

    existing = db.query(UserBlock).filter(
        UserBlock.blocker_id == current_user.id,
        UserBlock.blocked_id == target.id
    ).first()
    if existing:
        return {"message": f"@{username} is already blocked."}

    block = UserBlock(blocker_id=current_user.id, blocked_id=target.id)
    db.add(block)
    db.commit()
    return {"message": f"@{username} has been blocked."}


@router.delete("/users/{username}/block", status_code=200)
def unblock_user(
    username: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.auth.models import User as UserModel
    target = db.query(UserModel).filter(UserModel.username == username).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    block = db.query(UserBlock).filter(
        UserBlock.blocker_id == current_user.id,
        UserBlock.blocked_id == target.id
    ).first()
    if not block:
        raise HTTPException(status_code=404, detail=f"@{username} is not in your block list.")

    db.delete(block)
    db.commit()
    return {"message": f"@{username} has been unblocked."}


@router.get("/me/blocks")
def get_my_blocks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    blocks = db.query(UserBlock).filter(UserBlock.blocker_id == current_user.id).all()
    return [{"blocked_id": str(b.blocked_id), "username": b.blocked.username} for b in blocks]


# ─────────────────────────────────────────────────────────────────────────────
# MODERATOR DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/moderation/reports")
def list_reports(
    status_filter: ReportStatus = Query(ReportStatus.OPEN),
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    require_moderator(current_user)
    q = db.query(Report).filter(Report.status == status_filter).order_by(Report.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "items": [
            {
                "id": str(r.id),
                "target_type": r.target_type,
                "target_id": str(r.target_id),
                "reason": r.reason.value,
                "description": r.description,
                "status": r.status.value,
                "reporter": r.reporter.username if r.reporter else "anonymous",
                "created_at": r.created_at,
            }
            for r in items
        ]
    }


@router.post("/moderation/reports/{report_id}/resolve", status_code=200)
def resolve_report(
    report_id: str,
    data: ModerationDecision,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    require_moderator(current_user)
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    # Apply action to the target content
    target_obj = None
    if report.target_type == "review":
        target_obj = db.query(Review).filter(Review.id == report.target_id).first()
    elif report.target_type == "discussion":
        target_obj = db.query(Discussion).filter(Discussion.id == report.target_id).first()
    elif report.target_type == "comment":
        target_obj = db.query(Comment).filter(Comment.id == report.target_id).first()

    if target_obj and data.action in (ModerationAction.HIDE, ModerationAction.REMOVE):
        target_obj.status = (
            ModerationStatus.HIDDEN if data.action == ModerationAction.HIDE
            else ModerationStatus.REMOVED
        )
    elif target_obj and data.action == ModerationAction.RESTORE:
        target_obj.status = ModerationStatus.VISIBLE

    report.status = ReportStatus.RESOLVED if data.action != ModerationAction.DISMISS else ReportStatus.DISMISSED
    report.resolved_by_id = current_user.id
    report.resolved_at = datetime.utcnow()

    _write_audit(db, current_user, data.action, report.target_type, report.target_id, data.reason)
    db.commit()
    return {"message": f"Report resolved. Action: {data.action.value}"}


@router.get("/moderation/audit-logs")
def get_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    require_moderator(current_user)
    from app.auth.models import User as UserModel
    q = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()
    
    result_items = []
    for a in items:
        # Fetch username of actor
        actor = db.query(UserModel).filter(UserModel.id == a.actor_id).first() if a.actor_id else None
        reason = a.after_data.get("reason") if a.after_data else None
        result_items.append({
            "id": a.id,
            "moderator": actor.username if actor else "system",
            "action": a.action,
            "target_type": a.entity_type,
            "target_id": a.entity_id,
            "reason": reason,
            "created_at": a.created_at,
        })
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "items": result_items
    }


@router.post("/moderation/content/{target_type}/{target_id}", status_code=200)
def moderate_content_directly(
    target_type: str,
    target_id: str,
    data: ModerationDecision,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Directly apply a moderation action without a report."""
    require_moderator(current_user)
    if target_type not in ("review", "discussion", "comment"):
        raise HTTPException(status_code=400, detail="Invalid target type.")

    target_obj = None
    if target_type == "review":
        target_obj = db.query(Review).filter(Review.id == target_id).first()
    elif target_type == "discussion":
        target_obj = db.query(Discussion).filter(Discussion.id == target_id).first()
    elif target_type == "comment":
        target_obj = db.query(Comment).filter(Comment.id == target_id).first()

    if not target_obj:
        raise HTTPException(status_code=404, detail=f"{target_type.title()} not found.")

    if data.action == ModerationAction.HIDE:
        target_obj.status = ModerationStatus.HIDDEN
    elif data.action == ModerationAction.REMOVE:
        target_obj.status = ModerationStatus.REMOVED
    elif data.action == ModerationAction.RESTORE:
        target_obj.status = ModerationStatus.VISIBLE

    _write_audit(db, current_user, data.action, target_type, uuid.UUID(target_id), data.reason)
    db.commit()
    return {"message": f"Content {data.action.value.lower()}d successfully."}
