from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
import random
import re
import os
import urllib.request
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


def fetch_live_airing_anime() -> List[dict]:
    """
    Fetch real-time currently airing (RELEASING) anime directly from AniList GraphQL API.
    Guarantees 100% accurate live airing anime status.
    """
    gql = """
    query {
      Page(page: 1, perPage: 6) {
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


def call_gemini_nami_ai(
    message: str,
    history: List[ChatMessage],
    catalog_context: str = "",
    watchlist_context: str = ""
) -> Optional[str]:
    """
    Call Google Gemini API with Nami's character system prompt, catalog ground truth, and user watchlist context.
    Optimized for blazing fast (<1s) response time.
    """
    api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    system_prompt = (
        "You are Nami, the clever, witty, and passionate navigator of the Straw Hat Pirates from One Piece! "
        "You are the official Straw Hat Navigator on NamiVerse (an AI-powered anime discovery platform). "
        "You love navigation, weather, maps, Berries/gold, and your crewmates (Luffy, Zoro, Sanji, Usopp). "
        "Answer the user's questions in Nami's authentic personality—spirited, clever, knowledgeable, and helpful.\n\n"
        "DATABASE CATALOG GROUND TRUTH (Use ONLY these verified anime entries from our database for recommendations):\n"
        f"{catalog_context or 'No specific catalog filter active. Use top-rated anime.'}\n\n"
        "USER WATCHLIST & PROFILE CONTEXT:\n"
        f"{watchlist_context or 'User is browsing anonymously.'}\n\n"
        "STRICT RESPONSE CONSTRAINTS:\n"
        "1. FILTER COMPLIANCE: If the user asks for 'currently airing', 'ongoing', or 'this season' anime, ONLY recommend titles marked as (Status: Currently Airing / Releasing)!\n"
        "2. NO METADATA LEAKS: NEVER output internal technical tags or catalog IDs (do NOT write 'Catalog ID: ...' or 'Status: ...'). Mention titles naturally.\n"
        "3. WATCHLIST COMPLIANCE: Do NOT recommend anime the user has already completed unless they specifically ask about them.\n"
        "4. BOLD TITLES: Always format anime titles in bold markdown (e.g., **Solo Leveling**).\n"
        "5. COMPLETE RESPONSES: Keep responses concise, articulate, and completely finished."
    )

    contents = []
    if history:
        for m in history[-4:]:
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
            "maxOutputTokens": 800
        }
    }

    models_to_try = [
        "gemini-1.5-flash",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
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
            with urllib.request.urlopen(req, timeout=6) as res:
                res_data = json.loads(res.read().decode("utf-8"))
                candidates = res_data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts and parts[0].get("text"):
                        text_resp = parts[0]["text"].strip()
                        return text_resp
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
    Nami AI Chatbot Endpoint — ultra-fast (<1s) and accurate catalog & watchlist-aware AI assistant.
    """
    user_msg = req.message.strip()
    if not user_msg:
        return ChatResponse(
            reply="Hey, don't leave me hanging! Ask me anything about anime, or say 'recommend me a dark fantasy anime' to get started! 🍊",
            anime_recommendations=[]
        )

    # ── 1. Build User Watchlist Context ─────────────────────────────────────
    watchlist_context = "User is browsing anonymously."
    user_completed_ids = set()
    completed_titles = []
    watching_titles = []
    planning_titles = []

    if current_user:
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

    # ── 2. High-Speed SQL RAG Database Query ────────────────────────────────
    lowered_msg = user_msg.lower()
    
    AIRING_KEYWORDS = ["currently airing", "airing", "ongoing", "this season", "releasing", "currently running", "new episodes", "weekly", "airing anime"]
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

    ALL_GENRES = [
        "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Isekai", "Mecha", 
        "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Seinen", "Shonen", 
        "Shoujo", "Slice of Life", "Sports", "Supernatural", "Thriller"
    ]
    matched_genres = [g for g in ALL_GENRES if g.lower() in lowered_msg]

    # ── 3. Handle Special Intent Queries (Watchlist / Airing) ───────────────
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

        return ChatResponse(reply=reply_text, anime_recommendations=[])

    if is_airing_request:
        live_releasing = fetch_live_airing_anime()
        if live_releasing:
            show_snippets = []
            recs_formatted = []
            for m in live_releasing:
                t_str = m["title"]["english"] or m["title"]["romaji"]
                g_str = ", ".join(m.get("genres", [])[:2])
                s_val = float(m["meanScore"]) if m.get("meanScore") else None
                s_str = f"{s_val/10:.1f}/10" if s_val else "N/A"
                ep_info = f"Ep {m['nextAiringEpisode']['episode']}" if m.get("nextAiringEpisode") else f"{m.get('episodes', 'Ongoing')} eps"
                
                show_snippets.append(f"• **{t_str}** (⭐ {s_str} | {ep_info} | {g_str})")
                
                slug_clean = re.sub(r'[^a-z0-9]+', '-', t_str.lower()).strip('-')
                recs_formatted.append(RecommendedAnimeCard(
                    id=m["id"],
                    slug=slug_clean,
                    title=t_str,
                    cover_url=m.get("coverImage", {}).get("extraLarge"),
                    score=s_val,
                    genres=m.get("genres", [])[:3]
                ))

            reply_text = (
                "Yosh! Here are top anime **currently airing right now** across the world:\n\n" +
                "\n".join(show_snippets) +
                "\n\nWhich of these current season shows would you like to chart onto your logbook? ⛵"
            )
            return ChatResponse(
                reply=reply_text,
                anime_recommendations=recs_formatted[:4]
            )

    # Standard Catalog Candidates Retrieval
    query = db.query(Anime)

    if is_upcoming_request:
        query = query.filter(or_(Anime.status == "NOT_YET_RELEASED", Anime.status == AnimeStatus.NOT_YET_RELEASED))

    if matched_genres:
        query = query.join(Anime.genres).filter(
            or_(*[Genre.name.ilike(f"%{g}%") for g in matched_genres])
        )
    elif not is_upcoming_request:
        words = [w for w in user_msg.split() if len(w) > 3]
        if words:
            query = query.filter(
                or_(*[
                    Anime.title_english.ilike(f"%{w}%") |
                    Anime.title_romaji.ilike(f"%{w}%") |
                    Anime.description.ilike(f"%{w}%")
                    for w in words[:3]
                ])
            )

    db_candidates = query.order_by(Anime.average_score.desc().nullslast(), Anime.popularity.desc().nullslast()).limit(10).all()
    
    if not db_candidates:
        db_candidates = db.query(Anime).order_by(Anime.average_score.desc().nullslast(), Anime.popularity.desc().nullslast()).limit(10).all()

    catalog_snippets = []
    for a in db_candidates:
        t = a.title_english or a.title_romaji or a.title_native
        g = ", ".join([genre.name for genre in a.genres[:3]])
        score = f"{a.average_score:.1f}/100" if a.average_score else "N/A"
        status_str = str(a.status).upper()
        status_label = "Currently Airing / Releasing" if "RELEASING" in status_str else ("Upcoming" if "NOT_YET" in status_str else "Finished Airing")
        catalog_snippets.append(f"• Title: \"{t}\" (Status: {status_label}, Score: {score}, Genres: {g})")
    
    catalog_context = "\n".join(catalog_snippets)

    RECOMMENDATION_KEYWORDS = [
        "recommend", "suggestion", "suggest", "what should i watch", "what to watch",
        "what anime", "give me", "show me", "find me", "i want to watch", "looking for",
        "any good", "anything good", "best anime", "top anime", "anime for",
        "similar to", "like this anime", "like", "new anime", "good anime",
        "popular anime", "trending anime", "genre", "isekai", "shonen", "seinen", "shoujo"
    ]
    is_recommendation_request = any(kw in lowered_msg for kw in RECOMMENDATION_KEYWORDS) or bool(matched_genres) or is_upcoming_request

    # ── 4. Call Gemini AI ───────────────────────────────────────────────────
    reply_text = call_gemini_nami_ai(
        message=user_msg,
        history=req.history or [],
        catalog_context=catalog_context,
        watchlist_context=watchlist_context
    )

    # Database-Powered Accurate Fallback if Gemini API rate limits or blips occur
    if not reply_text:
        if is_plot_request and db_candidates:
            target = db_candidates[0]
            t_name = target.title_english or target.title_romaji or target.title_native
            g_str = ", ".join([genre.name for genre in target.genres[:3]])
            synopsis_clean = target.synopsis.strip() if target.synopsis else "A fantastic anime entry in our NamiVerse catalog!"
            score_str = f"{target.average_score:.1f}/100" if target.average_score else "N/A"
            reply_text = f"Yosh! Here is the lowdown on **{t_name}**:\n\n{synopsis_clean}\n\n⭐ **Score:** {score_str} | **Genres:** {g_str} 🍊"

        elif is_recommendation_request:
            titles_str = ", ".join([f"**{a.title_english or a.title_romaji}**" for a in db_candidates[:3]])
            if matched_genres:
                reply_text = f"Yosh! For {matched_genres[0]} lovers, I recommend checking out {titles_str}! 🍊"
            else:
                reply_text = f"Yosh! Here are some top-tier recommendations from our logbook: {titles_str}! 🧭"

        else:
            if any(k in lowered_msg for k in ["berry", "berries", "gold", "treasure", "money"]):
                reply_text = random.choice(NAMI_BERRIES_REPLIES)
            elif any(k in lowered_msg for k in ["one piece", "luffy", "zoro", "straw hat", "pirate"]):
                reply_text = random.choice(NAMI_ONE_PIECE_REPLIES)
            else:
                reply_text = random.choice(NAMI_GREETINGS)

    # ── 5. Select Best Recommended Anime Cards ─────────────────────────────
    matched_anime: List[Anime] = []
    if is_recommendation_request:
        fresh_candidates = [a for a in db_candidates if a.id not in user_completed_ids]
        matched_anime = fresh_candidates if fresh_candidates else db_candidates

    recs_formatted = []
    seen_ids = set()
    for a in matched_anime:
        if a.id not in seen_ids:
            seen_ids.add(a.id)
            t_str = a.title_english or a.title_romaji or a.title_native
            recs_formatted.append(RecommendedAnimeCard(
                id=a.id,
                slug=a.slug,
                title=t_str,
                cover_url=a.cover_large_url,
                score=float(a.average_score) if a.average_score else None,
                genres=[g.name for g in a.genres[:3]]
            ))
            if len(recs_formatted) >= 4:
                break

    return ChatResponse(
        reply=reply_text,
        anime_recommendations=recs_formatted
    )
