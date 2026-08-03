import logging
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, update, insert
from slugify import slugify

from app.anime.models import (
    Anime, AnimeTitle, Genre, AnimeGenre, Tag, AnimeTag,
    Studio, AnimeStudio, Character, AnimeCharacter, Staff, AnimeStaff,
    VoiceActor, AnimeRelation, AnimeFormat, AnimeStatus, SourceMaterial,
    AnimeSeason, CharacterRole, RelationType
)

logger = logging.getLogger("ingestion_service")


def parse_anilist_date(d: Dict[str, Any]) -> Optional[date]:
    if not d or not d.get("year"):
        return None
    try:
        return date(d["year"], d.get("month") or 1, d.get("day") or 1)
    except Exception:
        return None


def get_or_create_genre(db: Session, name: str) -> Genre:
    genre_slug = slugify(name)
    genre = db.query(Genre).filter(Genre.slug == genre_slug).first()
    if not genre:
        genre = Genre(name=name, slug=genre_slug)
        db.add(genre)
        db.flush()
    return genre


def get_or_create_tag(db: Session, tag_data: Dict[str, Any]) -> Tag:
    tag_id = tag_data["id"]
    tag = db.query(Tag).filter(Tag.anilist_id == tag_id).first()
    if not tag:
        tag = Tag(
            anilist_id=tag_id,
            name=tag_data["name"],
            description=tag_data.get("description"),
            category=tag_data.get("category"),
            is_adult=tag_data.get("isAdult") or False
        )
        db.add(tag)
        db.flush()
    return tag


def get_or_create_studio(db: Session, studio_data: Dict[str, Any]) -> Studio:
    studio_id = studio_data["id"]
    studio = db.query(Studio).filter(Studio.anilist_id == studio_id).first()
    if not studio:
        studio = Studio(
            anilist_id=studio_id,
            name=studio_data["name"],
            is_animation_studio=studio_data.get("isAnimationStudio") or False,
            site_url=studio_data.get("siteUrl")
        )
        db.add(studio)
        db.flush()
    return studio


def get_or_create_character(db: Session, char_data: Dict[str, Any]) -> Character:
    char_id = char_data["id"]
    char = db.query(Character).filter(Character.anilist_id == char_id).first()
    img_url = char_data.get("image", {}).get("large") or char_data.get("image", {}).get("medium")
    if not char:
        name_data = char_data.get("name") or {}
        dob_data = char_data.get("dateOfBirth") or {}
        char = Character(
            anilist_id=char_id,
            first_name=name_data.get("first"),
            middle_name=name_data.get("middle"),
            last_name=name_data.get("last"),
            native_name=name_data.get("native"),
            description=char_data.get("description"),
            image_url=img_url,
            gender=char_data.get("gender"),
            date_of_birth=parse_anilist_date(dob_data)
        )
        db.add(char)
        db.flush()
    else:
        if img_url and char.image_url != img_url:
            char.image_url = img_url
            db.flush()
    return char


def get_or_create_staff(db: Session, staff_data: Dict[str, Any]) -> Staff:
    staff_id = staff_data["id"]
    staff = db.query(Staff).filter(Staff.anilist_id == staff_id).first()
    img_url = staff_data.get("image", {}).get("large") or staff_data.get("image", {}).get("medium")
    if not staff:
        name_data = staff_data.get("name") or {}
        staff = Staff(
            anilist_id=staff_id,
            first_name=name_data.get("first"),
            middle_name=name_data.get("middle"),
            last_name=name_data.get("last"),
            native_name=name_data.get("native"),
            description=staff_data.get("description"),
            image_url=img_url
        )
        db.add(staff)
        db.flush()
    else:
        if img_url and staff.image_url != img_url:
            staff.image_url = img_url
            db.flush()
    return staff


def import_anime_payload(db: Session, media: Dict[str, Any]) -> Anime:
    """
    Import or update a single anime and all related entities (genres, tags, studios, characters, staff).
    """
    anilist_id = media["id"]
    
    # Check if Anime already exists
    anime = db.query(Anime).filter(Anime.anilist_id == anilist_id).first()
    
    title_romaji = media.get("title", {}).get("romaji")
    title_english = media.get("title", {}).get("english")
    title_native = media.get("title", {}).get("native")
    primary_title = title_english or title_romaji or title_native
    anime_slug = slugify(primary_title)
    
    # Clean description (AniList may return <br> or HTML tags)
    desc = media.get("description")
    if desc:
        import re
        desc = re.sub('<[^<]+?>', '', desc)
    
    # Safe enum parsing
    def safe_enum(enum_cls, val):
        if not val:
            return None
        try:
            return enum_cls(val)
        except ValueError:
            # Check source material fallback mappings
            if enum_cls == SourceMaterial:
                if val == "LIGHT_NOVEL":
                    return SourceMaterial.LIGHT_NOVEL
                if val == "VISUAL_NOVEL":
                    return SourceMaterial.VISUAL_NOVEL
                if val == "VIDEO_GAME":
                    return SourceMaterial.VIDEO_GAME
                if val == "WEB_NOVEL":
                    return SourceMaterial.WEB_NOVEL
                if val == "LIVE_ACTION":
                    return SourceMaterial.LIVE_ACTION
                if val == "MULTIMEDIA_PROJECT":
                    return SourceMaterial.MULTIMEDIA_PROJECT
                if val == "PICTURE_BOOK":
                    return SourceMaterial.PICTURE_BOOK
            return None

    anime_format = safe_enum(AnimeFormat, media.get("format"))
    anime_status = safe_enum(AnimeStatus, media.get("status"))
    source_mat = safe_enum(SourceMaterial, media.get("source"))
    anime_season = safe_enum(AnimeSeason, media.get("season"))

    if not anime:
        anime = Anime(
            anilist_id=anilist_id,
            slug=anime_slug,
            title_romaji=title_romaji,
            title_english=title_english,
            title_native=title_native,
            description=desc,
            format=anime_format,
            status=anime_status,
            source_material=source_mat,
            season=anime_season,
            season_year=media.get("seasonYear"),
            start_date=parse_anilist_date(media.get("startDate")),
            end_date=parse_anilist_date(media.get("endDate")),
            episode_count=media.get("episodes"),
            episode_duration=media.get("duration"),
            country_code=media.get("countryOfOrigin"),
            is_adult=media.get("isAdult") or False,
            average_score=media.get("averageScore"),
            popularity=media.get("popularity") or 0,
            favourites=media.get("favourites") or 0,
            cover_large_url=media.get("coverImage", {}).get("large"),
            cover_medium_url=media.get("coverImage", {}).get("medium"),
            banner_url=media.get("bannerImage"),
            official_site_url=media.get("siteUrl")
        )
        db.add(anime)
        db.flush()
    else:
        # Update existing
        anime.slug = anime_slug
        anime.title_romaji = title_romaji
        anime.title_english = title_english
        anime.title_native = title_native
        anime.description = desc
        anime.format = anime_format
        anime.status = anime_status
        anime.source_material = source_mat
        anime.season = anime_season
        anime.season_year = media.get("seasonYear")
        anime.start_date = parse_anilist_date(media.get("startDate"))
        anime.end_date = parse_anilist_date(media.get("endDate"))
        anime.episode_count = media.get("episodes")
        anime.episode_duration = media.get("duration")
        anime.country_code = media.get("countryOfOrigin")
        anime.is_adult = media.get("isAdult") or False
        anime.average_score = media.get("averageScore")
        anime.popularity = media.get("popularity") or 0
        anime.favourites = media.get("favourites") or 0
        anime.cover_large_url = media.get("coverImage", {}).get("large")
        anime.cover_medium_url = media.get("coverImage", {}).get("medium")
        anime.banner_url = media.get("bannerImage")
        anime.official_site_url = media.get("siteUrl")
        anime.last_synced_at = datetime.utcnow()
        db.flush()

    # Clear titles and rebuild
    db.query(AnimeTitle).filter(AnimeTitle.anime_id == anime.id).delete()
    titles_to_add = []
    if title_romaji:
        titles_to_add.append(AnimeTitle(anime_id=anime.id, title=title_romaji, language="romaji", title_type="romaji", normalized_title=title_romaji.lower()))
    if title_english:
        titles_to_add.append(AnimeTitle(anime_id=anime.id, title=title_english, language="english", title_type="english", normalized_title=title_english.lower()))
    if title_native:
        titles_to_add.append(AnimeTitle(anime_id=anime.id, title=title_native, language="native", title_type="native", normalized_title=title_native.lower()))
    for syn in media.get("synonyms") or []:
        titles_to_add.append(AnimeTitle(anime_id=anime.id, title=syn, language="synonym", title_type="synonym", normalized_title=syn.lower()))
    db.add_all(titles_to_add)

    # Ingest genres
    db.query(AnimeGenre).filter(AnimeGenre.anime_id == anime.id).delete()
    seen_genres = set()
    for g_name in media.get("genres") or []:
        if g_name in seen_genres:
            continue
        seen_genres.add(g_name)
        genre = get_or_create_genre(db, g_name)
        db.add(AnimeGenre(anime_id=anime.id, genre_id=genre.id))

    # Ingest tags
    db.query(AnimeTag).filter(AnimeTag.anime_id == anime.id).delete()
    seen_tags = set()
    for t_data in media.get("tags") or []:
        if not t_data.get("id") or t_data["id"] in seen_tags:
            continue
        seen_tags.add(t_data["id"])
        tag = get_or_create_tag(db, t_data)
        db.add(AnimeTag(
            anime_id=anime.id,
            tag_id=tag.id,
            rank=t_data.get("rank"),
            is_spoiler=t_data.get("isMediaSpoiler") or False
        ))

    # Ingest studios
    db.query(AnimeStudio).filter(AnimeStudio.anime_id == anime.id).delete()
    seen_studios = set()
    for st_edge in (media.get("studios") or {}).get("edges") or []:
        st_data = st_edge.get("node")
        if st_data and st_data.get("id"):
            if st_data["id"] in seen_studios:
                continue
            seen_studios.add(st_data["id"])
            studio = get_or_create_studio(db, st_data)
            db.add(AnimeStudio(
                anime_id=anime.id,
                studio_id=studio.id,
                is_main=st_edge.get("isMain") or False
            ))

    # Ingest characters and voice actors
    db.query(AnimeCharacter).filter(AnimeCharacter.anime_id == anime.id).delete()
    db.query(VoiceActor).filter(VoiceActor.anime_id == anime.id).delete()
    seen_characters = set()
    seen_va = set()
    
    char_edges = (media.get("characters") or {}).get("edges") or []
    for idx, char_edge in enumerate(char_edges):
        char_data = char_edge.get("node")
        if char_data and char_data.get("id"):
            if char_data["id"] in seen_characters:
                continue
            seen_characters.add(char_data["id"])
            character = get_or_create_character(db, char_data)
            role_str = char_edge.get("role") or "SUPPORTING"
            role_enum = CharacterRole.SUPPORTING
            if role_str == "MAIN":
                role_enum = CharacterRole.MAIN
            elif role_str == "BACKGROUND":
                role_enum = CharacterRole.BACKGROUND
                
            db.add(AnimeCharacter(
                anime_id=anime.id,
                character_id=character.id,
                role=role_enum,
                order_index=idx
            ))
            
            # Voice Actors
            for va_data in char_edge.get("voiceActors") or []:
                if not va_data.get("id"):
                    continue
                va_staff = get_or_create_staff(db, va_data)
                va_key = (anime.id, character.id, va_staff.id)
                if va_key in seen_va:
                    continue
                seen_va.add(va_key)
                db.add(VoiceActor(
                    anime_id=anime.id,
                    character_id=character.id,
                    staff_id=va_staff.id,
                    language="Japanese"
                ))

    # Ingest staff
    db.query(AnimeStaff).filter(AnimeStaff.anime_id == anime.id).delete()
    seen_staff = set()
    staff_edges = (media.get("staff") or {}).get("edges") or []
    for staff_edge in staff_edges:
        st_role = staff_edge.get("role")
        st_data = staff_edge.get("node")
        if st_data and st_data.get("id") and st_role:
            staff_member = get_or_create_staff(db, st_data)
            staff_key = (anime.id, staff_member.id, st_role)
            if staff_key in seen_staff:
                continue
            seen_staff.add(staff_key)
            db.add(AnimeStaff(
                anime_id=anime.id,
                staff_id=staff_member.id,
                role=st_role
            ))

    db.flush()
    return anime


def process_relations(db: Session, relations_map: Dict[int, List[Dict[str, Any]]]):
    """
    Connect relationships between already imported anime in the database.
    """
    logger.info("Processing anime relationships...")
    
    for source_anilist_id, rel_list in relations_map.items():
        source_anime = db.query(Anime).filter(Anime.anilist_id == source_anilist_id).first()
        if not source_anime:
            continue
            
        for rel in rel_list:
            target_anilist_id = rel.get("node", {}).get("id")
            rel_type_str = rel.get("relationType")
            
            # Map type (source check)
            if not target_anilist_id or not rel_type_str:
                continue
                
            target_anime = db.query(Anime).filter(Anime.anilist_id == target_anilist_id).first()
            if not target_anime:
                # We haven't imported the target anime yet, skip for now
                continue
                
            # Safely map relation type
            try:
                rel_type = RelationType(rel_type_str)
            except ValueError:
                # Map alternate strings
                if rel_type_str == "ADAPTATION":
                    rel_type = RelationType.ADAPTATION
                elif rel_type_str == "COMPILATION":
                    rel_type = RelationType.COMPILATION
                elif rel_type_str == "CONTAINS":
                    rel_type = RelationType.CONTAINS
                elif rel_type_str == "SOURCE":
                    rel_type = RelationType.SOURCE
                else:
                    rel_type = RelationType.OTHER
            
            # Upsert relationship
            existing = db.query(AnimeRelation).filter(
                AnimeRelation.source_anime_id == source_anime.id,
                AnimeRelation.target_anime_id == target_anime.id,
                AnimeRelation.relation_type == rel_type
            ).first()
            
            if not existing:
                db.add(AnimeRelation(
                    source_anime_id=source_anime.id,
                    target_anime_id=target_anime.id,
                    relation_type=rel_type
                ))
    db.commit()


def import_franchise_chain(
    db: Session,
    start_anilist_ids,           # int OR list[int]
    max_hops: int = 20,
    seen: set = None,            # shared seen set across multiple calls
    client=None,                 # pre-opened AniListClient (caller must close)
    include_all_relations: bool = False,  # if True, also traverse non-timeline rels
) -> set:
    """
    BFS-traverse relation chains starting from one or more AniList IDs and
    import every ANIME entry that isn't already in the database.

    - Supports multiple start_anilist_ids (list or single int) so all search
      results can share one BFS pass with a shared 'seen' set.
    - By default only follows PREQUEL / SEQUEL / PARENT links.
    - Pass include_all_relations=True to also traverse SIDE_STORY / SPIN_OFF /
      ALTERNATIVE / CHARACTER (useful for full-franchise discovery).
    - Returns the final 'seen' set so callers can accumulate state.
    """
    from app.ingestion.anilist import AniListClient

    TIMELINE_TYPES = {"PREQUEL", "SEQUEL", "PARENT"}
    ALL_TYPES = TIMELINE_TYPES | {"SIDE_STORY", "SPIN_OFF", "ALTERNATIVE", "CHARACTER", "ADAPTATION", "COMPILATION", "CONTAINS", "SUMMARY"}
    traverse_types = ALL_TYPES if include_all_relations else TIMELINE_TYPES

    if seen is None:
        seen = set()

    # Normalise to list
    if isinstance(start_anilist_ids, int):
        start_anilist_ids = [start_anilist_ids]

    owns_client = client is None
    if owns_client:
        client = AniListClient()

    queue: list = [aid for aid in start_anilist_ids if aid not in seen]

    try:
        hops = 0
        while queue and hops < max_hops:
            hops += 1
            next_queue: list = []

            for anilist_id in queue:
                if anilist_id in seen:
                    continue
                seen.add(anilist_id)

                try:
                    edges = client.fetch_relations_for_id(anilist_id)
                except Exception as e:
                    logger.warning(f"Relation fetch failed for {anilist_id}: {e}")
                    continue

                for edge in edges:
                    rel_type = edge.get("relationType", "")
                    if rel_type not in traverse_types:
                        continue
                    node = edge.get("node", {})
                    target_id = node.get("id")
                    if not target_id or target_id in seen:
                        continue

                    # Skip non-ANIME entries (MANGA, NOVEL, etc.)
                    if node.get("type", "ANIME") != "ANIME":
                        seen.add(target_id)
                        continue

                    # Import if not already in DB
                    existing = db.query(Anime).filter(Anime.anilist_id == target_id).first()
                    if not existing:
                        try:
                            media = client.fetch_anime_by_id(target_id)
                            if media:
                                import_anime_payload(db, media)
                                db.commit()
                                logger.info(f"Franchise chain: imported anilist_id={target_id}")
                        except Exception as e:
                            logger.warning(f"Franchise chain import failed for {target_id}: {e}")
                            try:
                                db.rollback()
                            except Exception:
                                pass

                    next_queue.append(target_id)

            queue = next_queue
    finally:
        if owns_client:
            client.close()

    return seen



def sync_airing_schedule(db: Session, days_ahead: int = 30, days_past: int = 30) -> int:
    """
    Pull past and upcoming airing episodes from AniList and upsert them into the
    Episode table so the calendar and notification system have real data.

    For each schedule entry the function:
    1. Looks up the anime in our database by AniList ID.
    2. If not found, fetches and imports the anime automatically.
    3. Upserts the Episode row (anime_id + episode_number are unique).

    Returns the number of episode rows processed.
    """
    import time as _time
    from datetime import timedelta
    from app.anime.models import Episode
    from app.ingestion.anilist import AniListClient

    client = AniListClient()
    now = datetime.utcnow()
    start = now - timedelta(days=days_past)
    end = now + timedelta(days=days_ahead)

    start_ts = int(start.timestamp())
    end_ts = int(end.timestamp())

    page = 1
    total = 0

    try:
        while True:
            try:
                response = client.fetch_airing_schedule(start_ts, end_ts, page=page, per_page=50)
            except Exception as e:
                logger.error(f"AniList airing schedule fetch error (page {page}): {e}")
                break

            schedules = (
                response.get("data", {})
                .get("Page", {})
                .get("airingSchedules", [])
            )
            if not schedules:
                break

            for sched in schedules:
                anilist_id = sched.get("mediaId")
                episode_number = sched.get("episode")
                airing_ts = sched.get("airingAt")

                if not anilist_id or not episode_number or not airing_ts:
                    continue

                airing_dt = datetime.utcfromtimestamp(airing_ts)

                # 1. Find anime in DB
                anime = db.query(Anime).filter(Anime.anilist_id == anilist_id).first()

                # 2. Auto-import if missing
                if not anime:
                    media_data = sched.get("media")
                    if media_data:
                        try:
                            # Build a minimal payload the importer can handle
                            anime = import_anime_payload(db, media_data)
                            db.commit()
                        except Exception as e:
                            logger.warning(f"Could not auto-import anime {anilist_id}: {e}")
                            db.rollback()
                            continue

                if not anime:
                    continue

                # 3. Upsert Episode row
                try:
                    existing_ep = db.query(Episode).filter(
                        Episode.anime_id == anime.id,
                        Episode.episode_number == episode_number,
                    ).first()

                    if existing_ep:
                        existing_ep.airing_at = airing_dt
                    else:
                        ep_title = f"Episode {episode_number}"
                        db.add(Episode(
                            anime_id=anime.id,
                            episode_number=episode_number,
                            title=ep_title,
                            airing_at=airing_dt,
                            metadata_source="anilist",
                        ))

                    db.commit()
                    total += 1
                except Exception as e:
                    logger.warning(f"Episode upsert failed anime={anilist_id} ep={episode_number}: {e}")
                    db.rollback()

            has_next = (
                response.get("data", {})
                .get("Page", {})
                .get("pageInfo", {})
                .get("hasNextPage", False)
            )
            if not has_next:
                break
            page += 1

    finally:
        client.close()

    logger.info(f"Airing schedule sync complete: {total} episodes processed.")
    return total
