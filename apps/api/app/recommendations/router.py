import time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
import uuid

from app.database import get_db
from app.auth.models import User
from app.auth.dependencies import get_current_user
from app.anime.models import Anime
from app.recommendations.models import UserEventType, AnimeEmbedding
from app.recommendations.schemas import (
    SemanticSearchRequest, NaturalLanguageSearchRequest,
    FeedbackRequest, RecommendationItem, SearchResponse
)
from app.recommendations.service import (
    run_full_text_search, run_semantic_search, log_user_event,
    get_hybrid_recommendations
)

router = APIRouter(tags=["AI Search & Recommendations"])


@router.get("/search")
def full_text_search_endpoint(
    q: str = Query(..., min_length=1),
    genre: Optional[str] = Query(None, description="Filter by genre name"),
    season: Optional[str] = Query(None, description="Filter by season (WINTER, SPRING, SUMMER, FALL)"),
    format: Optional[str] = Query(None, description="Filter by format (TV, MOVIE, OVA, etc.)"),
    sort: str = Query("popularity", description="Sort by: popularity, score, title"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Full-text and metadata search by keyword matching titles, descriptions, genres, tags, and studios.
    Supports the same genre/season/format/sort filters as the catalogue listing endpoint.
    """
    start_time = time.time()
    results = run_full_text_search(db, q, limit, genre=genre, season=season, format=format, sort=sort)
    latency_ms = (time.time() - start_time) * 1000

    items = []
    for anime in results:
        title_dict = {
            "english": anime.title_english,
            "romaji": anime.title_romaji,
            "native": anime.title_native
        }
        genres_list = [g.name for g in anime.genres]
        items.append({
            "id": anime.id,
            "slug": anime.slug,
            "title": title_dict,
            "cover_url": anime.cover_large_url,
            "format": anime.format.value if anime.format else None,
            "status": anime.status.value if anime.status else None,
            "season": anime.season.value if anime.season else None,
            "season_year": anime.season_year,
            "average_score": float(anime.average_score) if anime.average_score else None,
            "genres": genres_list
        })

    # Track search metrics telemetry
    log_user_event(
        db,
        user_id=None,
        session_id=None,
        event_type=UserEventType.SHARE,
        entity_type="search_query",
        entity_id=q,
        metadata={"results_count": len(items), "latency_ms": latency_ms, "search_type": "keyword", "filters": {"genre": genre, "season": season, "format": format}}
    )

    return {"total": len(items), "items": items, "latency_ms": latency_ms}


@router.get("/search/autocomplete")
def autocomplete_endpoint(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db)
):
    """
    Fast query prefix autocomplete suggestions.
    """
    search_pattern = f"{q.strip().lower()}%"
    
    # Prefix title matches
    results = db.query(Anime).filter(
        Anime.slug.ilike(search_pattern) |
        Anime.title_english.ilike(search_pattern) |
        Anime.title_romaji.ilike(search_pattern)
    ).limit(10).all()

    suggestions = []
    for anime in results:
        title = anime.title_english or anime.title_romaji
        if title:
            suggestions.append(title)
            
    return {"suggestions": list(set(suggestions))}


@router.post("/search/semantic")
def semantic_search_endpoint(
    req: SemanticSearchRequest,
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    AI Semantic Search. Converts textual user query into vector embedding and finds
    closest matches using cosine distance.
    """
    start_time = time.time()
    results = run_semantic_search(db, req.query, limit)
    latency_ms = (time.time() - start_time) * 1000

    items = []
    for item in results:
        anime = item["anime"]
        title_dict = {
            "english": anime.title_english,
            "romaji": anime.title_romaji,
            "native": anime.title_native
        }
        items.append({
            "id": anime.id,
            "slug": anime.slug,
            "title": title_dict,
            "cover_url": anime.cover_large_url,
            "format": anime.format.value if anime.format else None,
            "status": anime.status.value if anime.status else None,
            "average_score": float(anime.average_score) if anime.average_score else None,
            "similarity": item["similarity"]
        })

    # Track search metrics telemetry
    log_user_event(
        db,
        user_id=None,
        session_id=None,
        event_type=UserEventType.SHARE,
        entity_type="search_query",
        entity_id=req.query,
        metadata={"results_count": len(items), "latency_ms": latency_ms, "search_type": "semantic"}
    )

    return {"total": len(items), "items": items, "latency_ms": latency_ms}


@router.post("/search/natural-language")
def natural_language_search_endpoint(
    req: NaturalLanguageSearchRequest,
    db: Session = Depends(get_db)
):
    """
    Intelligent NLP search. Parses parameters such as formats (Movie, TV) or status enums,
    then executes vector search query filtering results by matched filters.
    """
    q_str = req.query.lower()
    
    # 1. Parse structured filters from textual query
    format_filter = None
    if "movie" in q_str or "film" in q_str:
        format_filter = "MOVIE"
    elif "tv" in q_str or "series" in q_str:
        format_filter = "TV"
    elif "ova" in q_str:
        format_filter = "SPECIAL"

    status_filter = None
    if "complete" in q_str or "finish" in q_str:
        status_filter = "FINISHED"
    elif "ongoing" in q_str or "airing" in q_str:
        status_filter = "RELEASING"

    # 2. Match semantic vector candidates
    semantic_results = run_semantic_search(db, req.query, limit=50)

    # 3. Apply structured parameter filters
    filtered_items = []
    for item in semantic_results:
        anime = item["anime"]
        if format_filter and anime.format and anime.format.value != format_filter:
            continue
        if status_filter and anime.status and anime.status.value != status_filter:
            continue
            
        title_dict = {
            "english": anime.title_english,
            "romaji": anime.title_romaji,
            "native": anime.title_native
        }
        filtered_items.append({
            "id": anime.id,
            "slug": anime.slug,
            "title": title_dict,
            "cover_url": anime.cover_large_url,
            "format": anime.format.value if anime.format else None,
            "status": anime.status.value if anime.status else None,
            "average_score": float(anime.average_score) if anime.average_score else None,
            "similarity": item["similarity"]
        })

    return {"total": len(filtered_items), "items": filtered_items}


@router.get("/recommendations/home", response_model=List[RecommendationItem])
def home_recommendations_endpoint(
    limit: int = Query(10, ge=1, le=25),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Personalized recommendations for logged-in user home dashboard.
    Evaluates hybrid model and returns ranked catalog options with explanations.
    """
    recs = get_hybrid_recommendations(db, current_user.id, limit)
    
    response_items = []
    for r in recs:
        anime = r["anime"]
        title_dict = {
            "english": anime.title_english,
            "romaji": anime.title_romaji,
            "native": anime.title_native
        }
        response_items.append(
            RecommendationItem(
                id=anime.id,
                slug=anime.slug,
                title=title_dict,
                cover_url=anime.cover_large_url,
                format=anime.format.value if anime.format else None,
                status=anime.status.value if anime.status else None,
                average_score=float(anime.average_score) if anime.average_score else None,
                score=r["score"],
                reasons=r["reasons"]
            )
        )
    return response_items


@router.get("/recommendations/similar/{anime_id}", response_model=List[RecommendationItem])
def similar_anime_endpoint(
    anime_id: int,
    limit: int = Query(6, ge=1, le=12),
    db: Session = Depends(get_db)
):
    """
    Similar anime matches based on embedding vector similarity (cosine distance metrics).
    """
    target = db.query(Anime).filter((Anime.id == anime_id) | (Anime.anilist_id == anime_id)).first()
    if not target:
        raise HTTPException(status_code=404, detail="Anime target record not found.")

    target_emb = db.query(AnimeEmbedding).filter(AnimeEmbedding.anime_id == target.id).first()
    if not target_emb:
        # Fallback to genre matches
        genres_ids = [g.id for g in target.genres] if hasattr(target, "genres") else []
        stmt = db.query(Anime).filter(Anime.id != target.id)
        if genres_ids:
            from app.anime.models import AnimeGenre
            stmt = stmt.join(AnimeGenre).filter(AnimeGenre.genre_id.in_(genres_ids))
        similar_list = stmt.order_by(Anime.popularity.desc()).limit(limit).all()
        return [
            RecommendationItem(
                id=a.id, slug=a.slug,
                title={"english": a.title_english, "romaji": a.title_romaji, "native": a.title_native},
                cover_url=a.cover_large_url, format=a.format.value if a.format else None,
                status=a.status.value if a.status else None, average_score=float(a.average_score) if a.average_score else None,
                score=0.5, reasons=["Shared genre profiles"]
            )
            for a in similar_list
        ]

    query_vector = list(target_emb.embedding)
    
    # Cosine match vectors excluding target itself
    stmt = (
        db.query(Anime, (1 - AnimeEmbedding.embedding.cosine_distance(query_vector)).label("similarity"))
        .join(AnimeEmbedding, Anime.id == AnimeEmbedding.anime_id)
        .filter(Anime.id != target.id)
        .order_by(text("anime_embeddings.embedding <=> :qval"))
        .params(qval=str(query_vector))
        .limit(limit)
    )

    response_items = []
    for anime, similarity in stmt.all():
        title_dict = {
            "english": anime.title_english,
            "romaji": anime.title_romaji,
            "native": anime.title_native
        }
        reasons = ["Highly similar story/setting profile"]
        if target.format and anime.format and target.format == anime.format:
            reasons.append(f"Matching format: {anime.format.value}")
        response_items.append(
            RecommendationItem(
                id=anime.id,
                slug=anime.slug,
                title=title_dict,
                cover_url=anime.cover_large_url,
                format=anime.format.value if anime.format else None,
                status=anime.status.value if anime.status else None,
                average_score=float(anime.average_score) if anime.average_score else None,
                score=float(similarity),
                reasons=reasons
            )
        )
    return response_items


@router.post("/recommendations/{anime_id}/feedback")
def submit_recommendation_feedback(
    anime_id: int,
    data: FeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits user telemetry feedback to improve hybrid recommender vector weightings.
    """
    event_type = (
        UserEventType.RECOMMENDATION_INTEREST
        if data.feedback_type == "INTERESTED"
        else UserEventType.RECOMMENDATION_DISINTEREST
    )
    
    log_user_event(
        db,
        user_id=current_user.id,
        session_id=None,
        event_type=event_type,
        entity_type="anime",
        entity_id=str(anime_id)
    )
    return {"message": "Feedback submitted successfully."}
