import sys
import hashlib
from datetime import datetime
from sqlalchemy import text

sys.path.append("/Users/irray/Desktop/Projects/AniVerse/apps/api")

import app.lists.models
import app.media.models
import app.community.models

from app.database import SessionLocal, engine
from app.anime.models import Anime
from app.recommendations.models import AnimeEmbedding

# Initialize SentenceTransformer. We defer import to inside functions to allow fast script loading.
MODEL_NAME = "all-MiniLM-L6-v2"

def compute_hash(text_data: str) -> str:
    return hashlib.sha256(text_data.encode("utf-8")).hexdigest()

def build_anime_text(anime: Anime) -> str:
    title_parts = []
    if anime.title_english: title_parts.append(anime.title_english)
    if anime.title_romaji: title_parts.append(anime.title_romaji)
    if anime.title_native: title_parts.append(anime.title_native)
    titles = ", ".join(title_parts)

    synopsis = anime.description or ""
    
    genres_list = [g.name for g in anime.genres] if hasattr(anime, "genres") else []
    genres = ", ".join(genres_list)

    tags_list = [t.name for t in anime.tags] if hasattr(anime, "tags") else []
    tags = ", ".join(tags_list)

    studios_list = [s.name for s in anime.studios] if hasattr(anime, "studios") else []
    studios = ", ".join(studios_list)

    text_doc = f"Title: {titles}. Synopsis: {synopsis}. Genres: {genres}. Tags: {tags}. Studios: {studios}."
    return text_doc

def sync_embeddings():
    print("🚀 Initializing Vector Database Extension...")
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.commit()
    print("✅ pgvector extension active.")

    db = SessionLocal()
    try:
        anime_list = db.query(Anime).all()
        if not anime_list:
            print("⚠️ No anime records found in the database. Please import AniList or seed first.")
            return

        print(f"🔍 Found {len(anime_list)} anime records to index.")
        
        # Load embedding model
        print("📥 Loading sentence-transformers model (all-MiniLM-L6-v2)...")
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer(MODEL_NAME)
        print("✅ Model loaded successfully.")

        count = 0
        for anime in anime_list:
            text_doc = build_anime_text(anime)
            content_hash = compute_hash(text_doc)

            # Check if embedding already exists and hash matches
            existing = db.query(AnimeEmbedding).filter(AnimeEmbedding.anime_id == anime.id).first()
            if existing and existing.content_hash == content_hash:
                continue

            # Generate embedding
            embedding_vector = model.encode(text_doc).tolist()

            if existing:
                existing.embedding = embedding_vector
                existing.content_hash = content_hash
                existing.generated_at = datetime.utcnow()
            else:
                emb = AnimeEmbedding(
                    anime_id=anime.id,
                    model_name=MODEL_NAME,
                    embedding=embedding_vector,
                    content_hash=content_hash,
                )
                db.add(emb)
            
            count += 1
            if count % 10 == 0:
                db.commit()
                print(f"💾 Indexed {count} anime vector records...")

        db.commit()
        print(f"🎉 Success! Synced {count} new/updated anime vector embeddings.")

    except Exception as e:
        print(f"❌ Synchronization failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    sync_embeddings()
