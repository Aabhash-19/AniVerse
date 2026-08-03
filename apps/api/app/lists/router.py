from typing import List, Optional
from datetime import date
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.models import User
from app.auth.dependencies import get_current_user
from app.lists.models import AnimeListEntry, ListStatus, Favourite, FavouriteType
from app.anime.models import Anime
from app.anime.schemas import AnimeSummarySchema

logger = logging.getLogger("lists_router")

router = APIRouter(prefix="/me/lists", tags=["Watchlist Tracking"])


# --- Schemas ---

class WatchlistEntryCreateUpdate(BaseModel):
    status: ListStatus
    progress: int = Field(default=0, ge=0)
    score: Optional[float] = Field(None, ge=0.0, le=100.0)
    notes: Optional[str] = None
    rewatch_count: int = Field(default=0, ge=0)
    started_at: Optional[date] = None
    completed_at: Optional[date] = None
    is_private: bool = False


class WatchlistEntryResponse(BaseModel):
    id: str
    anime_id: int
    status: str
    progress: int
    score: Optional[float] = None
    rewatch_count: int
    notes: Optional[str] = None
    is_private: bool
    anime: AnimeSummarySchema

    model_config = {
        "from_attributes": True
    }


# --- Endpoints ---

# --- AniList Watchlist Importer Request Schema ---
class AniListImportRequest(BaseModel):
    username: str


# --- Favourites Endpoints ---

@router.get("/favourites", response_model=List[dict])
def get_favourites(
    entity_type: Optional[FavouriteType] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get list of user's favorites, optionally filtered by type.
    """
    query = db.query(Favourite).filter(Favourite.user_id == current_user.id)
    if entity_type:
        query = query.filter(Favourite.entity_type == entity_type)
    favs = query.all()
    
    result = []
    for f in favs:
        item = {
            "entity_type": f.entity_type.value,
            "entity_id": f.entity_id,
            "created_at": f.created_at
        }
        if f.entity_type == FavouriteType.ANIME:
            anime = db.query(Anime).filter(Anime.id == f.entity_id).first()
            if anime:
                item["anime"] = {
                    "id": anime.id,
                    "slug": anime.slug,
                    "title": {"english": anime.title_english, "romaji": anime.title_romaji, "native": anime.title_native},
                    "cover_url": anime.cover_large_url
                }
        result.append(item)
    return result


@router.put("/favourites/{entity_type}/{entity_id}", status_code=status.HTTP_201_CREATED)
def add_favourite(
    entity_type: FavouriteType,
    entity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add an entity to user's favorites list.
    """
    target_id = entity_id
    if entity_type == FavouriteType.ANIME:
        anime = db.query(Anime).filter((Anime.id == entity_id) | (Anime.anilist_id == entity_id)).first()
        if not anime:
            raise HTTPException(status_code=404, detail="Anime not found in AniVerse catalogue.")
        target_id = anime.id

    existing = db.query(Favourite).filter(
        Favourite.user_id == current_user.id,
        Favourite.entity_type == entity_type,
        Favourite.entity_id == target_id
    ).first()

    if not existing:
        fav = Favourite(
            user_id=current_user.id,
            entity_type=entity_type,
            entity_id=target_id
        )
        db.add(fav)
        db.commit()
    return {"message": "Added to favorites"}


@router.delete("/favourites/{entity_type}/{entity_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favourite(
    entity_type: FavouriteType,
    entity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove an entity from user's favorites list.
    """
    target_id = entity_id
    if entity_type == FavouriteType.ANIME:
        anime = db.query(Anime).filter((Anime.id == entity_id) | (Anime.anilist_id == entity_id)).first()
        if anime:
            target_id = anime.id

    fav = db.query(Favourite).filter(
        Favourite.user_id == current_user.id,
        Favourite.entity_type == entity_type,
        Favourite.entity_id == target_id
    ).first()

    if not fav:
        raise HTTPException(status_code=404, detail="Favorite entry not found.")

    db.delete(fav)
    db.commit()
    return None


@router.post("/import/anilist", status_code=status.HTTP_200_OK)
def import_watchlist_from_anilist(
    req: AniListImportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Import/sync watchlist entries from a public AniList user profile.
    """
    from app.ingestion.anilist import AniListClient
    from app.ingestion.service import import_anime_payload

    client = AniListClient()
    try:
        data = client.fetch_user_lists(req.username)
    except Exception as e:
        err_str = str(e)
        if "403" in err_str:
            detail = (
                "AniList API is currently unavailable (403 Forbidden). "
                "This is a temporary AniList service outage — please try again in a few minutes."
            )
        elif "404" in err_str:
            detail = f"AniList user '{req.username}' not found or profile is private."
        else:
            detail = f"Could not reach AniList API: {err_str}"
        raise HTTPException(status_code=503, detail=detail)
    finally:
        client.close()

    # AniList may return errors inline in the JSON payload even with 200 OK
    if data.get("errors"):
        first_err = data["errors"][0].get("message", "Unknown AniList error")
        if "disabled" in first_err.lower() or "stability" in first_err.lower():
            raise HTTPException(
                status_code=503,
                detail="AniList API is temporarily disabled due to service issues. Please try again later."
            )
        raise HTTPException(status_code=502, detail=f"AniList API error: {first_err}")

    collection = data.get("data", {}).get("MediaListCollection")
    if not collection:
        raise HTTPException(
            status_code=404, 
            detail=f"No AniList profile or watchlist found for username: {req.username}"
        )

    lists = collection.get("lists", [])
    imported_count = 0

    # Map AniList list status string to our local enum
    status_mapping = {
        "CURRENT": ListStatus.WATCHING,
        "PLANNING": ListStatus.PLANNING,
        "COMPLETED": ListStatus.COMPLETED,
        "PAUSED": ListStatus.PAUSED,
        "DROPPED": ListStatus.DROPPED,
        "REPEATING": ListStatus.REWATCHING
    }

    client = AniListClient()
    try:
        for user_list in lists:
            entries = user_list.get("entries", [])
            user_list_status = (user_list.get("status") or "").upper()
            user_list_name = (user_list.get("name") or "").upper()

            for entry in entries:
                try:
                    media_payload = entry.get("media", {})
                    anilist_media_id = media_payload.get("id") or entry.get("mediaId")
                    if not anilist_media_id:
                        continue
                    
                    # Try finding anime in local DB first
                    anime = db.query(Anime).filter(Anime.anilist_id == anilist_media_id).first()
                    if not anime:
                        try:
                            if media_payload and media_payload.get("title"):
                                anime = import_anime_payload(db, media_payload)
                            else:
                                fetched = client.fetch_anime_by_id(anilist_media_id)
                                if fetched:
                                    anime = import_anime_payload(db, fetched)
                            db.flush()
                        except Exception as e:
                            logger.error(f"Failed to import anime {anilist_media_id} during list sync: {str(e)}")
                            db.rollback()
                            continue

                    if not anime:
                        continue

                    # Robust status mapping: check entry status -> list status -> list name
                    raw_status = (entry.get("status") or user_list_status or "").upper()
                    if raw_status in status_mapping:
                        mapped_status = status_mapping[raw_status]
                    elif "DROP" in user_list_name or "DROPPED" in user_list_name:
                        mapped_status = ListStatus.DROPPED
                    elif "PAUSE" in user_list_name or "PAUSED" in user_list_name:
                        mapped_status = ListStatus.PAUSED
                    elif "COMPLET" in user_list_name or "COMPLETED" in user_list_name:
                        mapped_status = ListStatus.COMPLETED
                    elif "PLAN" in user_list_name or "PLANNING" in user_list_name:
                        mapped_status = ListStatus.PLANNING
                    elif "REPEAT" in user_list_name or "REWATCH" in user_list_name:
                        mapped_status = ListStatus.REWATCHING
                    else:
                        mapped_status = status_mapping.get(raw_status, ListStatus.PLANNING)
                    
                    raw_score = entry.get("score")
                    clean_score = None
                    if raw_score is not None and str(raw_score).strip() != "":
                        try:
                            clean_score = min(100.0, max(0.0, float(raw_score)))
                        except (ValueError, TypeError):
                            clean_score = None

                    local_entry = db.query(AnimeListEntry).filter(
                        AnimeListEntry.user_id == current_user.id,
                        AnimeListEntry.anime_id == anime.id
                    ).first()

                    if not local_entry:
                        local_entry = AnimeListEntry(
                            user_id=current_user.id,
                            anime_id=anime.id,
                            status=mapped_status,
                            progress=entry.get("progress") or 0,
                            score=clean_score,
                            notes=entry.get("notes"),
                            rewatch_count=entry.get("repeat") or 0
                        )
                        db.add(local_entry)
                    else:
                        local_entry.status = mapped_status
                        local_entry.progress = entry.get("progress") or 0
                        local_entry.score = clean_score
                        local_entry.notes = entry.get("notes")
                        local_entry.rewatch_count = entry.get("repeat") or 0

                    db.commit()
                    imported_count += 1
                except Exception as entry_err:
                    db.rollback()
                    logger.warning(f"Skipped entry during AniList import due to error: {entry_err}")
    finally:
        client.close()

    # Invalidate recommendations cache
    from app.shared.cache import invalidate_cache
    invalidate_cache(f"user:{current_user.id}:home")

    return {"message": "Watchlist import completed successfully.", "imported_count": imported_count}


from fastapi.responses import StreamingResponse
import json

@router.get("/import/anilist/stream")
def stream_import_watchlist_from_anilist(
    username: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Server-Sent Events (SSE) streaming endpoint that imports AniList watchlist
    and emits real-time progress events with live title names and status updates.
    """
    def event_generator():
        from app.ingestion.anilist import AniListClient
        from app.ingestion.service import import_anime_payload

        client = AniListClient()
        try:
            data = client.fetch_user_lists(username)
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            return
        finally:
            client.close()

        collection = data.get("data", {}).get("MediaListCollection")
        if not collection:
            yield f"data: {json.dumps({'type': 'error', 'message': f'No AniList profile or watchlist found for @{username}'})}\n\n"
            return

        lists = collection.get("lists", [])
        all_entries = []
        for user_list in lists:
            entries = user_list.get("entries", [])
            for e in entries:
                e["_list_status"] = user_list.get("status")
                e["_list_name"] = user_list.get("name")
                all_entries.append(e)

        total_count = len(all_entries)
        yield f"data: {json.dumps({'type': 'start', 'total': total_count, 'message': f'Fetched {total_count} entries from @{username}'})}\n\n"

        status_mapping = {
            "CURRENT": ListStatus.WATCHING,
            "PLANNING": ListStatus.PLANNING,
            "COMPLETED": ListStatus.COMPLETED,
            "PAUSED": ListStatus.PAUSED,
            "DROPPED": ListStatus.DROPPED,
            "REPEATING": ListStatus.REWATCHING
        }

        imported_count = 0
        for idx, entry in enumerate(all_entries):
            try:
                media_payload = entry.get("media", {})
                anilist_media_id = media_payload.get("id") or entry.get("mediaId")
                if not anilist_media_id:
                    continue

                anime = db.query(Anime).filter(Anime.anilist_id == anilist_media_id).first()
                if not anime and media_payload:
                    try:
                        anime = import_anime_payload(db, media_payload)
                        db.flush()
                    except Exception as imp_err:
                        db.rollback()
                        logger.warning(f"Error importing anime payload {anilist_media_id}: {imp_err}")

                if not anime:
                    continue

                title = anime.title_english or anime.title_romaji or "Anime"
                
                raw_status = (entry.get("status") or entry.get("_list_status") or "").upper()
                list_name = (entry.get("_list_name") or "").upper()

                if raw_status in status_mapping:
                    mapped_status = status_mapping[raw_status]
                elif "DROP" in list_name or "DROPPED" in list_name:
                    mapped_status = ListStatus.DROPPED
                elif "PAUSE" in list_name or "PAUSED" in list_name:
                    mapped_status = ListStatus.PAUSED
                elif "COMPLET" in list_name or "COMPLETED" in list_name:
                    mapped_status = ListStatus.COMPLETED
                elif "PLAN" in list_name or "PLANNING" in list_name:
                    mapped_status = ListStatus.PLANNING
                elif "REPEAT" in list_name or "REWATCH" in list_name:
                    mapped_status = ListStatus.REWATCHING
                else:
                    mapped_status = status_mapping.get(raw_status, ListStatus.PLANNING)

                raw_score = entry.get("score")
                clean_score = None
                if raw_score is not None and str(raw_score).strip() != "":
                    try:
                        clean_score = min(100.0, max(0.0, float(raw_score)))
                    except Exception:
                        clean_score = None

                local_entry = db.query(AnimeListEntry).filter(
                    AnimeListEntry.user_id == current_user.id,
                    AnimeListEntry.anime_id == anime.id
                ).first()

                if not local_entry:
                    local_entry = AnimeListEntry(
                        user_id=current_user.id,
                        anime_id=anime.id,
                        status=mapped_status,
                        progress=entry.get("progress") or 0,
                        score=clean_score,
                        notes=entry.get("notes"),
                        rewatch_count=entry.get("repeat") or 0
                    )
                    db.add(local_entry)
                else:
                    local_entry.status = mapped_status
                    local_entry.progress = entry.get("progress") or 0
                    local_entry.score = clean_score
                    local_entry.notes = entry.get("notes")
                    local_entry.rewatch_count = entry.get("repeat") or 0

                db.commit()
                imported_count += 1

                progress_data = {
                    "type": "progress",
                    "current": idx + 1,
                    "total": total_count,
                    "title": title,
                    "status": mapped_status.value,
                    "progress": entry.get("progress") or 0,
                    "score": clean_score,
                    "cover_url": anime.cover_large_url
                }
                yield f"data: {json.dumps(progress_data)}\n\n"

            except Exception as item_err:
                db.rollback()
                logger.warning(f"Error streaming item {idx+1}: {item_err}")

        yield f"data: {json.dumps({'type': 'complete', 'imported_count': imported_count, 'total': total_count})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")




# --- Watchlist CRUD Endpoints ---

@router.put("/{anime_id}", response_model=WatchlistEntryResponse)
def add_or_update_list_entry(
    anime_id: int,
    entry_data: WatchlistEntryCreateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add an anime to the user's watchlist or update progress stats if already present.
    """
    # 1. Validate that the anime actually exists in DB
    anime = db.query(Anime).filter(Anime.id == anime_id).first()
    if not anime:
        # Fallback to check AniList ID
        anime = db.query(Anime).filter(Anime.anilist_id == anime_id).first()
        if not anime:
            raise HTTPException(status_code=404, detail="Anime not found in AniVerse catalogue database.")
            
    # 2. Check if progress exceeds total episode count
    if anime.episode_count and entry_data.progress > anime.episode_count:
        raise HTTPException(
            status_code=400,
            detail=f"Progress episode ({entry_data.progress}) cannot exceed total episode count ({anime.episode_count})."
        )

    # 3. Check for existing entry
    entry = db.query(AnimeListEntry).filter(
        AnimeListEntry.user_id == current_user.id,
        AnimeListEntry.anime_id == anime.id
    ).first()

    if not entry:
        entry = AnimeListEntry(
            user_id=current_user.id,
            anime_id=anime.id,
            status=entry_data.status,
            progress=entry_data.progress,
            score=entry_data.score,
            notes=entry_data.notes,
            rewatch_count=entry_data.rewatch_count,
            started_at=entry_data.started_at,
            completed_at=entry_data.completed_at,
            is_private=entry_data.is_private
        )
        db.add(entry)
    else:
        entry.status = entry_data.status
        entry.progress = entry_data.progress
        entry.score = entry_data.score
        entry.notes = entry_data.notes
        entry.rewatch_count = entry_data.rewatch_count
        entry.started_at = entry_data.started_at
        entry.completed_at = entry_data.completed_at
        entry.is_private = entry_data.is_private

    db.commit()
    db.refresh(entry)

    # Invalidate homepage recommendations caches
    from app.shared.cache import invalidate_cache
    invalidate_cache(f"user:{current_user.id}:home")

    # Serialize response
    genres_list = [g.name for g in anime.genres]
    anime_summary = AnimeSummarySchema(
        id=anime.id,
        anilist_id=anime.anilist_id,
        slug=anime.slug,
        title={"english": anime.title_english, "romaji": anime.title_romaji, "native": anime.title_native},
        cover_url=anime.cover_large_url,
        format=anime.format.value if anime.format else None,
        status=anime.status.value if anime.status else None,
        season=anime.season.value if anime.season else None,
        season_year=anime.season_year,
        episode_count=anime.episode_count,
        average_score=float(anime.average_score) if anime.average_score else None,
        genres=genres_list
    )

    return WatchlistEntryResponse(
        id=str(entry.id),
        anime_id=anime.id,
        status=entry.status.value,
        progress=entry.progress,
        score=float(entry.score) if entry.score else None,
        rewatch_count=entry.rewatch_count,
        notes=entry.notes,
        is_private=entry.is_private,
        anime=anime_summary
    )


@router.get("", response_model=List[WatchlistEntryResponse])
def get_my_watchlist(
    status_filter: Optional[ListStatus] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch all watchlist entries for the current authenticated user.
    """
    query = db.query(AnimeListEntry).filter(AnimeListEntry.user_id == current_user.id)
    
    if status_filter:
        query = query.filter(AnimeListEntry.status == status_filter)
        
    entries = query.all()
    response_list = []
    
    for entry in entries:
        anime = entry.anime
        genres_list = [g.name for g in anime.genres]
        anime_summary = AnimeSummarySchema(
            id=anime.id,
            anilist_id=anime.anilist_id,
            slug=anime.slug,
            title={"english": anime.title_english, "romaji": anime.title_romaji, "native": anime.title_native},
            cover_url=anime.cover_large_url,
            format=anime.format.value if anime.format else None,
            status=anime.status.value if anime.status else None,
            season=anime.season.value if anime.season else None,
            season_year=anime.season_year,
            episode_count=anime.episode_count,
            average_score=float(anime.average_score) if anime.average_score else None,
            genres=genres_list
        )
        
        response_list.append(
            WatchlistEntryResponse(
                id=str(entry.id),
                anime_id=anime.id,
                status=entry.status.value,
                progress=entry.progress,
                score=float(entry.score) if entry.score else None,
                rewatch_count=entry.rewatch_count,
                notes=entry.notes,
                is_private=entry.is_private,
                anime=anime_summary
            )
        )
        
    return response_list


@router.delete("/{anime_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list_entry(
    anime_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove an anime entry from the user's watchlist.
    """
    entry = db.query(AnimeListEntry).filter(
        AnimeListEntry.user_id == current_user.id,
        AnimeListEntry.anime_id == anime_id
    ).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found in your watchlist.")
        
    db.delete(entry)
    db.commit()
    return None




