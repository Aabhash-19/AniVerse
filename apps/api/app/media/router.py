from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.dependencies import get_current_user
from app.auth.models import User, UserRole
from app.media.models import Video, VideoCandidate, OfficialChannel, CandidateStatus, VideoProvider, VideoType, VerificationStatus
from app.anime.models import Anime
from app.media.discovery import score_video_candidate, create_mock_candidates, OFFICIAL_CHANNELS

router = APIRouter(tags=["Media Hub"])


# --- Schemas ---

class VideoResponse(BaseModel):
    id: int
    anime_id: int
    provider: str
    provider_video_id: str
    video_type: str
    title: str
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    language: str
    confidence_score: Optional[float] = None

    model_config = {"from_attributes": True}


class VideoCandidateResponse(BaseModel):
    id: int
    anime_id: int
    provider_video_id: str
    confidence_score: Optional[float] = None
    matched_rules: Optional[list] = None
    status: str

    model_config = {"from_attributes": True}


# --- Public Routes ---

@router.get("/anime/{anime_id}/videos", response_model=List[VideoResponse])
def get_anime_videos(anime_id: int, db: Session = Depends(get_db)):
    """
    Get all approved official videos for a specific anime.
    """
    videos = db.query(Video).filter(Video.anime_id == anime_id).all()
    return [
        VideoResponse(
            id=v.id,
            anime_id=v.anime_id,
            provider=v.provider.value,
            provider_video_id=v.provider_video_id,
            video_type=v.video_type.value,
            title=v.title,
            description=v.description,
            thumbnail_url=v.thumbnail_url,
            duration_seconds=v.duration_seconds,
            language=v.language,
            confidence_score=float(v.confidence_score) if v.confidence_score else None,
        )
        for v in videos
    ]


def fetch_animethemes_videos(anilist_id: int) -> list:
    """
    Query animethemes.moe API for clean OPs and EDs.
    Returns list of dicts: [{"type": "OPENING"|"ENDING", "url": str, "slug": str}]
    """
    import urllib.request
    import json
    
    results = []
    try:
        url = f"https://api.animethemes.moe/anime?filter[has]=resources&filter[site]=AniList&filter[external_id]={anilist_id}&include=animethemes.animethemeentries.videos"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            
        anime_list = data.get("anime", [])
        if not anime_list:
            anime_list = data.get("data", [])
            
        for a in anime_list:
            themes = a.get("animethemes", [])
            for t in themes:
                t_type = t.get("type") # "OP" or "ED"
                slug = t.get("slug")
                entries = t.get("animethemeentries", [])
                for entry in entries:
                    videos = entry.get("videos", [])
                    for v in videos:
                        link = v.get("link")
                        if link and link.startswith("http"):
                            results.append({
                                "type": "OPENING" if t_type == "OP" else "ENDING",
                                "url": link,
                                "slug": slug
                            })
                            # Keep only one video version per theme
                            break
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Animethemes API failed for {anilist_id}: {e}")
        
    return results


def fetch_animethemes_videos_parallel(anilist_ids: list) -> dict:
    """
    Fetch Animethemes videos for multiple AniList IDs in parallel using a ThreadPoolExecutor.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    results = {}
    def worker(anilist_id):
        return anilist_id, fetch_animethemes_videos(anilist_id)
        
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(worker, aid) for aid in anilist_ids]
        for fut in as_completed(futures):
            try:
                aid, themes = fut.result()
                if themes:
                    results[aid] = themes
            except Exception:
                pass
    return results


def run_videos_sync(db_session_factory):
    """
    Refreshes top 50 trailers for currently airing and upcoming anime from AniList.
    Also discovers and imports official clean OPs/EDs from Animethemes.moe in parallel.
    Prunes any trailers/videos that are no longer in this active list.
    """
    db: Session = db_session_factory()
    try:
        from app.ingestion.anilist import AniListClient
        from app.anime.models import Anime
        client = AniListClient()
        
        media_list = []
        
        # 1. Fetch upcoming trending/popular trailers
        gql_upcoming = """
        query {
          Page(page: 1, perPage: 25) {
            media(type: ANIME, status: NOT_YET_RELEASED, sort: [TRENDING_DESC, POPULARITY_DESC]) {
              id
              title { english romaji native }
              trailer { id site thumbnail }
            }
          }
        }
        """
        try:
            res_up = client._execute_query(gql_upcoming, {})
            media_list.extend(res_up.get("data", {}).get("Page", {}).get("media", []))
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to fetch upcoming trailers: {e}")

        # 2. Fetch currently airing trending/popular trailers
        gql_releasing = """
        query {
          Page(page: 1, perPage: 25) {
            media(type: ANIME, status: RELEASING, sort: [TRENDING_DESC, POPULARITY_DESC]) {
              id
              title { english romaji native }
              trailer { id site thumbnail }
            }
          }
        }
        """
        try:
            res_rel = client._execute_query(gql_releasing, {})
            media_list.extend(res_rel.get("data", {}).get("Page", {}).get("media", []))
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to fetch releasing trailers: {e}")

        client.close()

        if not media_list:
            return

        # De-duplicate media items by id
        seen_ids = set()
        unique_media = []
        for m in media_list:
            if m and m.get("id") and m.get("id") not in seen_ids:
                seen_ids.add(m["id"])
                unique_media.append(m)

        imported = 0
        refreshed_ids = []
        
        # Part A: Import trailers/PVs from AniList metadata
        for m in unique_media:
            tr = m.get("trailer")
            if not tr or tr.get("site") != "youtube" or not tr.get("id"):
                continue
            yt_id = tr["id"]
            if not yt_id or len(yt_id) < 5:
                continue
            title_str = (m.get("title", {}).get("english") or m.get("title", {}).get("romaji") or "Anime") + " – Official Trailer"
            local_anime = db.query(Anime).filter(Anime.anilist_id == m["id"]).first()
            anime_id_to_use = local_anime.id if local_anime else 1

            existing = db.query(Video).filter(Video.provider_video_id == yt_id).first()
            if not existing:
                new_video = Video(
                    anime_id=anime_id_to_use,
                    provider=VideoProvider.YOUTUBE,
                    provider_video_id=yt_id,
                    video_type=VideoType.TRAILER,
                    title=title_str,
                    description=f"Official YouTube trailer for {title_str}.",
                    thumbnail_url=f"https://i.ytimg.com/vi/{yt_id}/hqdefault.jpg",
                    language="Japanese",
                    verification_status=VerificationStatus.VERIFIED,
                    confidence_score=95.00
                )
                db.add(new_video)
                db.flush() # Populate the ID
                refreshed_ids.append(new_video.id)
                imported += 1
            else:
                # Update timestamp to mark it as active
                existing.updated_at = datetime.utcnow()
                refreshed_ids.append(existing.id)

        # Part B: Import OPs and EDs in parallel using Animethemes API
        unique_ids = [m["id"] for m in unique_media]
        all_themes = fetch_animethemes_videos_parallel(unique_ids)
        
        for m in unique_media:
            anime_title = m.get("title", {}).get("english") or m.get("title", {}).get("romaji")
            if not anime_title or m["id"] not in all_themes:
                continue
                
            local_anime = db.query(Anime).filter(Anime.anilist_id == m["id"]).first()
            anime_id_to_use = local_anime.id if local_anime else 1
            
            themes = all_themes[m["id"]]
            for t in themes:
                t_type = t["type"]
                url_str = t["url"]
                slug = t["slug"]
                
                # Check if it already exists
                existing = db.query(Video).filter(Video.provider_video_id == url_str).first()
                if not existing:
                    new_video = Video(
                        anime_id=anime_id_to_use,
                        provider=VideoProvider.YOUTUBE,
                        provider_video_id=url_str,
                        video_type=VideoType.OPENING if t_type == "OPENING" else VideoType.ENDING,
                        title=f"{anime_title} – Official {slug}",
                        description=f"Official clean {slug} theme song for {anime_title}.",
                        thumbnail_url=None,
                        language="Japanese",
                        verification_status=VerificationStatus.VERIFIED,
                        confidence_score=95.00
                    )
                    db.add(new_video)
                    db.flush()
                    refreshed_ids.append(new_video.id)
                    imported += 1
                else:
                    existing.updated_at = datetime.utcnow()
                    refreshed_ids.append(existing.id)

        db.commit()

        # Instantly delete any video that was NOT in the latest trending/airing list
        if refreshed_ids:
            db.query(Video).filter(Video.id.notin_(refreshed_ids)).delete(synchronize_session=False)
            db.commit()
        
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Background video sync error: {e}")
    finally:
        # Clear lock key on completion or error
        from app.shared.cache import set_cached_json
        set_cached_json("videos_sync_lock", None, expire_seconds=1)
        db.close()


@router.get("/videos", response_model=List[VideoResponse])
def list_all_videos(
    background_tasks: BackgroundTasks,
    video_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    refresh: bool = Query(False, description="Force sync latest trailers in background"),
    db: Session = Depends(get_db)
):
    """
    List all approved official videos in the media hub.
    Automatically refreshes trending trailers in the background if the library has
    not been updated in over 24 hours, or if refresh=true is passed.
    """
    # Clean up any leftover mock IDs
    db.query(Video).filter(Video.provider_video_id.like("MOCK_%")).delete(synchronize_session=False)
    db.commit()

    # Trigger background sync if library is stale (> 24 hours since last update) or force-requested
    latest_video = db.query(Video).order_by(Video.updated_at.desc()).first()
    should_refresh = refresh
    
    if not should_refresh:
        if not latest_video:
            should_refresh = True
        else:
            elapsed = (datetime.utcnow() - latest_video.updated_at).total_seconds()
            if elapsed > 86400: # 24 hours
                should_refresh = True

    if should_refresh and page == 1:
        from app.shared.cache import get_cached_json, set_cached_json
        lock_key = "videos_sync_lock"
        is_locked = get_cached_json(lock_key)
        if not is_locked:
            set_cached_json(lock_key, True, expire_seconds=300) # lock for 5 mins
            from app.database import SessionLocal
            background_tasks.add_task(run_videos_sync, SessionLocal)

    query = db.query(Video)
    if video_type:
        query = query.filter(Video.video_type == video_type.upper())

    offset = (page - 1) * limit
    videos = query.order_by(Video.id.desc()).offset(offset).limit(limit).all()

    return [
        VideoResponse(
            id=v.id,
            anime_id=v.anime_id,
            provider=v.provider.value,
            provider_video_id=v.provider_video_id,
            video_type=v.video_type.value,
            title=v.title,
            description=v.description,
            thumbnail_url=v.thumbnail_url or f"https://i.ytimg.com/vi/{v.provider_video_id}/hqdefault.jpg",
            duration_seconds=v.duration_seconds,
            language=v.language,
            confidence_score=float(v.confidence_score) if v.confidence_score else None,
        )
        for v in videos
    ]


@router.get("/media/social-feed")
def get_kitsu_social_feed(page_limit: int = Query(20, ge=5, le=50)):
    """
    Fetch real-time anime community social posts with multi-tier fallback:
    1. Kitsu API (capped at max 20 per page)
    2. AniList GraphQL TextActivity feed
    3. Curated anime community posts fallback
    """
    import urllib.request
    import json
    import logging
    from datetime import datetime, timezone
    from app.shared.cache import get_cached_json, set_cached_json

    log = logging.getLogger(__name__)
    cache_key = f"social:feed:{page_limit}"
    cached_data = get_cached_json(cache_key)
    if cached_data is not None and len(cached_data) > 0:
        return cached_data

    posts = []

    # ── Tier 1: Try Kitsu API (cap limit to max 20 to prevent HTTP 400) ──────
    kitsu_limit = min(page_limit, 20)
    try:
        url = f"https://kitsu.io/api/edge/posts?include=user,media&sort=-createdAt&page[limit]={kitsu_limit}"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "Accept": "application/vnd.api+json"}
        )
        with urllib.request.urlopen(req, timeout=6) as response:
            data = json.loads(response.read().decode("utf-8"))

        included_map = {}
        for inc in data.get("included", []):
            key = f"{inc['type']}:{inc['id']}"
            included_map[key] = inc.get("attributes", {})

        for item in data.get("data", []):
            attr = item.get("attributes", {})
            rel = item.get("relationships", {})

            # Parse user
            user_data = rel.get("user", {}).get("data")
            user_key = f"{user_data['type']}:{user_data['id']}" if user_data else None
            user_attr = included_map.get(user_key) if user_key else {}

            # Parse media
            media_data = rel.get("media", {}).get("data")
            media_key = f"{media_data['type']}:{media_data['id']}" if media_data else None
            media_attr = included_map.get(media_key) if media_key else {}

            content = attr.get("content")
            if not content or len(content.strip()) < 2:
                continue

            posts.append({
                "id": f"kitsu-{item.get('id')}",
                "content": content,
                "created_at": attr.get("createdAt"),
                "likes_count": attr.get("postLikesCount", 0),
                "comments_count": attr.get("commentsCount", 0),
                "embed": attr.get("embed"),
                "user": {
                    "name": user_attr.get("name") or "Anime Fan",
                    "avatar": user_attr.get("avatar", {}).get("medium") if isinstance(user_attr.get("avatar"), dict) else None,
                },
                "media": {
                    "title": media_attr.get("canonicalTitle") or (media_attr.get("titles", {}).get("en") if isinstance(media_attr.get("titles"), dict) else None),
                    "poster": media_attr.get("posterImage", {}).get("medium") if isinstance(media_attr.get("posterImage"), dict) else None,
                    "slug": media_attr.get("slug"),
                    "youtube_video_id": media_attr.get("youtubeVideoId")
                } if media_attr else None
            })
    except Exception as e:
        log.warning(f"Kitsu social feed fetch failed: {e}")

    # ── Tier 2: If Kitsu returned < 5 posts, supplement with AniList Text Activities ──
    if len(posts) < 5:
        try:
            anilist_query = """
            query {
              Page(page: 1, perPage: 20) {
                activities(type: TEXT, sort: ID_DESC) {
                  ... on TextActivity {
                    id
                    text
                    createdAt
                    likeCount
                    replyCount
                    user {
                      name
                      avatar { medium }
                    }
                    siteUrl
                  }
                }
              }
            }
            """
            req = urllib.request.Request(
                "https://graphql.anilist.co",
                data=json.dumps({"query": anilist_query}).encode("utf-8"),
                headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
            )
            with urllib.request.urlopen(req, timeout=6) as response:
                al_data = json.loads(response.read().decode("utf-8"))
                activities = al_data.get("data", {}).get("Page", {}).get("activities", [])

            for act in activities:
                text = act.get("text")
                if not text or len(text.strip()) < 5:
                    continue
                
                # Sanitize markdown syntax
                clean_text = text.replace("[", "").replace("]", "")
                user_obj = act.get("user") or {}

                dt_str = datetime.fromtimestamp(act.get("createdAt", 0), tz=timezone.utc).isoformat() if act.get("createdAt") else None

                posts.append({
                    "id": f"anilist-{act.get('id')}",
                    "content": clean_text,
                    "created_at": dt_str,
                    "likes_count": act.get("likeCount", 0),
                    "comments_count": act.get("replyCount", 0),
                    "embed": None,
                    "user": {
                        "name": user_obj.get("name") or "AniList Fan",
                        "avatar": user_obj.get("avatar", {}).get("medium") if isinstance(user_obj.get("avatar"), dict) else None,
                    },
                    "media": None
                })
        except Exception as e:
            log.warning(f"AniList community activity fetch failed: {e}")

    # ── Tier 3: High-quality fallback community posts if all external APIs fail ─
    if len(posts) == 0:
        posts = [
            {
                "id": "community-fallback-1",
                "content": "Solo Leveling Season 2 animation quality is looking absolutely top-tier! What arc are you most excited to see adapted?",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "likes_count": 142,
                "comments_count": 38,
                "embed": None,
                "user": {
                    "name": "JinWoo_Fanatic",
                    "avatar": "https://s4.anilist.co/file/anilistcdn/user/avatar/medium/default.png"
                },
                "media": {
                    "title": "Solo Leveling",
                    "poster": "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx151807-m1gX3iA7jX41.png",
                    "slug": "solo-leveling"
                }
            },
            {
                "id": "community-fallback-2",
                "content": "Just finished rewatching Attack on Titan. The sound design in the final battle scene is unbeatable. Truly a masterpiece of storytelling.",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "likes_count": 98,
                "comments_count": 24,
                "embed": None,
                "user": {
                    "name": "ErenJaeger99",
                    "avatar": "https://s4.anilist.co/file/anilistcdn/user/avatar/medium/default.png"
                },
                "media": {
                    "title": "Attack on Titan",
                    "poster": "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx16498-m5ZTVVUwLQWD.jpg",
                    "slug": "attack-on-titan"
                }
            }
        ]

    set_cached_json(cache_key, posts, expire_seconds=300)  # 5 min cache
    return posts




# --- Admin / Curator Routes ---

@router.get("/admin/video-candidates", response_model=List[VideoCandidateResponse])
def list_video_candidates(
    status_filter: Optional[CandidateStatus] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List video candidates in the curator queue.
    """
    if current_user.role not in [UserRole.CURATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only curators and admins can access the candidate queue.")

    query = db.query(VideoCandidate)
    if status_filter:
        query = query.filter(VideoCandidate.status == status_filter)
    else:
        query = query.filter(VideoCandidate.status == CandidateStatus.PENDING)

    candidates = query.order_by(VideoCandidate.confidence_score.desc()).all()
    return [
        VideoCandidateResponse(
            id=c.id,
            anime_id=c.anime_id,
            provider_video_id=c.provider_video_id,
            confidence_score=float(c.confidence_score) if c.confidence_score else None,
            matched_rules=c.matched_rules,
            status=c.status.value,
        )
        for c in candidates
    ]


@router.post("/admin/video-candidates/{candidate_id}/approve", response_model=VideoResponse)
def approve_candidate(
    candidate_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Approve a video candidate, promoting it to the official videos table.
    """
    if current_user.role not in [UserRole.CURATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only curators and admins can approve candidates.")

    candidate = db.query(VideoCandidate).filter(VideoCandidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    if candidate.status != CandidateStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Candidate is already {candidate.status.value}.")

    # Extract title and type from raw payload if available
    raw = candidate.raw_payload or {}
    
    # Create approved Video entry
    video = Video(
        anime_id=candidate.anime_id,
        provider=VideoProvider.YOUTUBE,
        provider_video_id=candidate.provider_video_id,
        video_type=VideoType.TRAILER,
        title=raw.get("title", f"Video {candidate.provider_video_id}"),
        description=raw.get("description"),
        thumbnail_url=raw.get("thumbnail_url"),
        duration_seconds=raw.get("duration_seconds"),
        confidence_score=candidate.confidence_score,
    )
    db.add(video)

    candidate.status = CandidateStatus.APPROVED
    candidate.reviewed_by = current_user.id
    candidate.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(video)

    return VideoResponse(
        id=video.id,
        anime_id=video.anime_id,
        provider=video.provider.value,
        provider_video_id=video.provider_video_id,
        video_type=video.video_type.value,
        title=video.title,
        description=video.description,
        thumbnail_url=video.thumbnail_url,
        duration_seconds=video.duration_seconds,
        language=video.language,
        confidence_score=float(video.confidence_score) if video.confidence_score else None,
    )


@router.post("/admin/video-candidates/{candidate_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_candidate(
    candidate_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reject a video candidate from being added to the official video library.
    """
    if current_user.role not in [UserRole.CURATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only curators and admins can reject candidates.")

    candidate = db.query(VideoCandidate).filter(VideoCandidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    candidate.status = CandidateStatus.REJECTED
    candidate.reviewed_by = current_user.id
    candidate.reviewed_at = datetime.utcnow()
    db.commit()
    return None


@router.post("/admin/video-discovery/{anime_id}", response_model=List[VideoCandidateResponse])
def run_video_discovery(
    anime_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Trigger mock video discovery for an anime, generating candidates for curation.
    In production, this would query the YouTube Data API v3.
    """
    if current_user.role not in [UserRole.CURATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only curators and admins can run discovery.")

    anime = db.query(Anime).filter(Anime.id == anime_id).first()
    if not anime:
        raise HTTPException(status_code=404, detail="Anime not found.")

    verified_channel_ids = [ch["youtube_channel_id"] for ch in OFFICIAL_CHANNELS]
    anime_title = anime.title_english or anime.title_romaji or "Unknown"
    mock_videos = create_mock_candidates(anime_title, anime_id)

    new_candidates = []
    for vid in mock_videos:
        # Skip if already exists
        existing = db.query(VideoCandidate).filter(
            VideoCandidate.provider_video_id == vid["provider_video_id"]
        ).first()
        if existing:
            continue

        result = score_video_candidate(vid, anime_title, verified_channel_ids)
        candidate = VideoCandidate(
            anime_id=anime_id,
            provider_video_id=vid["provider_video_id"],
            raw_payload=vid,
            confidence_score=result["confidence_score"],
            matched_rules=result["matched_rules"],
            status=CandidateStatus.PENDING,
        )
        db.add(candidate)
        new_candidates.append(candidate)

    db.commit()
    for c in new_candidates:
        db.refresh(c)

    return [
        VideoCandidateResponse(
            id=c.id,
            anime_id=c.anime_id,
            provider_video_id=c.provider_video_id,
            confidence_score=float(c.confidence_score) if c.confidence_score else None,
            matched_rules=c.matched_rules,
            status=c.status.value,
        )
        for c in new_candidates
    ]
