from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
import random
import re
import os
import urllib.request
import json
import logging

from app.database import get_db
from app.anime.models import Anime, Genre, AnimeTitle
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
    "Yosh! I'm Nami, your official AniVerse Navigator! What kind of anime adventure are we sailing towards today?",
    "Hey there! Ready to chart a course through the best anime out there? (It'll cost you 10,000 Berries, but for you... first advice is free!)",
    "Weather report looks clear for some anime watching! Tell me what you're in the mood for!"
]

NAMI_BERRIES_REPLIES = [
    "Fufufu! Looking for Berries or treasure? The real treasure is finding a 10/10 masterpiece anime! But if you find any gold chests on AniVerse, let me know first!",
    "Money makes the world go round! Speaking of high-value shows, let me show you some top-rated gems in our catalog!"
]

NAMI_ONE_PIECE_REPLIES = [
    "One Piece?! Ah! Luffy is probably eating all the meat right now while Zoro is lost on some side quest! If you love epic adventure anime like One Piece, you'll love these recommendations!",
    "Sailing the Grand Line taught me that every great journey needs a great map! Here are some top-tier adventure and shonen anime to add to your list!"
]


def call_gemini_nami_ai(message: str, history: List[ChatMessage]) -> Optional[str]:
    """
    Call Google Gemini 1.5 Flash API with Nami's character system prompt.
    Returns AI generated response text in Nami's voice without emojis.
    """
    api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    system_prompt = (
        "You are Nami, the clever, witty, and passionate navigator of the Straw Hat Pirates from One Piece! "
        "You are an expert on all anime, manga, and pop culture. You love navigation, weather, maps, Berries/gold, and your crewmates (Luffy, Zoro, Sanji, Usopp). "
        "Answer the user's questions in Nami's authentic personality—spirited, clever, knowledgeable, and helpful. "
        "Answer any question they ask about anime, recommendations, One Piece, characters, or general topics. "
        "Keep responses engaging and concise. Do NOT use any emojis or emotes in your response."
    )

    contents = []
    if history:
        for m in history[-6:]:
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
            "temperature": 0.75,
            "maxOutputTokens": 600
        }
    }

    models_to_try = [
        "gemini-flash-latest",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
        "gemini-2.5-flash"
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
                        text_resp = parts[0]["text"].strip()
                        # Clean any lingering emojis just in case
                        text_resp = re.sub(r'[\U00010000-\U0010ffff]', '', text_resp)
                        return text_resp
        except Exception as ex:
            log.warning(f"Gemini API model {model_name} error: {ex}")
            continue

    return None


@router.post("/nami", response_model=ChatResponse)
def nami_chat(req: ChatRequest, db: Session = Depends(get_db)):
    """
    Nami AI Chatbot Endpoint — powered by Google Gemini API with fallbacks.
    Returns in-character Nami responses along with database media cards.
    """
    user_msg = req.message.strip()
    if not user_msg:
        return ChatResponse(
            reply="Hey, don't leave me hanging! Ask me for an anime recommendation, genre suggestions, or what's trending!",
            anime_recommendations=[]
        )

    matched_anime: List[Anime] = []
    reply_text = ""

    # ── Attempt Real AI Generation via Gemini ────────────────────────────────
    ai_reply = call_gemini_nami_ai(user_msg, req.history or [])
    if ai_reply:
        reply_text = ai_reply

        # Match anime cards based on AI reply and user message
        lowered_comb = f"{user_msg.lower()} {ai_reply.lower()}"
        
        # Genre check
        for g_name in ["Action", "Adventure", "Comedy", "Romance", "Fantasy", "Sci-Fi", "Drama", "Mystery", "Psychological", "Thriller"]:
            if g_name.lower() in lowered_comb:
                found_by_genre = db.query(Anime).join(Anime.genres).filter(
                    Genre.name.ilike(f"%{g_name}%")
                ).order_by(Anime.average_score.desc().nullslast()).limit(3).all()
                matched_anime.extend(found_by_genre)
                break

        # Check for top / popular if no genre matched
        if not matched_anime:
            matched_anime = db.query(Anime).order_by(Anime.average_score.desc().nullslast()).limit(3).all()

    # ── Fallback Rules if Gemini API key is missing or failed ─────────────────
    if not reply_text:
        lowered_msg = user_msg.lower()
        if any(k in lowered_msg for k in ["berry", "berries", "gold", "treasure", "money"]):
            reply_text = random.choice(NAMI_BERRIES_REPLIES)
            matched_anime = db.query(Anime).order_by(Anime.popularity.desc().nullslast()).limit(3).all()

        elif any(k in lowered_msg for k in ["one piece", "luffy", "zoro", "straw hat", "pirate"]):
            reply_text = random.choice(NAMI_ONE_PIECE_REPLIES)
            matched_anime = db.query(Anime).filter(
                Anime.genres.any(Genre.name.in_(["Action", "Adventure", "Fantasy"]))
            ).order_by(Anime.popularity.desc().nullslast()).limit(4).all()

        else:
            reply_text = "Yosh! I've set our log pose to the top anime recommendations in our database for you:"
            matched_anime = db.query(Anime).order_by(Anime.average_score.desc().nullslast()).limit(3).all()

    # Deduplicate matched anime
    seen_ids = set()
    unique_anime = []
    for a in matched_anime:
        if a.id not in seen_ids:
            seen_ids.add(a.id)
            unique_anime.append(a)

    recs_formatted = []
    for a in unique_anime[:4]:
        t_str = a.title_english or a.title_romaji or a.title_native
        recs_formatted.append(RecommendedAnimeCard(
            id=a.id,
            slug=a.slug,
            title=t_str,
            cover_url=a.cover_large_url,
            score=float(a.average_score) if a.average_score else None,
            genres=[g.name for g in a.genres[:3]]
        ))

    return ChatResponse(
        reply=reply_text,
        anime_recommendations=recs_formatted
    )
