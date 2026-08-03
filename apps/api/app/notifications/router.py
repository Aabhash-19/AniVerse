from datetime import datetime, date, timedelta
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.models import User
from app.auth.dependencies import get_current_user
from app.anime.models import Anime, Episode
from app.lists.models import AnimeListEntry
from app.notifications.models import Notification, NotificationPreference, AnimeSubscription, NotificationType
from app.notifications.schemas import (
    NotificationResponse, NotificationPreferencesResponse, NotificationPreferencesUpdate,
    AnimeSubscriptionResponse, AnimeSubscriptionToggle, AiringEpisodeEvent
)
from app.notifications.service import get_or_create_preferences, create_notification

router = APIRouter(tags=["Calendar & Notifications"])


@router.get("/notifications", response_model=List[NotificationResponse])
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves the user's notification inbox."""
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        q = q.filter(Notification.is_read == False)
    return q.order_by(Notification.created_at.desc()).limit(limit).all()


@router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse)
def mark_as_read(
    notification_id: UUID = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Marks a specific notification as read."""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found.")
    notification.is_read = True
    notification.read_at = datetime.utcnow()
    db.commit()
    db.refresh(notification)
    return notification


@router.post("/notifications/read-all")
def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bulk marks all unread notifications as read."""
    unread = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).all()
    now = datetime.utcnow()
    for n in unread:
        n.is_read = True
        n.read_at = now
    db.commit()
    return {"message": f"Marked {len(unread)} notifications as read."}


@router.delete("/notifications/{notification_id}", status_code=204)
def delete_notification(
    notification_id: UUID = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deletes a specific notification."""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found.")
    db.delete(notification)
    db.commit()
    return None


@router.get("/notification-preferences", response_model=NotificationPreferencesResponse)
def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Gets delivery preferences for the authenticated user."""
    return get_or_create_preferences(db, current_user.id)


@router.put("/notification-preferences", response_model=NotificationPreferencesResponse)
def update_preferences(
    data: NotificationPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Updates delivery preferences for the authenticated user."""
    pref = get_or_create_preferences(db, current_user.id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(pref, field, value)
    db.commit()
    db.refresh(pref)
    return pref


@router.post("/anime/{anime_id}/subscribe", response_model=AnimeSubscriptionResponse)
def toggle_anime_subscription(
    anime_id: int = Path(...),
    data: Optional[AnimeSubscriptionToggle] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Follows or updates alert settings for an anime. Calling again with no body unfollows."""
    anime = db.query(Anime).filter(
        (Anime.id == anime_id) | (Anime.anilist_id == anime_id)
    ).first()
    if not anime:
        raise HTTPException(status_code=404, detail="Anime not found.")

    sub = db.query(AnimeSubscription).filter(
        AnimeSubscription.user_id == current_user.id,
        AnimeSubscription.anime_id == anime.id
    ).first()

    if sub and data is None:
        # Unfollow
        db.delete(sub)
        db.commit()
        return AnimeSubscriptionResponse(
            anime_id=anime.id, trailer_alerts=False,
            episode_alerts=False, news_alerts=False
        )

    if sub:
        # Update alert settings
        for field, value in (data.model_dump(exclude_none=True) if data else {}).items():
            setattr(sub, field, value)
        db.commit()
        db.refresh(sub)
        return sub

    # New follow
    sub = AnimeSubscription(
        user_id=current_user.id,
        anime_id=anime.id,
        trailer_alerts=data.trailer_alerts if data else True,
        episode_alerts=data.episode_alerts if data else True,
        news_alerts=data.news_alerts if data else True,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.get("/anime/{anime_id}/subscription", response_model=Optional[AnimeSubscriptionResponse])
def get_anime_subscription(
    anime_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the current follow subscription state for an anime."""
    anime = db.query(Anime).filter(
        (Anime.id == anime_id) | (Anime.anilist_id == anime_id)
    ).first()
    if not anime:
        return None
    return db.query(AnimeSubscription).filter(
        AnimeSubscription.user_id == current_user.id,
        AnimeSubscription.anime_id == anime.id
    ).first()


@router.get("/calendar/airing", response_model=List[AiringEpisodeEvent])
def get_airing_schedule(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    my_calendar_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(lambda: None),
):
    """
    Returns episode airing events within a date range.
    Set my_calendar_only=true to show only followed / watchlist anime (requires auth).
    """
    if not start_date:
        start_date = date.today()
    if not end_date:
        end_date = start_date + timedelta(days=7)

    dt_start = datetime.combine(start_date, datetime.min.time())
    dt_end = datetime.combine(end_date, datetime.max.time())

    q = db.query(Episode).filter(
        Episode.airing_at >= dt_start,
        Episode.airing_at <= dt_end,
    )

    if my_calendar_only:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required for My Calendar.")
        followed_ids = [
            s.anime_id for s in db.query(AnimeSubscription)
            .filter(AnimeSubscription.user_id == current_user.id).all()
        ]
        watchlist_ids = [
            e.anime_id for e in db.query(AnimeListEntry).filter(
                AnimeListEntry.user_id == current_user.id,
                AnimeListEntry.status.in_(["WATCHING", "PLANNING"])
            ).all()
        ]
        allowed = list(set(followed_ids + watchlist_ids))
        if not allowed:
            return []
        q = q.filter(Episode.anime_id.in_(allowed))

    episodes = q.order_by(Episode.airing_at.asc()).all()
    now = datetime.utcnow()
    events = []

    for ep in episodes:
        anime = ep.anime
        if not anime:
            continue

        from app.media.models import Video
        trailer = db.query(Video).filter(
            Video.anime_id == anime.id,
            Video.video_type == "TRAILER"
        ).first()

        events.append(AiringEpisodeEvent(
            anime_id=anime.id,
            anime_title=anime.title_english or anime.title_romaji or "",
            cover_url=anime.cover_large_url,
            episode_number=float(ep.episode_number),
            airing_at=ep.airing_at,
            countdown_seconds=max(0, int((ep.airing_at - now).total_seconds())),
            trailer_url=trailer.provider_video_id if trailer else None,
            season=anime.season.value if anime.season else None,
        ))

    return events
