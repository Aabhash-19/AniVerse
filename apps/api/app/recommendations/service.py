import numpy as np
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, date
from sqlalchemy import text, or_, desc, case
from sqlalchemy.orm import Session
import uuid

from app.anime.models import Anime, AnimeStatus, Genre, Tag, Studio, Character, VoiceActor
from app.lists.models import AnimeListEntry
from app.auth.models import User
from app.recommendations.models import AnimeEmbedding, UserEmbedding, UserEvent, UserEventType, RecommendationResult
from app.community.models import Review

logger = logging.getLogger("recommendations_service")
MODEL_NAME = "all-MiniLM-L6-v2"

# Lazy-loaded transformer model
_model = None

def get_transformer_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(MODEL_NAME)
    return _model

def get_query_embedding(query: str) -> List[float]:
    model = get_transformer_model()
    return model.encode(query).tolist()

def log_user_event(db: Session, user_id: Optional[uuid.UUID], session_id: Optional[uuid.UUID], event_type: UserEventType, entity_type: str, entity_id: str, metadata: Optional[Dict[str, Any]] = None):
    event = UserEvent(
        user_id=user_id,
        session_id=session_id,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        action_metadata=metadata
    )
    db.add(event)
    db.commit()

def run_full_text_search(
    db: Session,
    query_str: str,
    limit: int = 20,
    *,
    genre: Optional[str] = None,
    season: Optional[str] = None,
    format: Optional[str] = None,
    sort: str = "popularity",
) -> List[Anime]:
    search_pattern = f"%{query_str.strip().lower()}%"

    # Base: match title fields, description, genres, tags, or studios
    query = (
        db.query(Anime)
        .join(Anime.genres, isouter=True)
        .join(Anime.tags, isouter=True)
        .join(Anime.studios, isouter=True)
        .filter(
            or_(
                Anime.title_english.ilike(search_pattern),
                Anime.title_romaji.ilike(search_pattern),
                Anime.title_native.ilike(search_pattern),
                Anime.description.ilike(search_pattern),
                Genre.name.ilike(search_pattern),
                Tag.name.ilike(search_pattern),
                Studio.name.ilike(search_pattern),
            )
        )
    )

    # Optional filters (same as /anime listing endpoint)
    if genre:
        query = query.filter(Genre.name.ilike(genre.strip()))
    if season:
        query = query.filter(Anime.season == season.upper())
    if format:
        query = query.filter(Anime.format == format.upper())

    # Sorting
    if sort == "score":
        query = query.order_by(
            case({Anime.status == AnimeStatus.FINISHED: 0}, else_=1),
            desc(Anime.average_score).nulls_last(),
            Anime.id
        )
    elif sort == "title":
        query = query.order_by(Anime.title_english, Anime.title_romaji, Anime.id)
    else:
        query = query.order_by(desc(Anime.popularity).nulls_last(), Anime.id)

    results = query.distinct().limit(limit).all()

    # On-demand fallback: If local database yields no results, query AniList API directly
    if not results and query_str.strip():
        try:
            from app.ingestion.anilist import AniListClient
            from app.ingestion.service import import_anime_payload
            client = AniListClient()
            try:
                media_list = client.search_anime(query_str.strip(), page=1, per_page=10)
                for media in media_list:
                    import_anime_payload(db, media)
                db.commit()
            finally:
                client.close()
            # Re-query local database after importing matching anime
            results = query.distinct().limit(limit).all()
        except Exception as e:
            logger.error(f"AniList search fallback error for '{query_str}': {e}")

    return results

def run_semantic_search(db: Session, query_str: str, limit: int = 20) -> List[Dict[str, Any]]:
    query_vector = get_query_embedding(query_str)
    
    # Compute cosine similarity using pgvector cosine_distance (similarity = 1 - distance)
    # Cosine distance is <-> operator in pgvector
    stmt = (
        db.query(Anime, (1 - AnimeEmbedding.embedding.cosine_distance(query_vector)).label("similarity"))
        .join(AnimeEmbedding, Anime.id == AnimeEmbedding.anime_id)
        .order_by(text("anime_embeddings.embedding <=> :qval"))
        .params(qval=str(query_vector))
        .limit(limit)
    )
    
    results = []
    for anime, similarity in stmt.all():
        results.append({
            "anime": anime,
            "similarity": float(similarity)
        })
    return results

def generate_user_embedding(db: Session, user_id: uuid.UUID) -> Optional[List[float]]:
    # Get user completed / watching watchlist list items
    entries = db.query(AnimeListEntry).filter(
        AnimeListEntry.user_id == user_id,
        AnimeListEntry.status.in_(["COMPLETED", "WATCHING"])
    ).all()
    
    if not entries:
        return None
        
    vectors = []
    weights = []
    
    for entry in entries:
        emb = db.query(AnimeEmbedding).filter(AnimeEmbedding.anime_id == entry.anime_id).first()
        if not emb:
            continue
            
        vector = list(emb.embedding)
        # Weight by personal score if present, else default to 50
        weight = float(entry.score) if entry.score else 50.0
        vectors.append(vector)
        weights.append(weight)
        
    if not vectors:
        return None
        
    # Weighted average of vectors
    vectors_arr = np.array(vectors)
    weights_arr = np.array(weights)
    weighted_avg = np.average(vectors_arr, axis=0, weights=weights_arr)
    
    user_vector = weighted_avg.tolist()
    
    # Save or update UserEmbedding
    existing = db.query(UserEmbedding).filter(UserEmbedding.user_id == user_id).first()
    if existing:
        existing.embedding = user_vector
        existing.generated_at = datetime.utcnow()
    else:
        new_emb = UserEmbedding(
            user_id=user_id,
            model_name=MODEL_NAME,
            embedding=user_vector
        )
        db.add(new_emb)
    db.commit()
    
    return user_vector

def get_hybrid_recommendations(db: Session, user_id: uuid.UUID, limit: int = 15) -> List[Dict[str, Any]]:
    # 1. Fetch user vector
    user_emb = db.query(UserEmbedding).filter(UserEmbedding.user_id == user_id).first()
    user_vector = user_emb.embedding if user_emb else generate_user_embedding(db, user_id)
    
    # Fallback to seasonal popularity if no user vectors can be calculated
    if not user_vector:
        fallback_anime = db.query(Anime).order_by(Anime.popularity.desc()).limit(limit).all()
        return [
            {
                "anime": a,
                "score": 0.5,
                "reasons": ["Popular in our catalog", "Trending this season"]
            }
            for a in fallback_anime
        ]

    # Convert to standard list
    user_vector_list = list(user_vector)

    # 2. Retrieve candidate anime list (excluding already completed/watching)
    completed_ids = [
        e.anime_id for e in db.query(AnimeListEntry).filter(
            AnimeListEntry.user_id == user_id,
            AnimeListEntry.status.in_(["COMPLETED", "WATCHING", "DROPPED"])
        ).all()
    ]
    
    # Fetch anime vectors
    candidates = db.query(Anime, AnimeEmbedding.embedding).join(
        AnimeEmbedding, Anime.id == AnimeEmbedding.anime_id
    ).filter(~Anime.id.in_(completed_ids) if completed_ids else True).limit(100).all()

    # Collaborative filtering cache/values
    # In a full collaborative filtering matrix, we match similar users. Here we compute user correlation based on common watchlist matches.
    user_watchlist_map = {}
    other_entries = db.query(AnimeListEntry).filter(AnimeListEntry.user_id != user_id).all()
    for oe in other_entries:
        user_watchlist_map.setdefault(oe.user_id, {})[oe.anime_id] = oe.score or 50.0

    user_own_scores = {e.anime_id: (e.score or 50.0) for e in db.query(AnimeListEntry).filter(AnimeListEntry.user_id == user_id).all()}

    # Calculate user similarities
    user_similarities = {}
    for other_uid, other_scores in user_watchlist_map.items():
        common_animes = set(user_own_scores.keys()) & set(other_scores.keys())
        if not common_animes:
            continue
        # Cosine correlation score between common rated items
        v1 = [user_own_scores[aid] for aid in common_animes]
        v2 = [other_scores[aid] for aid in common_animes]
        norm_v1 = np.linalg.norm(v1)
        norm_v2 = np.linalg.norm(v2)
        if norm_v1 > 0 and norm_v2 > 0:
            user_similarities[other_uid] = np.dot(v1, v2) / (norm_v1 * norm_v2)

    # Hybrid weights
    w_content = 0.40
    w_collab = 0.30
    w_user_pref = 0.15
    w_pop = 0.10
    w_fresh = 0.05

    results = []

    # Get User's favourite genres
    fav_genres = set()
    for aid in user_own_scores:
        anime_obj = db.query(Anime).filter(Anime.id == aid).first()
        if anime_obj:
            for g in anime_obj.genres:
                fav_genres.add(g.name)

    for anime, anime_vector in candidates:
        anime_vector_arr = np.array(list(anime_vector))
        
        # A. Content Similarity
        cos_dist = np.dot(user_vector_list, anime_vector_arr) / (np.linalg.norm(user_vector_list) * np.linalg.norm(anime_vector_arr))
        content_sim = float(cos_dist) if not np.isnan(cos_dist) else 0.0

        # B. Collaborative Score
        collab_score = 0.0
        weight_sum = 0.0
        for other_uid, sim in user_similarities.items():
            if anime.id in user_watchlist_map[other_uid]:
                collab_score += sim * (user_watchlist_map[other_uid][anime.id] / 100.0)
                weight_sum += abs(sim)
        if weight_sum > 0:
            collab_score = collab_score / weight_sum
        else:
            collab_score = 0.0

        # C. User Preference Score (genre match ratio)
        anime_genres = [g.name for g in anime.genres] if hasattr(anime, "genres") else []
        pref_match_count = sum(1 for g in anime_genres if g in fav_genres)
        user_pref_score = pref_match_count / len(anime_genres) if anime_genres else 0.0

        # D. Popularity Component (normalize against max popularity in db)
        max_pop = db.query(func.max(Anime.popularity)).scalar() or 1
        pop_score = float(anime.popularity) / max_pop

        # E. Freshness Component (decayed score based on age)
        current_year = date.today().year
        release_year = anime.season_year or 2000
        age = max(0, current_year - release_year)
        fresh_score = np.exp(-0.1 * age)  # Exponential decay

        # Weighted Final Score
        final_score = (
            w_content * content_sim +
            w_collab * collab_score +
            w_user_pref * user_pref_score +
            w_pop * pop_score +
            w_fresh * fresh_score
        )

        # Generate Explanations
        reasons = []
        if content_sim >= 0.75:
            reasons.append("Highly matches your overall story theme preferences")
        
        matching_genre = [g for g in anime_genres if g in fav_genres]
        if matching_genre:
            reasons.append(f"Contains genres you enjoy: {', '.join(matching_genre[:2])}")
            
        if collab_score >= 0.7:
            reasons.append("Popular among users with watchlists similar to yours")
            
        if pop_score >= 0.8:
            reasons.append("Trending choice in the community")
            
        if fresh_score >= 0.9:
            reasons.append("Recently airing catalog title")

        if not reasons:
            reasons.append("Matches your discovery profile preferences")

        results.append({
            "anime": anime,
            "score": final_score,
            "reasons": reasons[:3]
        })

    # Sort results
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]

# helper function for SQLAlchemy max
from sqlalchemy.sql import func
