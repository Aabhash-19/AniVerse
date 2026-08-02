import enum
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, Boolean, DECIMAL,
    DateTime, Date, ForeignKey, PrimaryKeyConstraint, UniqueConstraint, Index, Enum
)
from sqlalchemy.orm import relationship
from app.database import Base


# --- Enum Declarations ---

class AnimeFormat(str, enum.Enum):
    TV = "TV"
    TV_SHORT = "TV_SHORT"
    MOVIE = "MOVIE"
    SPECIAL = "SPECIAL"
    OVA = "OVA"
    ONA = "ONA"
    MUSIC = "MUSIC"
    MANGA = "MANGA"
    NOVEL = "NOVEL"
    ONE_SHOT = "ONE_SHOT"


class AnimeStatus(str, enum.Enum):
    FINISHED = "FINISHED"
    RELEASING = "RELEASING"
    NOT_YET_RELEASED = "NOT_YET_RELEASED"
    CANCELLED = "CANCELLED"
    HIATUS = "HIATUS"


class SourceMaterial(str, enum.Enum):
    ORIGINAL = "ORIGINAL"
    MANGA = "MANGA"
    LIGHT_NOVEL = "LIGHT_NOVEL"
    VISUAL_NOVEL = "VISUAL_NOVEL"
    VIDEO_GAME = "VIDEO_GAME"
    OTHER = "OTHER"
    NOVEL = "NOVEL"
    DOUJINSHI = "DOUJINSHI"
    ANIME = "ANIME"
    WEB_NOVEL = "WEB_NOVEL"
    LIVE_ACTION = "LIVE_ACTION"
    GAME = "GAME"
    COMIC = "COMIC"
    MULTIMEDIA_PROJECT = "MULTIMEDIA_PROJECT"
    PICTURE_BOOK = "PICTURE_BOOK"


class AnimeSeason(str, enum.Enum):
    WINTER = "WINTER"
    SPRING = "SPRING"
    SUMMER = "SUMMER"
    FALL = "FALL"


class CharacterRole(str, enum.Enum):
    MAIN = "MAIN"
    SUPPORTING = "SUPPORTING"
    BACKGROUND = "BACKGROUND"


class RelationType(str, enum.Enum):
    PREQUEL = "PREQUEL"
    SEQUEL = "SEQUEL"
    PARENT = "PARENT"
    SIDE_STORY = "SIDE_STORY"
    CHARACTER = "CHARACTER"
    SUMMARY = "SUMMARY"
    ALTERNATIVE = "ALTERNATIVE"
    SPIN_OFF = "SPIN_OFF"
    OTHER = "OTHER"
    ADAPTATION = "ADAPTATION"
    COMPILATION = "COMPILATION"
    CONTAINS = "CONTAINS"
    SOURCE = "SOURCE"


# --- Database Models ---

class AnimeGenre(Base):
    __tablename__ = "anime_genres"
    anime_id = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), primary_key=True)
    genre_id = Column(Integer, ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True)


class AnimeTag(Base):
    __tablename__ = "anime_tags"
    anime_id = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(BigInteger, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
    rank = Column(Integer, nullable=True)
    is_spoiler = Column(Boolean, default=False, nullable=False)


class AnimeStudio(Base):
    __tablename__ = "anime_studios"
    anime_id = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), primary_key=True)
    studio_id = Column(BigInteger, ForeignKey("studios.id", ondelete="CASCADE"), primary_key=True)
    is_main = Column(Boolean, default=False, nullable=False)


class AnimeCharacter(Base):
    __tablename__ = "anime_characters"
    anime_id = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), primary_key=True)
    character_id = Column(BigInteger, ForeignKey("characters.id", ondelete="CASCADE"), primary_key=True)
    role = Column(Enum(CharacterRole, name="characterrole"), nullable=False, default=CharacterRole.SUPPORTING)
    order_index = Column(Integer, nullable=True)


class AnimeStaff(Base):
    __tablename__ = "anime_staff"
    anime_id = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), primary_key=True)
    staff_id = Column(BigInteger, ForeignKey("staff.id", ondelete="CASCADE"), primary_key=True)
    role = Column(String, primary_key=True)


class VoiceActor(Base):
    __tablename__ = "voice_actors"
    anime_id = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), primary_key=True)
    character_id = Column(BigInteger, ForeignKey("characters.id", ondelete="CASCADE"), primary_key=True)
    staff_id = Column(BigInteger, ForeignKey("staff.id", ondelete="CASCADE"), primary_key=True)
    language = Column(String, primary_key=True, default="Japanese")


class AnimeRelation(Base):
    __tablename__ = "anime_relations"
    source_anime_id = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), primary_key=True)
    target_anime_id = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), primary_key=True)
    relation_type = Column(Enum(RelationType, name="relationtype"), primary_key=True)


class Anime(Base):
    __tablename__ = "anime"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    anilist_id = Column(BigInteger, unique=True, nullable=False, index=True)
    slug = Column(String, nullable=False, index=True)
    
    title_romaji = Column(Text, nullable=True)
    title_english = Column(Text, nullable=True)
    title_native = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    
    format = Column(Enum(AnimeFormat, name="animeformat"), nullable=True)
    status = Column(Enum(AnimeStatus, name="animestatus"), nullable=True)
    source_material = Column(Enum(SourceMaterial, name="sourcematerial"), nullable=True)
    season = Column(Enum(AnimeSeason, name="animeseason"), nullable=True)
    season_year = Column(Integer, nullable=True, index=True)
    
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    episode_count = Column(Integer, nullable=True)
    episode_duration = Column(Integer, nullable=True)
    country_code = Column(String(2), nullable=True)
    is_adult = Column(Boolean, default=False, nullable=False)
    
    average_score = Column(DECIMAL(5, 2), nullable=True)
    popularity = Column(Integer, default=0, nullable=False)
    favourites = Column(Integer, default=0, nullable=False)
    
    cover_large_url = Column(Text, nullable=True)
    cover_medium_url = Column(Text, nullable=True)
    banner_url = Column(Text, nullable=True)
    official_site_url = Column(Text, nullable=True)
    
    metadata_source = Column(String, default="anilist", nullable=False)
    source_updated_at = Column(DateTime, nullable=True)
    last_synced_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    titles = relationship("AnimeTitle", back_populates="anime", cascade="all, delete-orphan")
    genres = relationship("Genre", secondary="anime_genres", back_populates="anime")
    tags = relationship("Tag", secondary="anime_tags")
    studios = relationship("Studio", secondary="anime_studios", back_populates="anime")
    characters = relationship("Character", secondary="anime_characters")
    episodes = relationship("Episode", back_populates="anime", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index("idx_anime_season_year", "season", "season_year"),
        Index("idx_anime_status", "status"),
        Index("idx_anime_popularity", popularity.desc()),
        Index("idx_anime_score", average_score.desc()),
    )


class AnimeTitle(Base):
    __tablename__ = "anime_titles"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    anime_id = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), nullable=False)
    title = Column(Text, nullable=False)
    language = Column(String, nullable=False)
    title_type = Column(String, nullable=True)  # English, Romaji, Native, Synonym
    normalized_title = Column(Text, nullable=False, index=True)

    anime = relationship("Anime", back_populates="titles")


class Genre(Base):
    __tablename__ = "genres"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    slug = Column(String, unique=True, nullable=False)

    anime = relationship("Anime", secondary="anime_genres", back_populates="genres")


class Tag(Base):
    __tablename__ = "tags"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    anilist_id = Column(BigInteger, unique=True, nullable=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True)
    is_adult = Column(Boolean, default=False, nullable=False)


class Studio(Base):
    __tablename__ = "studios"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    anilist_id = Column(BigInteger, unique=True, nullable=True)
    name = Column(String, nullable=False)
    is_animation_studio = Column(Boolean, default=False, nullable=False)
    site_url = Column(Text, nullable=True)

    anime = relationship("Anime", secondary="anime_studios", back_populates="studios")


class Character(Base):
    __tablename__ = "characters"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    anilist_id = Column(BigInteger, unique=True, nullable=True)
    first_name = Column(String, nullable=True)
    middle_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    native_name = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    gender = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)


class Staff(Base):
    __tablename__ = "staff"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    anilist_id = Column(BigInteger, unique=True, nullable=True)
    first_name = Column(String, nullable=True)
    middle_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    native_name = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)


class Episode(Base):
    __tablename__ = "episodes"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    anime_id = Column(BigInteger, ForeignKey("anime.id", ondelete="CASCADE"), nullable=False)
    episode_number = Column(DECIMAL(6, 1), nullable=False)
    season_number = Column(Integer, default=1, nullable=False)
    title = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    airing_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    thumbnail_url = Column(Text, nullable=True)
    metadata_source = Column(String, default="anilist", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    anime = relationship("Anime", back_populates="episodes")
    
    __table_args__ = (
        UniqueConstraint("anime_id", "episode_number", name="uq_anime_episode_number"),
    )
