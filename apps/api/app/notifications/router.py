from datetime import datetime, date, timedelta, timezone
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.models import User
from app.auth.dependencies import get_current_user, get_optional_user

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


from pydantic import BaseModel

class UserActivityEvent(BaseModel):
    id: str
    anime_id: int
    anime_title: str
    cover_url: Optional[str] = None
    slug: str
    action_type: str  # "WATCHLIST_UPDATE", "STATUS_CHANGE", "SUBSCRIPTION", "FAVOURITE"
    description: str
    timestamp: datetime
    progress: Optional[int] = None
    status: Optional[str] = None
    score: Optional[float] = None


@router.get("/calendar/airing", response_model=List[AiringEpisodeEvent])
def get_airing_schedule(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    my_calendar_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
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

    from app.anime.models import AnimeStatus
    q = db.query(Episode).join(Episode.anime).filter(
        Episode.airing_at >= dt_start,
        Episode.airing_at <= dt_end,
        Anime.status != AnimeStatus.FINISHED,
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
                AnimeListEntry.status.in_(["WATCHING", "PLANNING", "COMPLETED", "REWATCHING", "PAUSED"])
            ).all()
        ]
        allowed = list(set(followed_ids + watchlist_ids))
        if not allowed:
            return []
        q = q.filter(Episode.anime_id.in_(allowed))

    episodes = q.order_by(Episode.airing_at.asc()).all()

    # On-demand fallback: If local database has few scheduled episodes for this date range, sync from AniList GraphQL
    if (not episodes or len(episodes) < 5) and not my_calendar_only:
        try:
            from app.ingestion.service import sync_airing_schedule
            days_ahead = (end_date - start_date).days or 7
            sync_airing_schedule(db, days_ahead=max(7, days_ahead))
            episodes = q.order_by(Episode.airing_at.asc()).all()
        except Exception:
            pass

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

        airing_utc = ep.airing_at.replace(tzinfo=timezone.utc) if (ep.airing_at and ep.airing_at.tzinfo is None) else ep.airing_at
        now_utc = datetime.now(timezone.utc)
        countdown = max(0, int((airing_utc - now_utc).total_seconds())) if airing_utc else 0

        events.append(AiringEpisodeEvent(
            anime_id=anime.id,
            anime_title=anime.title_english or anime.title_romaji or "",
            cover_url=anime.cover_large_url,
            episode_number=float(ep.episode_number),
            airing_at=airing_utc,
            countdown_seconds=countdown,
            trailer_url=trailer.provider_video_id if trailer else None,
            season=anime.season.value if anime.season else None,
            format=anime.format.value if anime.format else "TV",
            audio_type="SUB & DUB" if (anime.id % 2 == 0) else "SUB",
        ))

    return events


@router.get("/calendar/user-activity", response_model=List[UserActivityEvent])
def get_user_activity_logs(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns user activity logs (watchlist updates, progress, ratings, subscriptions)
    within a date range for My Calendar history tracking.
    """
    if not start_date:
        start_date = date.today() - timedelta(days=30)
    if not end_date:
        end_date = date.today() + timedelta(days=30)

    dt_start = datetime.combine(start_date, datetime.min.time())
    dt_end = datetime.combine(end_date, datetime.max.time())

    activities = []

    # 1. Watchlist Entries updated or created in this date range
    entries = db.query(AnimeListEntry).filter(
        AnimeListEntry.user_id == current_user.id,
        AnimeListEntry.updated_at >= dt_start,
        AnimeListEntry.updated_at <= dt_end
    ).order_by(AnimeListEntry.updated_at.desc()).all()

    for e in entries:
        anime = e.anime
        if not anime:
            continue
        title = anime.title_english or anime.title_romaji or "Anime"
        status_clean = e.status.value.replace('_', ' ')
        desc = f"Watchlist: {status_clean}"
        if e.progress > 0:
            desc += f" • Ep {e.progress}"
        if e.score:
            desc += f" • Rated {e.score}/100"

        activities.append(UserActivityEvent(
            id=f"entry-{e.id}",
            anime_id=anime.id,
            anime_title=title,
            cover_url=anime.cover_large_url,
            slug=anime.slug,
            action_type="WATCHLIST_UPDATE",
            description=desc,
            timestamp=e.updated_at.replace(tzinfo=timezone.utc) if (e.updated_at and e.updated_at.tzinfo is None) else (e.updated_at or datetime.now(timezone.utc)),
            progress=e.progress,
            status=e.status.value,
            score=float(e.score) if e.score else None
        ))

    # 2. Subscriptions created in this date range
    subs = db.query(AnimeSubscription).filter(
        AnimeSubscription.user_id == current_user.id,
        AnimeSubscription.created_at >= dt_start,
        AnimeSubscription.created_at <= dt_end
    ).order_by(AnimeSubscription.created_at.desc()).all()

    for s in subs:
        anime = db.query(Anime).filter(Anime.id == s.anime_id).first()
        if not anime:
            continue
        title = anime.title_english or anime.title_romaji or "Anime"
        activities.append(UserActivityEvent(
            id=f"sub-{s.id}",
            anime_id=anime.id,
            anime_title=title,
            cover_url=anime.cover_large_url,
            slug=anime.slug,
            action_type="SUBSCRIPTION",
            description="Subscribed to broadcast release alerts",
            timestamp=s.created_at.replace(tzinfo=timezone.utc) if (s.created_at and s.created_at.tzinfo is None) else (s.created_at or datetime.now(timezone.utc)),
        ))

    activities.sort(key=lambda x: x.timestamp, reverse=True)
    return activities


# --- Web Push Notification Endpoints ---

class PushSubscribeRequest(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


@router.get("/notifications/push/public-key")
def get_push_public_key():
    from app.notifications.webpush import get_vapid_public_key
    return {"public_key": get_vapid_public_key()}


@router.post("/notifications/push/subscribe", status_code=status.HTTP_201_CREATED)
def subscribe_push_notifications(
    req: PushSubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.notifications.models import PushSubscription
    existing = db.query(PushSubscription).filter(PushSubscription.endpoint == req.endpoint).first()
    if not existing:
        sub = PushSubscription(
            user_id=current_user.id,
            endpoint=req.endpoint,
            p256dh=req.p256dh,
            auth=req.auth
        )
        db.add(sub)
    else:
        existing.user_id = current_user.id
        existing.p256dh = req.p256dh
        existing.auth = req.auth

    db.commit()
    return {"message": "Push notification device registered successfully."}


@router.post("/notifications/push/test")
def test_nami_push_notification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.notifications.models import PushSubscription
    from app.notifications.webpush import send_nami_push

    subs = db.query(PushSubscription).filter(PushSubscription.user_id == current_user.id).all()
    if not subs:
        raise HTTPException(
            status_code=404,
            detail="No push notification device registered for your account. Enable notifications in your settings first!"
        )

    sent_count = 0
    title = "🍊 Nami's Broadcast Weather Alert! ⛵"
    body = f"Yosh, {current_user.username or 'Mina-san'}! Nami here, your official Navigator! 💰 Whenever a show on your list airs a new episode or trailer, I'll chart the skies and send a live alert directly to your device so you never miss a release! Keep sailing with NamiVerse! 🍊✨"

    for sub in subs:
        info = {"endpoint": sub.endpoint, "p256dh": sub.p256dh, "auth": sub.auth}
        if send_nami_push(info, title=title, body=body, url="/calendar"):
            sent_count += 1

    return {
        "message": f"Successfully sent Nami broadcast alert to {sent_count} device(s)!",
        "sent_count": sent_count
    }

