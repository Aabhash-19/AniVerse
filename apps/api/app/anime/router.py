import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, desc, case
from app.database import get_db
from app.anime.models import Anime, AnimeStatus, AnimeTitle, Genre, Tag, AnimeGenre, AnimeTag, AnimeCharacter, Character, VoiceActor, Staff, AnimeRelation
from app.anime.schemas import AnimeSummarySchema, AnimeDetailSchema, CharacterSchema, RelationSchema
from app.shared.cache import get_cached_json, set_cached_json

logger = logging.getLogger(__name__)
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
    tba_only: Optional[bool] = Query(None, description="Filter announced anime with unannounced airing date"),
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

    # 2. Search filter — searches AnimeTitle (all aliases) AND direct columns for CJK/Japanese support
    if search:
        search_lower = f"%{search.strip().lower()}%"
        search_term_raw = search.strip()
        query = query.join(AnimeTitle).filter(
            or_(
                AnimeTitle.normalized_title.ilike(search_lower),
                Anime.title_native.ilike(f"%{search_term_raw}%"),
            )
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
    if tba_only:
        query = query.filter(Anime.season.is_(None), Anime.season_year.is_(None))
    elif year:
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
        result_query = result_query.order_by(
            case({Anime.status == AnimeStatus.FINISHED: 0}, else_=1),
            desc(Anime.average_score).nulls_last(),
            Anime.id
        )
    elif sort == "title":
        result_query = result_query.order_by(Anime.title_english, Anime.title_romaji, Anime.id)
    else:
        result_query = result_query.order_by(desc(Anime.popularity).nulls_last(), Anime.id)

    offset = (page - 1) * limit
    results = result_query.offset(offset).limit(limit).all()

    # ── Search: always sync with AniList and import full franchise chains ─────
    if search and search.strip():
        import threading
        from app.ingestion.anilist import AniListClient
        from app.ingestion.service import import_anime_payload, import_franchise_chain

        search_term = search.strip()

        # All AniList IDs found via search + BFS. Used for final re-query.
        all_franchise_ids: set[int] = set()

        try:
            # One shared client for everything in this search request
            client = AniListClient()
            try:
                # Fetch up to 50 results from AniList (covers all statuses incl. unreleased)
                media_list = client.search_anime(search_term, page=1, per_page=50)
                newly_imported_ids: list[int] = []
                for media in media_list:
                    try:
                        import_anime_payload(db, media)
                        aid = media["id"]
                        newly_imported_ids.append(aid)
                        all_franchise_ids.add(aid)
                        db.commit()
                    except Exception as item_err:
                        db.rollback()
                        logger.warning(f"Failed to import media item {media.get('id')}: {item_err}")

                # Synchronous BFS over ALL 50 results sharing one client + seen set.
                if newly_imported_ids:
                    shared_seen: set = set(newly_imported_ids)
                    seen_after = import_franchise_chain(
                        db,
                        start_anilist_ids=newly_imported_ids,
                        client=client,
                        seen=shared_seen,
                        include_all_relations=False,
                    )
                    all_franchise_ids.update(seen_after)

            finally:
                client.close()

            # Background: also discover non-timeline relations (OVAs, specials, etc.)
            def _bg_full_discovery(anilist_ids: list[int]):
                from app.database import SessionLocal
                from app.ingestion.service import import_franchise_chain
                bg_db = SessionLocal()
                try:
                    import_franchise_chain(
                        bg_db,
                        start_anilist_ids=anilist_ids,
                        include_all_relations=True,
                    )
                except Exception as ex:
                    logger.warning(f"Background full-franchise discovery error: {ex}")
                finally:
                    bg_db.close()

            if all_franchise_ids:
                threading.Thread(
                    target=_bg_full_discovery,
                    args=(list(all_franchise_ids),),
                    daemon=True
                ).start()

        except Exception as e:
            db.rollback()
            logger.warning(f"AniList search sync failed for '{search_term}': {e}")


        # ── Re-query: collect all matching IDs from DB ────────────────────────
        # Strategy: title-based match (handles romaji/English/native) UNION
        # franchise-chain members found via BFS above.
        search_lower = f"%{search_term.lower()}%"

        # Title-based match: AnimeTitle table (includes all aliases/synonyms) + direct columns
        title_ids = set(
            row[0] for row in db.query(Anime).join(AnimeTitle)
            .filter(AnimeTitle.normalized_title.ilike(search_lower))
            .with_entities(Anime.id).distinct().all()
        )
        # Also match native title directly (CJK Japanese characters)
        native_ids = set(
            row[0] for row in db.query(Anime).filter(
                or_(
                    Anime.title_native.ilike(f"%{search_term}%"),
                    Anime.title_romaji.ilike(search_lower),
                    Anime.title_english.ilike(search_lower),
                )
            ).with_entities(Anime.id).all()
        )
        # Franchise chain members found by BFS (by anilist_id → local DB id)
        chain_ids = set(
            row[0] for row in db.query(Anime)
            .filter(Anime.anilist_id.in_(all_franchise_ids))
            .with_entities(Anime.id).all()
        ) if all_franchise_ids else set()

        all_matching_ids = list(title_ids | native_ids | chain_ids)

        if all_matching_ids:
            result_query = db.query(Anime).filter(Anime.id.in_(all_matching_ids))
            if sort == "score":
                result_query = result_query.order_by(
                    case({Anime.status == AnimeStatus.FINISHED: 0}, else_=1),
                    desc(Anime.average_score).nulls_last(),
                    Anime.id
                )
            elif sort == "title":
                result_query = result_query.order_by(Anime.title_english, Anime.title_romaji, Anime.id)
            else:
                result_query = result_query.order_by(desc(Anime.popularity).nulls_last(), Anime.id)
            results = result_query.offset(offset).limit(limit).all()


    # On-demand fallback: If upcoming status query yields no results, fetch directly from AniList
    if not results and status and status.upper() == "NOT_YET_RELEASED":
        try:
            from app.ingestion.anilist import AniListClient
            from app.ingestion.service import import_anime_payload
            client = AniListClient()
            try:
                media_list = client.fetch_upcoming_anime(page=1, per_page=50)
                for media in media_list:
                    import_anime_payload(db, media)
                db.commit()
            finally:
                client.close()
            results = result_query.offset(offset).limit(limit).all()
        except Exception:
            pass

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


def resolve_anime_from_id(anime_id: str, db: Session) -> Optional[Anime]:
    """
    Universally resolve an Anime model instance by local DB ID, AniList ID,
    hyphenated slug (e.g. 'attack-on-titan-16498' or 'solo-leveling-season-2-176508'), or raw slug string.
    If not found in DB or missing synopsis/characters, performs on-demand AniList backfilling.
    """
    target_int: Optional[int] = None
    try:
        target_int = int(anime_id)
    except ValueError:
        parts = anime_id.split("-")
        if parts and parts[-1].isdigit():
            target_int = int(parts[-1])

    anime = None
    if target_int is not None:
        anime = db.query(Anime).filter(Anime.id == target_int).first()
        if not anime:
            anime = db.query(Anime).filter(Anime.anilist_id == target_int).first()

    if not anime:
        anime = db.query(Anime).filter(Anime.slug == anime_id).first()
        if not anime:
            raw_title = anime_id.replace("-", " ")
            anime = db.query(Anime).join(AnimeTitle).filter(
                AnimeTitle.normalized_title.ilike(f"%{raw_title}%")
            ).first()

    if not anime:
        try:
            from app.ingestion.anilist import AniListClient
            from app.ingestion.service import import_anime_payload
            client = AniListClient()
            try:
                media_payload = None
                if target_int is not None:
                    media_payload = client.fetch_anime_by_id(target_int)
                if not media_payload:
                    raw_term = anime_id.replace("-", " ")
                    media_list = client.search_anime(raw_term, page=1, per_page=1)
                    if media_list:
                        media_payload = media_list[0]
                if media_payload:
                    anime = import_anime_payload(db, media_payload)
                    db.commit()
            finally:
                client.close()
        except Exception as ex:
            logger.warning(f"On-demand detail fetch failed for {anime_id}: {ex}")

    # Backfill synopsis & characters if missing (e.g. partial calendar/airing schedule payload)
    if anime and (not anime.description or not anime.description.strip()):
        try:
            from app.ingestion.anilist import AniListClient
            from app.ingestion.service import import_anime_payload
            client = AniListClient()
            try:
                media_payload = client.fetch_anime_by_id(anime.anilist_id) if anime.anilist_id else None
                if media_payload:
                    anime = import_anime_payload(db, media_payload)
                    db.commit()
            finally:
                client.close()
        except Exception as ex:
            logger.warning(f"On-demand detail backfill failed for {anime_id}: {ex}")

    return anime


@router.get("/{anime_id}", response_model=AnimeDetailSchema)
def get_anime_detail(anime_id: str, db: Session = Depends(get_db)):
    """
    Get detailed anime information using a cache-first read strategy.
    Supports resolving by local DB ID, AniList ID, or slug string (e.g. 'attack-on-titan-16498' or 'attack-on-titan').
    """
    cache_key = f"anime:{anime_id}"
    
    # 1. Attempt cache read (only use cache if it contains a valid synopsis)
    cached_data = get_cached_json(cache_key)
    if cached_data and cached_data.get("description"):
        return AnimeDetailSchema(**cached_data)


    # 2. Resolve anime from DB with automatic backfill
    anime = resolve_anime_from_id(anime_id, db)
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
def get_anime_characters(anime_id: str, db: Session = Depends(get_db)):
    """
    Get characters and their voice actors for the specified anime (cache-first).
    """
    cache_key = f"anime:{anime_id}:characters"
    
    cached_data = get_cached_json(cache_key)
    if cached_data:
        return [CharacterSchema(**c) for c in cached_data]

    anime = resolve_anime_from_id(anime_id, db)
    if not anime:
        return []

    # Query DB
    char_relations = db.query(AnimeCharacter).filter(AnimeCharacter.anime_id == anime.id).order_by(AnimeCharacter.order_index).all()
    
    # Backfill characters on-demand if missing in DB
    if not char_relations and anime.anilist_id:
        try:
            from app.ingestion.anilist import AniListClient
            from app.ingestion.service import import_anime_payload
            client = AniListClient()
            try:
                media_payload = client.fetch_anime_by_id(anime.anilist_id)
                if media_payload:
                    import_anime_payload(db, media_payload)
                    db.commit()
                    char_relations = db.query(AnimeCharacter).filter(AnimeCharacter.anime_id == anime.id).order_by(AnimeCharacter.order_index).all()
            finally:
                client.close()
        except Exception as ex:
            logger.warning(f"On-demand character backfill failed for {anime_id}: {ex}")

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
def get_anime_relations(anime_id: str, db: Session = Depends(get_db)):
    """
    Get ALL relations for the specified anime, including the full franchise
    timeline chain discovered via BFS traversal.
    """
    from app.ingestion.anilist import AniListClient
    import re
    import logging
    log = logging.getLogger(__name__)

    cache_key = f"anime:{anime_id}:relations:v3"
    cached_data = get_cached_json(cache_key)
    if cached_data:
        return [RelationSchema(**r) for r in cached_data]

    # Resolve anime locally
    anime = resolve_anime_from_id(anime_id, db)
    if not anime:
        return []

    # ── Helper: convert an AniList edge node → a unified dict ─────────────────
    def node_to_entry(rel_type_str: str, node: dict) -> dict:
        target_anilist_id = node.get("id")
        title_obj = node.get("title", {})
        cover_obj = node.get("coverImage", {})

        local_target = db.query(Anime).filter(Anime.anilist_id == target_anilist_id).first()

        if local_target:
            slug = local_target.slug
            local_id = local_target.id
            cover_url = local_target.cover_large_url or cover_obj.get("large") or cover_obj.get("medium")
            average_score = float(local_target.average_score) if local_target.average_score else (float(node["averageScore"]) if node.get("averageScore") else None)
            genres = [g.name for g in local_target.genres]
            fmt = local_target.format.value if local_target.format else node.get("format")
            status_val = local_target.status.value if local_target.status else node.get("status")
            season_val = local_target.season.value if local_target.season else node.get("season")
            season_year = local_target.season_year or node.get("seasonYear")
            episode_count = local_target.episode_count
            title_english = local_target.title_english or title_obj.get("english")
            title_romaji = local_target.title_romaji or title_obj.get("romaji")
            title_native = local_target.title_native or title_obj.get("native")
        else:
            local_id = target_anilist_id
            cover_url = cover_obj.get("large") or cover_obj.get("medium")
            average_score = float(node["averageScore"]) if node.get("averageScore") else None
            genres = []
            fmt = node.get("format")
            status_val = node.get("status")
            season_val = node.get("season")
            season_year = node.get("seasonYear")
            episode_count = None
            title_english = title_obj.get("english")
            title_romaji = title_obj.get("romaji")
            title_native = title_obj.get("native")
            raw = (title_romaji or title_english or "").lower()
            slug = re.sub(r"[^a-z0-9]+", "-", raw).strip("-") or f"anime-{target_anilist_id}"

        return {
            "relation_type": rel_type_str,
            "anime": {
                "id": local_id,
                "anilist_id": target_anilist_id,
                "slug": slug,
                "title": {"english": title_english, "romaji": title_romaji, "native": title_native},
                "cover_url": cover_url,
                "format": fmt,
                "status": status_val,
                "season": season_val,
                "season_year": season_year,
                "episode_count": episode_count,
                "average_score": average_score,
                "genres": genres,
            }
        }

    TIMELINE_TYPES = {"PREQUEL", "SEQUEL", "PARENT"}
    relations_list = []
    seen_anilist_ids: set = {anime.anilist_id}  # Exclude self

    try:
        client = AniListClient()

        # ── Step 1: Fetch direct relations of the starting anime ───────────────
        direct_edges = client.fetch_relations_for_id(anime.anilist_id)

        # BFS queue: start with all timeline entries found in direct edges
        bfs_queue: list[int] = []

        for edge in direct_edges:
            rel_type_str = edge.get("relationType", "OTHER")
            node = edge.get("node", {})
            target_id = node.get("id")
            if not target_id or target_id in seen_anilist_ids:
                continue

            seen_anilist_ids.add(target_id)
            relations_list.append(node_to_entry(rel_type_str, node))

            # Queue timeline entries for BFS expansion
            if rel_type_str in TIMELINE_TYPES:
                bfs_queue.append(target_id)

        # ── Step 2: BFS — walk SEQUEL/PREQUEL/PARENT chains ────────────────────
        MAX_BFS_HOPS = 20  # Safety cap to prevent infinite loops
        hops = 0
        while bfs_queue and hops < MAX_BFS_HOPS:
            hops += 1
            next_queue: list[int] = []
            for chain_id in bfs_queue:
                chain_edges = client.fetch_relations_for_id(chain_id)
                for edge in chain_edges:
                    rel_type_str = edge.get("relationType", "OTHER")
                    # Only follow timeline links during BFS; skip others
                    if rel_type_str not in TIMELINE_TYPES:
                        continue
                    node = edge.get("node", {})
                    target_id = node.get("id")
                    if not target_id or target_id in seen_anilist_ids:
                        continue
                    seen_anilist_ids.add(target_id)
                    relations_list.append(node_to_entry(rel_type_str, node))
                    next_queue.append(target_id)
            bfs_queue = next_queue

        client.close()

    except Exception as e:
        log.warning(f"AniList relations BFS failed for {anime.anilist_id}: {e}")

    # ── Step 3: Local DB fallback — add any relations not yet covered ──────────
    local_rels = db.query(AnimeRelation).filter(AnimeRelation.source_anime_id == anime.id).all()
    for r in local_rels:
        target: Anime = db.query(Anime).filter(Anime.id == r.target_anime_id).first()
        if not target or target.anilist_id in seen_anilist_ids:
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
                "genres": [g.name for g in target.genres],
            }
        })

    # Sort: PREQUEL/SEQUEL/PARENT first (sorted by year), then everything else by type
    def sort_key(x):
        is_timeline = x["relation_type"] in TIMELINE_TYPES
        year = x["anime"].get("season_year") or 9999
        return (0 if is_timeline else 1, year, x["relation_type"])

    relations_list.sort(key=sort_key)

    set_cached_json(cache_key, relations_list, expire_seconds=3600)  # cache 1h
    return [RelationSchema(**r) for r in relations_list]


@router.get("/{anime_id}/reviews")
def get_anime_reviews(anime_id: str, page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=50), db: Session = Depends(get_db)):
    """Fetch community reviews directly from AniList for a given anime."""
    from app.ingestion.anilist import AniListClient

    anime = resolve_anime_from_id(anime_id, db)
    anilist_id_to_use = anime.anilist_id if anime else None
    if not anilist_id_to_use:
        return []

    cache_key = f"anime:{anilist_id_to_use}:reviews:{page}:{per_page}"
    cached_data = get_cached_json(cache_key)
    if cached_data is not None:
        return cached_data

    client = AniListClient()
    try:
        reviews = client.fetch_reviews_for_id(anilist_id_to_use, page=page, per_page=per_page)
        set_cached_json(cache_key, reviews, expire_seconds=3600)
        return reviews
    finally:
        client.close()


@router.get("/{anime_id}/anilist-recommendations")
def get_anime_anilist_recommendations(anime_id: str, page: int = Query(1, ge=1), per_page: int = Query(25, ge=1, le=50), db: Session = Depends(get_db)):
    """Fetch user-voted recommendations directly from AniList for a given anime."""
    from app.ingestion.anilist import AniListClient

    anime = resolve_anime_from_id(anime_id, db)
    anilist_id_to_use = anime.anilist_id if anime else None
    if not anilist_id_to_use:
        return []

    cache_key = f"anime:{anilist_id_to_use}:recommendations:{page}:{per_page}"
    cached_data = get_cached_json(cache_key)
    if cached_data is not None:
        return cached_data

    client = AniListClient()
    try:
        recs = client.fetch_recommendations_for_id(anilist_id_to_use, page=page, per_page=per_page)
        set_cached_json(cache_key, recs, expire_seconds=3600)
        return recs
    finally:
        client.close()


@router.get("/{anime_id}/anilist-videos")
def get_anime_anilist_videos(anime_id: str, db: Session = Depends(get_db)):
    """Fetch trailer & official video information directly from AniList."""
    from app.ingestion.anilist import AniListClient

    anime = resolve_anime_from_id(anime_id, db)
    anilist_id_to_use = anime.anilist_id if anime else None
    if not anilist_id_to_use:
        return {"trailer": None, "streamingEpisodes": []}

    cache_key = f"anime:{anilist_id_to_use}:videos"
    cached_data = get_cached_json(cache_key)
    if cached_data is not None:
        return cached_data

    client = AniListClient()
    try:
        vids = client.fetch_videos_for_id(anilist_id_to_use)
        set_cached_json(cache_key, vids, expire_seconds=3600)
        return vids
    finally:
        client.close()




