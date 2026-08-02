from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.dependencies import get_current_user
from app.auth.models import User, UserRole
from app.media.models import Video, VideoCandidate, OfficialChannel, CandidateStatus, VideoProvider, VideoType
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


@router.get("/videos", response_model=List[VideoResponse])
def list_all_videos(
    video_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    List all approved official videos in the media hub.
    """
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
            thumbnail_url=v.thumbnail_url,
            duration_seconds=v.duration_seconds,
            language=v.language,
            confidence_score=float(v.confidence_score) if v.confidence_score else None,
        )
        for v in videos
    ]


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
