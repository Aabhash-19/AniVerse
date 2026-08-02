from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, desc
from app.database import get_db
from app.anime.models import Anime, AnimeTitle, Genre, Tag, AnimeGenre, AnimeTag, AnimeCharacter, Character, VoiceActor, Staff, AnimeRelation
from app.anime.schemas import AnimeSummarySchema, AnimeDetailSchema, CharacterSchema, RelationSchema
from app.shared.cache import get_cached_json, set_cached_json

router = APIRouter(prefix="/anime", tags=["Anime Catalog"])


@router.get("", response_model=List[AnimeSummarySchema])
def list_anime(
    search: Optional[str] = Query(None, description="Search term matching title or synonyms"),
    genre: Optional[str] = Query(None, description="Filter by genre name"),
    tag: Optional[str] = Query(None, description="Filter by tag name"),
    season: Optional[str] = Query(None, description="Filter by season (WINTER, SPRING, SUMMER, FALL)"),
    year: Optional[int] = Query(None, description="Filter by release year"),
    format: Optional[str] = Query(None, description="Filter by format (e.g. TV, MOVIE, OVA)"),
    status: Optional[str] = Query(None, description="Filter by status (e.g. FINISHED, RELEASING)"),
    sort: str = Query("popularity", description="Sort by: popularity, score, title"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Query the Anime catalogue with pagination and various filters.
    """
    # 1. Base Query
    query = db.query(Anime)

    # 2. Search filter (joins anime_titles table for aliases and alternative titles)
    if search:
        search_lower = f"%{search.strip().lower()}%"
        query = query.join(AnimeTitle).filter(
            AnimeTitle.normalized_title.like(search_lower)
        )

    # 3. Genre filter
    if genre:
        query = query.join(AnimeGenre).join(Genre).filter(
            Genre.name.ilike(genre.strip())
        )

    # 4. Tag filter
    if tag:
        query = query.join(AnimeTag).join(Tag).filter(
            Tag.name.ilike(tag.strip())
        )

    # 5. Season/Year/Format/Status filters
    if season:
        query = query.filter(Anime.season == season.upper())
    if year:
        query = query.filter(Anime.season_year == year)
    if format:
        query = query.filter(Anime.format == format.upper())
    if status:
        query = query.filter(Anime.status == status.upper())

    # 6. Collect unique anime IDs matching all filters (avoids DISTINCT ON issues)
    matching_ids = [row[0] for row in query.with_entities(Anime.id).distinct().all()]

    # 7. Fetch clean Anime records by ID, apply sort, paginate
    result_query = db.query(Anime).filter(Anime.id.in_(matching_ids))

    if sort == "score":
        result_query = result_query.order_by(desc(Anime.average_score), Anime.id)
    elif sort == "title":
        result_query = result_query.order_by(Anime.title_english, Anime.title_romaji, Anime.id)
    else:
        result_query = result_query.order_by(desc(Anime.popularity), Anime.id)

    offset = (page - 1) * limit
    results = result_query.offset(offset).limit(limit).all()

    # Build response schema summaries
    summaries = []
    for a in results:
        genres_list = [g.name for g in a.genres]
        summaries.append(
            AnimeSummarySchema(
                id=a.id,
                anilist_id=a.anilist_id,
                slug=a.slug,
                title={"english": a.title_english, "romaji": a.title_romaji, "native": a.title_native},
                cover_url=a.cover_large_url,
                format=a.format.value if a.format else None,
                status=a.status.value if a.status else None,
                season=a.season.value if a.season else None,
                season_year=a.season_year,
                episode_count=a.episode_count,
                average_score=float(a.average_score) if a.average_score else None,
                genres=genres_list
            )
        )

    return summaries


@router.get("/{anime_id}", response_model=AnimeDetailSchema)
def get_anime_detail(anime_id: int, db: Session = Depends(get_db)):
    """
    Get detailed anime information using a cache-first read strategy.
    """
    cache_key = f"anime:{anime_id}"
    
    # 1. Attempt cache read
    cached_data = get_cached_json(cache_key)
    if cached_data:
        return AnimeDetailSchema(**cached_data)

    # 2. Database read on cache miss
    anime = db.query(Anime).filter(Anime.id == anime_id).first()
    if not anime:
        # Try finding by AniList ID as fallback
        anime = db.query(Anime).filter(Anime.anilist_id == anime_id).first()
        if not anime:
            raise HTTPException(status_code=404, detail="Anime not found")

    # Serialize object
    detail_data = {
        "id": anime.id,
        "anilist_id": anime.anilist_id,
        "slug": anime.slug,
        "title": {
            "english": anime.title_english,
            "romaji": anime.title_romaji,
            "native": anime.title_native
        },
        "description": anime.description,
        "format": anime.format.value if anime.format else None,
        "status": anime.status.value if anime.status else None,
        "source_material": anime.source_material.value if anime.source_material else None,
        "season": anime.season.value if anime.season else None,
        "season_year": anime.season_year,
        "start_date": anime.start_date.isoformat() if anime.start_date else None,
        "end_date": anime.end_date.isoformat() if anime.end_date else None,
        "episode_count": anime.episode_count,
        "episode_duration": anime.episode_duration,
        "country_code": anime.country_code,
        "is_adult": anime.is_adult,
        "average_score": float(anime.average_score) if anime.average_score else None,
        "popularity": anime.popularity,
        "favourites": anime.favourites,
        "cover_large_url": anime.cover_large_url,
        "banner_url": anime.banner_url,
        "official_site_url": anime.official_site_url,
        "genres": [g.name for g in anime.genres],
        "tags": [t.name for t in anime.tags],
        "studios": [s.name for s in anime.studios]
    }

    # 3. Store to cache (expires in 12 hours)
    set_cached_json(cache_key, detail_data, expire_seconds=43200)

    return AnimeDetailSchema(**detail_data)


@router.get("/{anime_id}/characters", response_model=List[CharacterSchema])
def get_anime_characters(anime_id: int, db: Session = Depends(get_db)):
    """
    Get characters and their voice actors for the specified anime (cache-first).
    """
    cache_key = f"anime:{anime_id}:characters"
    
    cached_data = get_cached_json(cache_key)
    if cached_data:
        return [CharacterSchema(**c) for c in cached_data]

    # Query DB
    char_relations = db.query(AnimeCharacter).filter(AnimeCharacter.anime_id == anime_id).order_by(AnimeCharacter.order_index).all()
    if not char_relations:
        # check if it is anilsit_id
        anime = db.query(Anime).filter(Anime.anilist_id == anime_id).first()
        if anime:
            char_relations = db.query(AnimeCharacter).filter(AnimeCharacter.anime_id == anime.id).order_by(AnimeCharacter.order_index).all()

    characters_list = []
    for cr in char_relations:
        char: Character = db.query(Character).filter(Character.id == cr.character_id).first()
        if not char:
            continue
            
        # Get voice actor mapping
        va_map = db.query(VoiceActor).filter(
            VoiceActor.anime_id == cr.anime_id,
            VoiceActor.character_id == char.id
        ).first()
        
        va_name = None
        va_image = None
        if va_map:
            va_staff = db.query(Staff).filter(Staff.id == va_map.staff_id).first()
            if va_staff:
                va_name = f"{va_staff.first_name or ''} {va_staff.last_name or ''}".strip()
                va_image = va_staff.image_url

        characters_list.append({
            "id": char.id,
            "first_name": char.first_name,
            "last_name": char.last_name,
            "native_name": char.native_name,
            "image_url": char.image_url,
            "role": cr.role.value,
            "voice_actor_name": va_name,
            "voice_actor_image": va_image
        })

    # Cache list
    set_cached_json(cache_key, characters_list, expire_seconds=86400) # cache for 24h

    return [CharacterSchema(**c) for c in characters_list]


@router.get("/{anime_id}/relations", response_model=List[RelationSchema])
def get_anime_relations(anime_id: int, db: Session = Depends(get_db)):
    """
    Get relations for the specified anime (cache-first).
    """
    cache_key = f"anime:{anime_id}:relations"
    
    cached_data = get_cached_json(cache_key)
    if cached_data:
        return [RelationSchema(**r) for r in cached_data]

    # Resolve anime id
    anime = db.query(Anime).filter(Anime.id == anime_id).first()
    if not anime:
        anime = db.query(Anime).filter(Anime.anilist_id == anime_id).first()
        if not anime:
            return []

    relations = db.query(AnimeRelation).filter(AnimeRelation.source_anime_id == anime.id).all()
    relations_list = []
    
    for r in relations:
        target: Anime = db.query(Anime).filter(Anime.id == r.target_anime_id).first()
        if not target:
            continue
            
        relations_list.append({
            "relation_type": r.relation_type.value,
            "anime": {
                "id": target.id,
                "anilist_id": target.anilist_id,
                "slug": target.slug,
                "title": {"english": target.title_english, "romaji": target.title_romaji, "native": target.title_native},
                "cover_url": target.cover_large_url,
                "format": target.format.value if target.format else None,
                "status": target.status.value if target.status else None,
                "season": target.season.value if target.season else None,
                "season_year": target.season_year,
                "episode_count": target.episode_count,
                "average_score": float(target.average_score) if target.average_score else None,
                "genres": [g.name for g in target.genres]
            }
        })

    # Cache list
    set_cached_json(cache_key, relations_list, expire_seconds=43200) # cache for 12h

    return [RelationSchema(**r) for r in relations_list]
