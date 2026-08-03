import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
import uuid

from app.notifications.models import Notification, NotificationType, NotificationPreference, AnimeSubscription
from app.anime.models import Anime, Episode
from app.media.models import Video

logger = logging.getLogger("notifications_service")

def get_or_create_preferences(db: Session, user_id: uuid.UUID) -> NotificationPreference:
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
    if not pref:
        pref = NotificationPreference(user_id=user_id)
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref

def create_notification(
    db: Session,
    user_id: uuid.UUID,
    notification_type: NotificationType,
    title: str,
    message: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None
) -> Optional[Notification]:
    """
    Creates a notification for a user, respecting their notification preferences.
    """
    pref = get_or_create_preferences(db, user_id)

    # Respect category preference toggles
    if notification_type in (NotificationType.NEW_EPISODE, NotificationType.PREMIERE) and not pref.episodes_enabled:
        return None
    if notification_type in (NotificationType.NEW_TRAILER, NotificationType.NEW_PV) and not pref.trailers_enabled:
        return None
    if notification_type in (NotificationType.REPLY_COMMENT, NotificationType.REPLY_REVIEW, NotificationType.REVIEW_LIKE) and not pref.replies_enabled:
        return None
    if notification_type == NotificationType.NEW_FOLLOWER and not pref.followers_enabled:
        return None

    # Write in-app notification row
    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    # Stub integrations for Email & Web Push delivery
    if pref.emails_enabled:
        logger.info(f" [SMTP STUB] Dispatching email alert to user {user_id}. Subject: '{title}' - Body: '{message}'")
    if pref.push_enabled:
        logger.info(f" [WEB PUSH STUB] Dispatched VAPID browser push notification to user {user_id}. Title: '{title}'")

    return notification

def check_airing_schedule_job(db: Session):
    """
    Scans for episodes airing within the current window and alerts followed users.
    """
    now = datetime.utcnow()
    one_hour_later = now + timedelta(hours=1)

    # Fetch episodes airing in next 60 minutes
    upcoming_episodes = db.query(Episode).filter(
        Episode.airing_at >= now,
        Episode.airing_at <= one_hour_later
    ).all()

    for ep in upcoming_episodes:
        # Avoid repeat notifications (can verify using event type/metadata checks in telemetry logs or cached flags)
        # For simplicity, check if an alert for this episode already exists in DB notifications
        existing = db.query(Notification).filter(
            Notification.notification_type == NotificationType.NEW_EPISODE,
            Notification.entity_type == "anime",
            Notification.entity_id == str(ep.anime_id),
            Notification.title.like(f"%Episode {float(ep.episode_number)}%")
        ).first()

        if existing:
            continue

        anime = ep.anime
        if not anime:
            continue

        # Find subscribed users (following)
        subscribers = db.query(AnimeSubscription).filter(
            AnimeSubscription.anime_id == ep.anime_id,
            AnimeSubscription.episode_alerts == True
        ).all()

        for sub in subscribers:
            create_notification(
                db=db,
                user_id=sub.user_id,
                notification_type=NotificationType.NEW_EPISODE,
                title=f"New Episode Airing: {anime.title_english or anime.title_romaji}",
                message=f"Episode {float(ep.episode_number)} air time: {ep.airing_at.strftime('%I:%M %p')}. Countdown is running!",
                entity_type="anime",
                entity_id=str(ep.anime_id)
            )

def trigger_trailer_alert(db: Session, video: Video):
    """
    Notifies followers when a new trailer is verified & published.
    """
    if not video.anime_id:
        return

    anime = db.query(Anime).filter(Anime.id == video.anime_id).first()
    if not anime:
        return

    subscribers = db.query(AnimeSubscription).filter(
        AnimeSubscription.anime_id == video.anime_id,
        AnimeSubscription.trailer_alerts == True
    ).all()

    for sub in subscribers:
        create_notification(
            db=db,
            user_id=sub.user_id,
            notification_type=NotificationType.NEW_TRAILER,
            title=f"New Trailer Released: {anime.title_english or anime.title_romaji}",
            message=f"Check out the newly added promotional video/trailer: '{video.title}'",
            entity_type="anime",
            entity_id=str(anime.id)
        )
