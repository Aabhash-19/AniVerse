import time
import logging
import sys

# Ensure app package is in path
sys.path.append("/Users/irray/Desktop/Projects/AniVerse/apps/api")

from app.database import SessionLocal
from app.ingestion.anilist import AniListClient
from app.ingestion.service import import_anime_payload, process_relations

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_anilist")

def seed_catalogue(max_pages: int = 10, per_page: int = 50):
    """
    Import popular anime titles from AniList GraphQL API into local PostgreSQL.
    Respects AniList's 90 req/min rate limit with small delays.
    """
    db = SessionLocal()
    client = AniListClient()
    total_imported = 0
    relations_map = {}

    print(f" Starting AniList Catalogue Bulk Ingestion ({max_pages} pages, {per_page} items/page)...")

    for page in range(1, max_pages + 1):
        print(f" Fetching Page {page}/{max_pages} from AniList GraphQL...")
        try:
            res = client.fetch_anime_page(page=page, per_page=per_page)
            media_list = res.get("data", {}).get("Page", {}).get("media", [])
            if not media_list:
                print("No more media returned. Ending sync.")
                break

            for media in media_list:
                try:
                    anime = import_anime_payload(db, media)
                    anilist_id = media["id"]
                    relations = media.get("relations", {}).get("edges") or []
                    relations_map[anilist_id] = relations
                    total_imported += 1
                    db.commit()
                except Exception as e:
                    logger.error(f"Failed to import anime {media.get('id')}: {e}")
                    db.rollback()

            print(f" Page {page} complete. Total imported so far: {total_imported}")
            time.sleep(0.7)  # Respect AniList rate limit

        except Exception as e:
            logger.error(f"Error fetching page {page}: {e}")
            time.sleep(2)

    try:
        print(" Post-processing relationship graph...")
        process_relations(db, relations_map)
    except Exception as e:
        logger.error(f"Error building relations: {e}")

    db.close()
    client.close()
    print(f" Bulk ingestion finished! Total anime imported: {total_imported}")

if __name__ == "__main__":
    max_p = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    seed_catalogue(max_pages=max_p, per_page=50)
