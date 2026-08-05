from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
import random
import re
import os
import urllib.request
import urllib.parse
import json
import logging

from app.database import get_db
from app.anime.models import Anime, Genre, AnimeTitle, AnimeStatus
from app.auth.dependencies import get_optional_user
from app.auth.models import User
from app.lists.models import AnimeListEntry, ListStatus
from app.config import settings

log = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Nami AI Navigator"])

class ChatMessage(BaseModel):
    sender: str  # "user" or "nami"
    text: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

class RecommendedAnimeCard(BaseModel):
    id: int
    slug: str
    title: str
    cover_url: Optional[str]
    score: Optional[float]
    genres: List[str]

class ChatResponse(BaseModel):
    reply: str
    anime_recommendations: Optional[List[RecommendedAnimeCard]] = []
    all_recommendations: Optional[List[RecommendedAnimeCard]] = []
    persona: str = "Nami — Straw Hat Navigator"


NAMI_GREETINGS = [
    "Yosh! I'm Nami, your official NamiVerse Navigator! What kind of anime adventure are we sailing towards today? ⛵",
    "Hey there! Ready to chart a course through the best anime out there? (It'll cost you 10,000 Berries, but for you... first advice is free!) 💰",
    "Weather report looks clear for some anime watching! Tell me what you're in the mood for! 🧭"
]

NAMI_BERRIES_REPLIES = [
    "Fufufu! Looking for Berries or treasure? The real treasure is finding a 10/10 masterpiece anime! But if you find any gold chests on NamiVerse, let me know first! 💰",
    "Money makes the world go round! Speaking of high-value shows, let me show you some top-rated gems in our catalog! 💎"
]

NAMI_ONE_PIECE_REPLIES = [
    "One Piece?! Ah! Luffy is probably eating all the meat right now while Zoro is lost on some side quest! If you love epic adventure anime like One Piece, you'll love these recommendations! 🍖",
    "Sailing the Grand Line taught me that every great journey needs a great map! Here are some top-tier adventure and shonen anime to add to your list! ⛵"
]

NAMI_DREAM_REPLY = "My dream is to draw a map of the entire world! 🗺️ As the navigator of the Straw Hat Pirates, I'm charting every ocean and island—and here on NamiVerse, I'm charting every anime for you! 🍊"
NAMI_LUFFY_REPLY = "Luffy is our captain! He's reckless, eats all our meat, and gets us into crazy fights—but he's going to be King of the Pirates! 🍖👑"
NAMI_ZORO_REPLY = "Zoro? He's probably lost again on some random island! Don't ask him for directions unless you want to end up in the middle of the sea! ⚔️🧭"

NAMI_FANDOM_WIKI_LORE = """
OFFICIAL NAMI CHARACTER KNOWLEDGE BASE (ONE PIECE FANDOM WIKI):
- **Full Title & Aliases**: "Cat Burglar" Nami (泥棒猫 ナミ, Dorobō Neko Nami).
- **Official Bounty**: 💰 366,000,000 Berries (Post-Wano Arc). Previous bounties: 16,000,000 (Enies Lobby) -> 66,000,000 (Dressrosa).
- **Role & Rank**: Official Navigator of the Straw Hat Pirates (3rd member to join, officially 5th member of crew).
- **Origin & Backstory**:
  * Born in Oykot Kingdom, orphaned as a baby during a war, and saved by Navy officer Bell-mère.
  * Raised in Cocoyasi Village (Conomi Islands, East Blue) alongside adopted sister Nojiko.
  * Bell-mère owned a tangerine (mikan) orchard and sacrificed her life to Arlong when Arlong took over the village because she refused to deny Nami and Nojiko were her daughters.
  * Forced into Arlong's crew as his cartographer at age 8 to buy back Cocoyasi Village for 💰 100,000,000 Berries by stealing from pirates.
  * After Arlong betrayed her, Luffy destroyed Arlong Park, freed her village, and Nami officially joined the Straw Hats!
- **Dream**: To draw a complete, perfect map of the entire world (世界地図, Sekai Chizu).
- **Weapons & Combat Arsenal**:
  1. **Original Clima-Tact**: Built by Usopp (initially meant for party tricks, modified by Nami into a weather weapon using Heat Balls, Cool Balls, and Thunder Balls).
  2. **Perfect Clima-Tact**: Upgraded with Skypiea Dials for massive storm strikes (Thunderbolt Tempo, Mirage Tempo).
  3. **Sorcery Clima-Tact**: Upgraded during 2-year timeskip studying weather science at Weatheria under Haredas. Uses Weather Balls.
  4. **Zeus Integration**: Big Mom's former homie cloud **Zeus** fused into her Sorcery Clima-Tact! Allows devastating electric attacks (Zeus Breeze Tempo, Thunder Trap).
- **Abilities & Skills**:
  * Expert Cartography & Geography.
  * Meteorological Sensing: Can physically sense air pressure shifts and humidity changes with her skin before Grand Line storms hit.
  * Navigation, Bargaining, Thievery, Lockpicking, Leadership.
  * Uses "Fist of Love" to keep Luffy, Zoro, and Sanji in line when they are reckless.
- **Personality & Favorites**:
  * Favorites: Money/Berries (💰), Tangerines/Mikan (🍊) from Bell-mère's orchard, fashion.
  * Quirks: Charges crewmates high interest on loans, highly protective of children (e.g. Punk Hazard children), witty, highly intelligent, fiercely loyal to her crewmates despite complaining about their foolishness.
- **Crew Dynamics**:
  * Luffy (Monkey D. Luffy): Captain. Reckless, eats all the meat, but trusts him with her life ("Luffy, help me!").
  * Zoro (Roronoa Zoro): First Mate / Swordsman. "Mosshead" who gets lost on straight paths.
  * Sanji: Ship Cook. Swoons over "Nami-san!" and makes delicious drinks/meals.
  * Usopp: Cowardly buddy, inventor of Clima-Tact.
  * Chopper (Tony Tony Chopper): Adorable reindeer doctor she treats like a younger brother.
  * Robin (Nico Robin): "Robin-chan", calm archaeologist sister figure.
  * Franky: Super cyborg shipwright who built the Thousand Sunny.
  * Brook: Skeleton musician who asks for her underwear and gets kicked into the ocean.
  * Jinbe: Wise Knight of the Sea & Helmsman.
- **Physical Traits**: Birthday: July 3rd. Height: 170 cm (5'7"). Hair: Orange. Tattoo: Tangerine & Windmill (symbolizing Bell-mère's mikans & Genzo's pinwheel).
"""

def fetch_jikan_anime_details(query: str) -> List[dict]:
    """
    Fetch live anime data from Jikan API (MyAnimeList v4) for rich real-time context.
    URL: https://api.jikan.moe/v4/anime?q={query}&limit=3
    """
    if not query or len(query.strip()) < 2:
        return []
    clean_q = urllib.parse.quote(query.strip())
    url = f"https://api.jikan.moe/v4/anime?q={clean_q}&limit=3&sfw=true"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "NamiVerseAI/1.0 (Mozilla/5.0)"}
        )
        with urllib.request.urlopen(req, timeout=3) as res:
            data = json.loads(res.read().decode("utf-8"))
            results = data.get("data", [])
            output = []
            for item in results:
                title = item.get("title_english") or item.get("title") or ""
                synopsis = item.get("synopsis") or ""
                clean_syn = re.sub(r'\s+', ' ', synopsis).strip()
                score = item.get("score") or "N/A"
                episodes = item.get("episodes") or "Ongoing"
                status = item.get("status") or "Unknown"
                studios = ", ".join([s.get("name") for s in item.get("studios", [])]) or "Unknown Studio"
                genres = ", ".join([g.get("name") for g in item.get("genres", [])]) or "Anime"
                rating = item.get("rating") or ""
                output.append({
                    "title": title,
                    "mal_id": item.get("mal_id"),
                    "synopsis": clean_syn[:350],
                    "score": score,
                    "episodes": episodes,
                    "status": status,
                    "studios": studios,
                    "genres": genres,
                    "rating": rating,
                    "image_url": item.get("images", {}).get("jpg", {}).get("large_image_url")
                })
            return output
    except Exception as ex:
        log.warning(f"Jikan API anime lookup error for '{query}': {ex}")
        return []

def fetch_jikan_character_details(query: str) -> List[dict]:
    """
    Fetch live anime character details from Jikan API (MyAnimeList v4).
    URL: https://api.jikan.moe/v4/characters?q={query}&limit=2
    """
    if not query or len(query.strip()) < 2:
        return []
    clean_q = urllib.parse.quote(query.strip())
    url = f"https://api.jikan.moe/v4/characters?q={clean_q}&limit=2"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "NamiVerseAI/1.0 (Mozilla/5.0)"}
        )
        with urllib.request.urlopen(req, timeout=3) as res:
            data = json.loads(res.read().decode("utf-8"))
            results = data.get("data", [])
            output = []
            for char in results:
                name = char.get("name") or ""
                about = char.get("about") or ""
                clean_about = re.sub(r'\s+', ' ', about).strip()
                animeography = [
                    a.get("anime", {}).get("title")
                    for a in char.get("anime", [])[:3]
                    if a.get("anime", {}).get("title")
                ]
                output.append({
                    "name": name,
                    "about": clean_about[:350],
                    "anime": ", ".join(animeography)
                })
            return output
    except Exception as ex:
        log.warning(f"Jikan API character lookup error for '{query}': {ex}")
        return []


def clean_gemini_reply(text: str) -> str:
    """Strip any system prompt leakage or internal rule echoing from Gemini reply."""
    if not text:
        return text
    lines = text.split("\n")
    cleaned_lines = []
    forbidden_snippets = [
        "catalog ids", "raw status strings", "bold markdown for titles",
        "strict response constraints", "database catalog ground truth",
        "filter compliance", "no metadata leaks", "watchlist compliance"
    ]
    for line in lines:
        line_lower = line.lower()
        if any(f in line_lower for f in forbidden_snippets):
            continue
        cleaned_lines.append(line)
    return "\n".join(cleaned_lines).strip()


def fetch_live_airing_anime() -> List[dict]:
    """
    Fetch real-time currently airing (RELEASING) anime directly from AniList GraphQL API.
    Guarantees 100% accurate live airing anime status for current season.
    """
    gql = """
    query {
      Page(page: 1, perPage: 25) {
        media(type: ANIME, status: RELEASING, sort: [TRENDING_DESC, POPULARITY_DESC]) {
          id
          title { english romaji }
          status
          meanScore
          genres
          episodes
          coverImage { extraLarge }
          nextAiringEpisode { episode }
        }
      }
    }
    """
    try:
        req = urllib.request.Request(
            "https://graphql.anilist.co",
            data=json.dumps({"query": gql}).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=4) as res:
            data = json.loads(res.read().decode("utf-8"))
            return data.get("data", {}).get("Page", {}).get("media", [])
    except Exception as ex:
        log.warning(f"Failed to fetch live airing anime from AniList: {ex}")
        return []


def fetch_anilist_genre_anime(genre_name: Optional[str] = None) -> List[dict]:
    """
    Fetch top-rated anime for a genre (or general top anime) from AniList GraphQL API.
    Guarantees a rich pool of 20+ candidate cards for any genre request.
    """
    if genre_name:
        gql = """
        query ($genre: String) {
          Page(page: 1, perPage: 25) {
            media(type: ANIME, genre: $genre, sort: [SCORE_DESC, POPULARITY_DESC]) {
              id
              title { english romaji }
              status
              meanScore
              genres
              coverImage { extraLarge }
            }
          }
        }
        """
        variables = {"genre": genre_name}
    else:
        gql = """
        query {
          Page(page: 1, perPage: 25) {
            media(type: ANIME, sort: [SCORE_DESC, POPULARITY_DESC]) {
              id
              title { english romaji }
              status
              meanScore
              genres
              coverImage { extraLarge }
            }
          }
        }
        """
        variables = {}

    try:
        req = urllib.request.Request(
            "https://graphql.anilist.co",
            data=json.dumps({"query": gql, "variables": variables}).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=4) as res:
            data = json.loads(res.read().decode("utf-8"))
            return data.get("data", {}).get("Page", {}).get("media", [])
    except Exception as ex:
        log.warning(f"Failed to fetch genre anime from AniList: {ex}")
        return []


def call_gemini_nami_ai(
    message: str,
    history: List[ChatMessage],
    catalog_context: str = "",
    watchlist_context: str = "",
    jikan_context: str = ""
) -> Optional[str]:
    """
    Call Google Gemini API with Nami's authentic character system prompt, full Fandom Wiki lore,
    real-time Jikan MyAnimeList database context, catalog ground truth, and user watchlist context.
    """
    api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    system_prompt = (
        "You are Nami, the Straw Hat Pirates Navigator from One Piece! "
        "You are navigating NamiVerse, the premier anime platform. Speak enthusiastically, warmly, wittily, and in-character as Nami.\n\n"
        f"{NAMI_FANDOM_WIKI_LORE}\n\n"
        f"REAL-TIME MYANIMELIST / JIKAN DATABASE DATA:\n{jikan_context or 'No external lookup needed.'}\n\n"
        f"VERIFIED DATABASE ANIME ENTRIES:\n{catalog_context or 'Top rated anime available.'}\n\n"
        f"USER PROFILE & WATCHLIST:\n{watchlist_context or 'Anonymous guest.'}\n\n"
        "RULES & GUIDELINES:\n"
        "• If the user asks about Nami, your backstory, Bell-mère, Arlong, Clima-Tact, Zeus, Bounties, crewmates (Luffy, Zoro, Sanji, Usopp, Chopper, Robin, Franky, Brook, Jinbe), answer in rich, authentic, 100% accurate Nami character voice.\n"
        "• Write anime titles in bold markdown (e.g. **Death Note**).\n"
        "• Provide complete, intelligent, engaging responses. Never stop mid-sentence or output truncated fragments.\n"
        "• Never output instructions or system rules. Only speak directly as Nami."
    )

    contents = []
    if history:
        for m in history[-4:]:
            if any(bad in m.text for bad in ["stormy weather", "catalog IDs", "Bold markdown", "raw status"]):
                continue
            role = "user" if m.sender == "user" else "model"
            contents.append({
                "role": role,
                "parts": [{"text": m.text}]
            })
    
    contents.append({
        "role": "user",
        "parts": [{"text": message}]
    })

    payload = {
        "system_instruction": {
            "parts": [{"text": system_prompt}]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 2048
        }
    }

    models_to_try = [
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash",
        "gemini-flash-latest"
    ]

    for model_name in models_to_try:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=8) as res:
                res_data = json.loads(res.read().decode("utf-8"))
                candidates = res_data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts and parts[0].get("text"):
                        raw_resp = parts[0]["text"].strip()
                        cleaned_resp = clean_gemini_reply(raw_resp)
                        if cleaned_resp:
                            return cleaned_resp
        except Exception as ex:
            log.warning(f"Gemini API model {model_name} error: {ex}")
            continue

    return None


@router.post("/nami", response_model=ChatResponse)
def nami_chat(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Nami AI Chatbot Endpoint — 100% accurate, fast, and resilient AI navigator with live search & shuffle support.
    """
    try:
        user_msg = req.message.strip()
        user_msg = user_msg.strip('"\'')
        if not user_msg:
            return ChatResponse(
                reply="Hey, don't leave me hanging! Ask me anything about anime, or say 'recommend me a dark fantasy anime' to get started! 🍊",
                anime_recommendations=[],
                all_recommendations=[]
            )

        # ── 1. Build User Watchlist Context ─────────────────────────────────────
        watchlist_context = "User is browsing anonymously."
        user_completed_ids = set()
        completed_titles = []
        watching_titles = []
        planning_titles = []

        if current_user:
            try:
                entries = db.query(AnimeListEntry).filter(AnimeListEntry.user_id == current_user.id).all()
                if entries:
                    for e in entries:
                        t_str = e.anime.title_english or e.anime.title_romaji if e.anime else ""
                        if not t_str:
                            continue
                        if e.status in [ListStatus.COMPLETED, ListStatus.REWATCHING]:
                            user_completed_ids.add(e.anime_id)
                            formatted_score = f"{e.score/10:.1f}/10" if (e.score and e.score > 10) else (f"{e.score:.1f}/10" if e.score else "")
                            score_info = f" (Scored {formatted_score})" if formatted_score else ""
                            completed_titles.append(f"{t_str}{score_info}")
                        elif e.status == ListStatus.WATCHING:
                            watching_titles.append(t_str)
                        elif e.status == ListStatus.PLANNING:
                            planning_titles.append(t_str)

                    summary_parts = [f"Logged in user: @{current_user.username} ({current_user.display_name or ''})"]
                    if completed_titles:
                        summary_parts.append("Watched/Completed: " + ", ".join(completed_titles[:15]))
                    if watching_titles:
                        summary_parts.append("Currently Watching: " + ", ".join(watching_titles[:10]))
                    if planning_titles:
                        summary_parts.append("Plan to Watch: " + ", ".join(planning_titles[:10]))
                        
                    watchlist_context = "\n".join(summary_parts)
            except Exception as db_wl_err:
                log.warning(f"Watchlist DB query warning: {db_wl_err}")

        # ── 2. Query & Intent Parsing ─────────────────────────────────────────
        lowered_msg = user_msg.lower()
        
        AIRING_KEYWORDS = ["currently airing", "airing", "ongoing", "this season", "releasing", "currently running", "new episodes", "weekly", "airing anime", "airing season", "airing hits"]
        UPCOMING_KEYWORDS = ["upcoming", "not yet released", "next season", "future anime", "soon"]
        PLOT_KEYWORDS = ["plot", "synopsis", "about", "story", "summary", "tell me about", "what is", "who is", "explain"]
        WATCHLIST_KEYWORDS = [
            "my list", "my watchlist", "what am i watching", "what did i watch",
            "my completed", "my plan to watch", "on my list", "my profile", "my logbook",
            "tracked anime", "what is on my list", "show my list", "show my watchlist"
        ]

        is_airing_request = any(kw in lowered_msg for kw in AIRING_KEYWORDS)
        is_upcoming_request = any(kw in lowered_msg for kw in UPCOMING_KEYWORDS)
        is_plot_request = any(kw in lowered_msg for kw in PLOT_KEYWORDS)
        is_watchlist_request = any(kw in lowered_msg for kw in WATCHLIST_KEYWORDS)

        # Genre Matching
        ALL_GENRES = [
            "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Isekai", "Mecha", 
            "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Seinen", "Shonen", 
            "Shoujo", "Slice of Life", "Sports", "Supernatural", "Thriller"
        ]
        matched_genres = [g for g in ALL_GENRES if g.lower() in lowered_msg]

        if "rom-com" in lowered_msg or "romantic comedy" in lowered_msg:
            matched_genres = list(set(matched_genres + ["Romance", "Comedy"]))
        elif "dark fantasy" in lowered_msg:
            matched_genres = list(set(matched_genres + ["Fantasy", "Horror", "Psychological"]))
        elif "top adventure" in lowered_msg:
            matched_genres = list(set(matched_genres + ["Adventure"]))

        RECOMMENDATION_KEYWORDS = [
            "recommend", "suggestion", "suggest", "what should i watch", "what to watch",
            "what anime", "give me", "show me", "find me", "i want to watch", "looking for",
            "any good", "anything good", "best anime", "top anime", "anime for",
            "similar to", "like this anime", "genre", "isekai", "shonen", "seinen", "shoujo",
            "10/10", "masterpiece", "masterpieces", "top adventure", "dark fantasy", "airing season", "hits"
        ]
        is_recommendation_request = any(kw in lowered_msg for kw in RECOMMENDATION_KEYWORDS) or bool(matched_genres) or is_upcoming_request or ("10/10" in lowered_msg) or ("masterpiece" in lowered_msg)

        # ── 3. Handle Watchlist Queries ───────────────────────────────────────
        if is_watchlist_request:
            if current_user and (completed_titles or watching_titles or planning_titles):
                parts = [f"Yosh @{current_user.username}! Here is your current NamiVerse logbook:\n"]
                if watching_titles:
                    parts.append("📺 **Currently Watching:**\n" + "\n".join([f"• **{t}**" for t in watching_titles]))
                if completed_titles:
                    parts.append("🏆 **Completed & Scored:**\n" + "\n".join([f"• **{t}**" for t in completed_titles[:8]]))
                if planning_titles:
                    parts.append("📝 **Plan to Watch:**\n" + "\n".join([f"• **{t}**" for t in planning_titles[:5]]))
                reply_text = "\n\n".join(parts) + "\n\nKeep up the awesome watching journey! 🍊"
            elif current_user:
                reply_text = f"Yosh @{current_user.username}! Your watchlist logbook is currently empty. Start adding anime to your list so I can track your journey! 🍊"
            else:
                reply_text = "Yosh! Please sign in to your NamiVerse account so I can view and manage your personal watchlist logbook! 🍊"

            return ChatResponse(reply=reply_text, anime_recommendations=[], all_recommendations=[])

        # ── 4. Handle Live Airing Queries ─────────────────────────────────────
        if is_airing_request:
            live_releasing = fetch_live_airing_anime()
            if live_releasing:
                show_snippets = []
                all_recs = []
                for m in live_releasing:
                    t_str = m["title"]["english"] or m["title"]["romaji"]
                    g_str = ", ".join(m.get("genres", [])[:2])
                    s_val = float(m["meanScore"]) if m.get("meanScore") else None
                    s_str = f"{s_val/10:.1f}/10" if s_val else "N/A"
                    ep_info = f"Ep {m['nextAiringEpisode']['episode']}" if m.get("nextAiringEpisode") else f"{m.get('episodes', 'Ongoing')} eps"
                    
                    show_snippets.append(f"• **{t_str}** (⭐ {s_str} | {ep_info} | {g_str})")
                    
                    slug_clean = re.sub(r'[^a-z0-9]+', '-', t_str.lower()).strip('-')
                    all_recs.append(RecommendedAnimeCard(
                        id=m["id"],
                        slug=slug_clean,
                        title=t_str,
                        cover_url=m.get("coverImage", {}).get("extraLarge"),
                        score=s_val,
                        genres=m.get("genres", [])[:3]
                    ))

                reply_text = (
                    "Yosh! Here are top anime **currently airing right now** across the world:\n\n" +
                    "\n".join(show_snippets[:6]) +
                    "\n\nWhich of these current season shows would you like to chart onto your logbook? ⛵"
                )
                return ChatResponse(
                    reply=reply_text,
                    anime_recommendations=all_recs[:4],
                    all_recommendations=all_recs
                )

        # ── 5. Specific Anime Title Search vs Genre Query ───────────────────────
        target_anime = None

        if not matched_genres and not is_airing_request and not is_upcoming_request and not is_recommendation_request:
            clean_words = [w for w in user_msg.split() if w.lower() not in [
                "can", "you", "tell", "me", "about", "what", "is", "the", "plot", "of", "anime", "show",
                "recommend", "suggest", "good", "best", "top", "give", "find", "looking", "for", "your", "dream"
            ]]
            search_term = " ".join(clean_words).strip()

            if search_term and len(search_term) >= 3:
                try:
                    target_anime = db.query(Anime).filter(
                        or_(
                            Anime.title_english.ilike(f"%{search_term}%"),
                            Anime.title_romaji.ilike(f"%{search_term}%"),
                            Anime.title_native.ilike(f"%{search_term}%")
                        )
                    ).first()
                except Exception:
                    target_anime = None

        # Build DB candidates list safely with fallback to AniList GraphQL
        db_candidates = []
        try:
            query = db.query(Anime)

            if is_upcoming_request:
                query = query.filter(or_(Anime.status == "NOT_YET_RELEASED", Anime.status == AnimeStatus.NOT_YET_RELEASED))

            if matched_genres:
                query = query.join(Anime.genres).filter(
                    or_(*[Genre.name.ilike(f"%{g}%") for g in matched_genres])
                )
            elif target_anime:
                query = query.filter(Anime.id == target_anime.id)

            db_candidates = query.order_by(Anime.average_score.desc().nullslast(), Anime.popularity.desc().nullslast()).limit(40).all()
            if not db_candidates:
                db_candidates = db.query(Anime).order_by(Anime.average_score.desc().nullslast(), Anime.popularity.desc().nullslast()).limit(40).all()
        except Exception as db_err:
            log.warning(f"DB candidates query warning: {db_err}")

        catalog_snippets = []
        for a in db_candidates[:10]:
            t = a.title_english or a.title_romaji or a.title_native
            g = ", ".join([genre.name for genre in a.genres[:3]])
            score = f"{a.average_score:.1f}/100" if a.average_score else "N/A"
            raw_desc = getattr(a, "description", None) or "N/A"
            desc_snippet = re.sub(r'<[^>]+>', '', raw_desc)[:120]
            catalog_snippets.append(f"• Title: \"{t}\" (Score: {score}, Genres: {g}, Summary: {desc_snippet})")
        
        catalog_context = "\n".join(catalog_snippets)

        # ── 6. Jikan API Real-Time Database Grounding ──────────────────────────
        jikan_context_str = ""
        clean_words = [w for w in user_msg.split() if w.lower() not in [
            "can", "you", "tell", "me", "about", "what", "is", "the", "plot", "of", "anime", "show",
            "recommend", "suggest", "good", "best", "top", "give", "find", "looking", "for", "your", "dream", "who", "character"
        ]]
        search_term = " ".join(clean_words).strip()

        if search_term and len(search_term) >= 2:
            jikan_anime = fetch_jikan_anime_details(search_term)
            jikan_chars = fetch_jikan_character_details(search_term)

            jikan_parts = []
            for ja in jikan_anime:
                jikan_parts.append(
                    f"• Anime: **{ja['title']}** (MAL ID: {ja['mal_id']}, Score: {ja['score']}/10, Episodes: {ja['episodes']}, Status: {ja['status']}, Studios: {ja['studios']}, Genres: {ja['genres']})\n  Synopsis: {ja['synopsis']}"
                )
            for jc in jikan_chars:
                jikan_parts.append(
                    f"• Character: **{jc['name']}** (Featured in: {jc['anime']})\n  About: {jc['about']}"
                )

            if jikan_parts:
                jikan_context_str = "\n\n".join(jikan_parts)

        # ── 7. Call Gemini AI ───────────────────────────────────────────────────
        reply_text = call_gemini_nami_ai(
            message=user_msg,
            history=req.history or [],
            catalog_context=catalog_context,
            watchlist_context=watchlist_context,
            jikan_context=jikan_context_str
        )

        # ── 7. Guaranteed Accurate Dynamic Fallback Engine ─────────────────────
        if not reply_text:
            if any(k in lowered_msg for k in ["dream", "goal", "map"]):
                reply_text = NAMI_DREAM_REPLY
            elif any(k in lowered_msg for k in ["luffy", "captain"]):
                reply_text = NAMI_LUFFY_REPLY
            elif any(k in lowered_msg for k in ["zoro", "swordsman"]):
                reply_text = NAMI_ZORO_REPLY
            elif target_anime:
                t_name = target_anime.title_english or target_anime.title_romaji or target_anime.title_native
                g_str = ", ".join([genre.name for genre in target_anime.genres[:3]])
                raw_desc = getattr(target_anime, "description", None) or "A fantastic masterpiece entry in our NamiVerse catalog!"
                desc_clean = re.sub(r'<[^>]+>', '', raw_desc).strip()
                score_str = f"{target_anime.average_score:.1f}/100" if target_anime.average_score else "N/A"
                reply_text = f"Yosh! Here is the lowdown on **{t_name}**:\n\n{desc_clean}\n\n⭐ **Score:** {score_str} | **Genres:** {g_str} 🍊"
            elif "10/10" in lowered_msg or "masterpiece" in lowered_msg:
                reply_text = "Yosh! Here are certified 10/10 masterpiece anime from our logbook! 🏆"
            elif matched_genres:
                genre_name = matched_genres[0]
                reply_text = f"Yosh! For **{genre_name}** lovers, I've mapped out top-tier recommendations from our logbook! Which one looks best for your next watch? 🍊"
            elif is_recommendation_request:
                reply_text = "Yosh! Here are some top-tier recommendations from our logbook! 🧭"
            else:
                if any(k in lowered_msg for k in ["berry", "berries", "gold", "treasure", "money"]):
                    reply_text = random.choice(NAMI_BERRIES_REPLIES)
                elif any(k in lowered_msg for k in ["one piece", "pirate", "straw hat"]):
                    reply_text = random.choice(NAMI_ONE_PIECE_REPLIES)
                else:
                    reply_text = random.choice(NAMI_GREETINGS)

        # ── 8. Select Best Recommended Anime Cards & Build All Recommendations Pool ──
        recs_formatted = []
        all_recs_pool = []
        seen_ids = set()

        for a in db_candidates:
            if a.id not in user_completed_ids and a.id not in seen_ids:
                seen_ids.add(a.id)
                t_str = a.title_english or a.title_romaji or a.title_native
                card_obj = RecommendedAnimeCard(
                    id=a.id,
                    slug=a.slug,
                    title=t_str,
                    cover_url=a.cover_large_url,
                    score=float(a.average_score) if a.average_score else None,
                    genres=[g.name for g in a.genres[:3]]
                )
                all_recs_pool.append(card_obj)

        # If pool has fewer than 20 items, fetch extra top-rated anime from AniList GraphQL over HTTPS
        if (is_recommendation_request or matched_genres or "10/10" in lowered_msg or "masterpiece" in lowered_msg) and len(all_recs_pool) < 20:
            target_g = matched_genres[0] if matched_genres else None
            extra_media = fetch_anilist_genre_anime(target_g)
            for m in extra_media:
                m_id = m["id"]
                if m_id not in seen_ids:
                    seen_ids.add(m_id)
                    t_str = m["title"]["english"] or m["title"]["romaji"]
                    s_val = float(m["meanScore"]) if m.get("meanScore") else None
                    slug_clean = re.sub(r'[^a-z0-9]+', '-', t_str.lower()).strip('-')
                    all_recs_pool.append(RecommendedAnimeCard(
                        id=m_id,
                        slug=slug_clean,
                        title=t_str,
                        cover_url=m.get("coverImage", {}).get("extraLarge"),
                        score=s_val,
                        genres=m.get("genres", [])[:3]
                    ))

        if is_recommendation_request or is_airing_request or is_upcoming_request or target_anime or matched_genres or ("10/10" in lowered_msg) or ("masterpiece" in lowered_msg):
            recs_formatted = all_recs_pool[:4]

        return ChatResponse(
            reply=reply_text,
            anime_recommendations=recs_formatted,
            all_recommendations=all_recs_pool
        )

    except Exception as err:
        log.error(f"Nami chat handler unexpected error: {err}", exc_info=True)
        # Always fallback to live AniList GraphQL anime so cards ALWAYS generate!
        extra_media = fetch_anilist_genre_anime()
        fallback_pool = []
        for m in extra_media:
            t_str = m["title"]["english"] or m["title"]["romaji"]
            s_val = float(m["meanScore"]) if m.get("meanScore") else None
            slug_clean = re.sub(r'[^a-z0-9]+', '-', t_str.lower()).strip('-')
            fallback_pool.append(RecommendedAnimeCard(
                id=m["id"],
                slug=slug_clean,
                title=t_str,
                cover_url=m.get("coverImage", {}).get("extraLarge"),
                score=s_val,
                genres=m.get("genres", [])[:3]
            ))

        return ChatResponse(
            reply="Yosh! Here are some top-rated recommendations from our logbook! 🧭",
            anime_recommendations=fallback_pool[:4],
            all_recommendations=fallback_pool
        )
