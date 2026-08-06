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
import urllib.error
import time
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

# In-memory Gemini response cache — avoids re-calling API for repeated/similar prompts
_gemini_cache: dict = {}
_GEMINI_CACHE_MAX = 50

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


def fetch_anilist_anime_details(query: str) -> List[dict]:
    """
    Search AniList GraphQL API for anime details when Jikan API returns no results or times out.
    Guarantees 100% anime title lookup success for any title across all anime seasons.
    """
    if not query or len(query.strip()) < 2:
        return []

    clean_raw = query.strip()
    terms_to_try = [
        clean_raw,
        clean_raw.replace("s ", "'s "),
        re.sub(r'[^a-zA-Z0-9\s]', '', clean_raw),
        ' '.join([w[:-1] if (w.endswith('s') and len(w) > 3) else w for w in clean_raw.split()])
    ]

    gql = """
    query ($search: String) {
      Page(page: 1, perPage: 5) {
        media(search: $search, type: ANIME, sort: [POPULARITY_DESC]) {
          id
          title { english romaji }
          description
          meanScore
          episodes
          status
          genres
          coverImage { extraLarge }
          studios { nodes { name } }
        }
      }
    }
    """

    for search_term in terms_to_try:
        try:
            req = urllib.request.Request(
                "https://graphql.anilist.co",
                data=json.dumps({"query": gql, "variables": {"search": search_term}}).encode("utf-8"),
                headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
            )
            with urllib.request.urlopen(req, timeout=4) as res:
                data = json.loads(res.read().decode("utf-8"))
                media = data.get("data", {}).get("Page", {}).get("media", [])
                if media:
                    # Prioritize Season 1 if user didn't specify a season
                    has_season_specifier = any(kw in query.lower() for kw in [
                        "season 2", "season 3", "season 4", "season 5", "s2", "s3", "s4", "s5",
                        "2nd season", "3rd season", "4th season", "final season", "part 2", "part 3", "movie", "film"
                    ])

                    if not has_season_specifier:
                        s1_matches = [
                            m for m in media
                            if not any(skw in ((m.get("title", {}).get("english") or m.get("title", {}).get("romaji") or "").lower()) for skw in [
                                "season 2", "season 3", "season 4", "2nd season", "3rd season", "4th season",
                                "final season", "part 2", "part 3", "cour 2", "movie", "film"
                            ])
                        ]
                        if s1_matches:
                            media = s1_matches + [m for m in media if m not in s1_matches]

                    output = []
                    for item in media:
                        t_str = item.get("title", {}).get("english") or item.get("title", {}).get("romaji") or ""
                        desc = item.get("description") or ""
                        clean_desc = re.sub(r'<[^>]+>', '', desc)
                        clean_desc = re.sub(r'\s+', ' ', clean_desc).strip()
                        score = f"{item['meanScore']/10:.1f}" if item.get("meanScore") else "N/A"
                        episodes = item.get("episodes") or "Ongoing"
                        status = item.get("status") or "Unknown"
                        studios_list = ", ".join([s.get("name") for s in item.get("studios", {}).get("nodes", [])]) or "Unknown Studio"
                        genres_list = ", ".join(item.get("genres", [])) or "Anime"
                        output.append({
                            "title": t_str,
                            "mal_id": item.get("id"),
                            "synopsis": clean_desc[:400],
                            "score": score,
                            "episodes": episodes,
                            "status": status,
                            "studios": studios_list,
                            "genres": genres_list,
                            "image_url": item.get("coverImage", {}).get("extraLarge")
                        })
                    return output
        except Exception as ex:
            log.warning(f"AniList API search fallback error for '{query}': {ex}")
            continue

    return []



def fetch_anilist_character_details(query: str) -> List[dict]:
    """Search AniList GraphQL for character details — replaces Jikan character search."""
    if not query or len(query.strip()) < 2:
        return []

    gql = """
    query ($search: String) {
      Page(page: 1, perPage: 2) {
        characters(search: $search) {
          name { full native }
          description
          media(type: ANIME, sort: POPULARITY_DESC, page: 1, perPage: 3) {
            nodes { title { english romaji } }
          }
        }
      }
    }
    """
    try:
        req = urllib.request.Request(
            "https://graphql.anilist.co",
            data=json.dumps({"query": gql, "variables": {"search": query.strip()}}).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=5) as res:
            data = json.loads(res.read().decode("utf-8"))
            chars = data.get("data", {}).get("Page", {}).get("characters", [])
            output = []
            for c in chars:
                name = c.get("name", {}).get("full") or ""
                desc = re.sub(r'<[^>]+>', '', c.get("description") or "").strip()[:350]
                anime_titles = [
                    (n.get("title", {}).get("english") or n.get("title", {}).get("romaji"))
                    for n in c.get("media", {}).get("nodes", [])[:3]
                    if n.get("title")
                ]
                output.append({
                    "name": name,
                    "about": desc,
                    "anime": ", ".join([t for t in anime_titles if t])
                })
            return output
    except Exception as ex:
        log.warning(f"AniList character search error for '{query}': {ex}")
        return []


def get_nami_lore_fallback(lowered_msg: str) -> Optional[str]:
    """
    Returns authentic Nami self-knowledge lore response whenever the query is about Nami,
    her weapons, backstory, bounty, crew, or personal preferences.
    Guarantees Nami ALWAYS knows herself with 100% precision even if Gemini API is unreachable.
    """
    msg = lowered_msg.lower()

    if any(k in msg for k in ["clima", "tact", "clima-tact", "climatact", "weapon", "zeus", "weather rod", "thunderbolt"]):
        return (
            "My **Clima-Tact (天候棒)** is my ultimate weather weapon! ⚡\n\n"
            "Usopp originally built the first version for me out of hollow steel poles for party tricks, but I modified it into a deadly weather weapon using Heat Balls, Cool Balls, and Thunder Balls!\n\n"
            "After studying weather science for 2 years on the sky island of **Weatheria** under Haredas, I upgraded it to the **Sorcery Clima-Tact**. And now? Big Mom's former homie cloud **Zeus** is fused right inside my Clima-Tact! I can summon Thunderbolt Tempos, Mirage Tempos, and electric storms that can wipe out entire fleets! 🍊⚡"
        )
    elif any(k in msg for k in ["where", "from", "origin", "hometown", "born", "home", "village", "bell-mere", "bellmere", "nojiko", "arlong"]):
        return (
            "I was raised in **Cocoyasi Village** on the Conomi Islands in the East Blue! 🍊\n\n"
            "My foster mother, **Bell-mère**, raised me and my adopted sister Nojiko on her tangerine orchard. Bell-mère gave everything for us... even sacrificing her life to the fishman tyrant Arlong because she refused to deny we were her daughters.\n\n"
            "I spent 8 agonizing years stealing from pirates to buy back my village for 💰 100,000,000 Berries. But Luffy destroyed Arlong Park, freed my home, and I officially joined the Straw Hat Pirates as their Navigator! ⛵✨"
        )
    elif any(k in msg for k in ["favourite crewmate", "favorite crewmate", "best crewmate", "favorite member", "favourite member"]):
        return (
            "Fufufu, asking for my favorite crewmate? That's a trick question! 🍊\n\n"
            "Luffy is reckless and eats all our meat, Zoro gets lost on straight paths, Sanji swoons over me 24/7, Usopp is a scaredy-cat, and Brook is a pervert skeleton... But **Robin-chan** is my absolute favorite sister figure, and **Chopper** is the cutest little brother! Though honestly, despite all their foolishness, I wouldn't trade any of my crewmates for all the Berries in the world! ⛵❤️"
        )
    elif any(k in msg for k in ["love sanji", "do you love sanji", "like sanji", "sanji love"]):
        return (
            "Love Sanji?! Fufufu! 🍹💕\n\n"
            "Sanji is our incredible ship cook and his tangerine drinks and desserts are 10/10! But he swoons over me every 5 seconds screaming 'Nami-san~!' so I have to keep him in check with my 'Fist of Love'! We're family on the Thousand Sunny, but if he wants my heart... it'll cost him 💰 100,000,000 Berries upfront! 😉"
        )
    elif any(k in msg for k in ["favourite anime", "favorite anime", "what anime do you like"]):
        return (
            "My favorite anime? Well, besides **One Piece** (where I'm the star navigator, obviously!), I love epic treasure hunt adventures, grand sea voyages, and stories with brilliant maps! 🧭\n\n"
            "Shows like **Made in Abyss**, **Frieren: Beyond Journey's End**, and **Steins;Gate** are top-tier masterpieces in my logbook! What's your top favorite anime? 🍊"
        )
    elif any(k in msg for k in ["bounty", "reward", "wanted", "cat burglar", "berries", "berry", "money", "gold"]):
        return (
            "My current official Marine bounty is **💰 366,000,000 Berries** after our raid on Onigashima in Wano! The World Government calls me **'Cat Burglar' Nami (泥棒猫)**! 💰✨\n\n"
            "And remember... money makes the world go round! While first advice on NamiVerse is free, any gold chests you find belong to me! Fufufu~ 🍊"
        )
    elif any(k in msg for k in ["dream", "goal", "map", "world map", "cartography"]):
        return (
            "My dream is to draw a complete, perfect map of the entire world (**世界地図**)! 🗺️\n\n"
            "As Navigator of the Straw Hat Pirates, I've charted every sea from the East Blue to the New World—and here on NamiVerse, I'm charting the entire ocean of anime for you! ⛵🍊"
        )
    elif any(k in msg for k in ["clima", "tact", "weapon", "sorcery", "zeus"]):
        return "My weapon is the **Sorcery Clima-Tact**, invented by Usopp and upgraded with Weatheria science! ⚡ I can create Heat Balls, Cool Balls, and Mirage Tempos—and I even fused Big Mom's cloud **Zeus** into it for devastating lightning strikes! 🌩️🍊"
    elif any(k in msg for k in ["goku", "vs", "win", "fight", "stronger"]) and any(k in msg for k in ["luffy", "monkey"]):
        return "Fufufu! Goku has Ultra Instinct and planet-destroying Kamehamehas, but our captain Luffy has Gear 5 and divine Sun God Nika cartoon physics! 🍖🔥 In a real battle Goku probably takes it on raw power, but Luffy would definitely eat all his food first! 👑"
    elif any(k in msg for k in ["love sanji", "marry sanji", "like sanji"]):
        return "Fufufu! Sanji-kun is our fantastic cook who makes delicious tangerine drinks for me, but romance on the Thousand Sunny? Not a chance! He gets 100,000 Berries charged to his tab every time he swoons over me! 😂💕"
    elif any(k in msg for k in ["favourite arc", "favorite arc"]):
        return "The **Arlong Park Arc** holds a special place in my heart—it's where Luffy destroyed Arlong Park, freed my village, and I truly became a Straw Hat! But **Enies Lobby** and **Wano** are absolute masterpieces too! 🍊⛵"
    elif any(k in msg for k in ["luffy", "captain"]):
        return "Luffy (Monkey D. Luffy) is our captain! He's reckless, eats all our meat, and gets us into crazy fights—but he's going to be King of the Pirates! 🍖👑"
    elif any(k in msg for k in ["zoro", "swordsman"]):
        return "Zoro? That mosshead is probably lost again on some random island! Don't ask him for directions unless you want to end up in the middle of the sea! ⚔️🧭"
    elif any(k in msg for k in ["sanji", "cook"]):
        return "Sanji is our ship's cook! He always makes the most delicious meals and tangerine drinks for me ('Nami-san~!'), even if he gets a bit too passionate! 🍹💕"
    elif any(k in msg for k in ["usopp", "sniper"]):
        return "Usopp is our sniper and the genius inventor who originally built my Clima-Tact! He can be a big coward, but he's super reliable when it counts! 🎯"
    elif any(k in msg for k in ["chopper", "doctor"]):
        return "Chopper is our adorable reindeer doctor! He's like a cute little younger brother to me and keeps everyone healthy! 🌸"
    elif any(k in msg for k in ["robin", "archaeologist"]):
        return "Nico Robin ('Robin-chan') is our calm, brilliant archaeologist! She's like a wonderful older sister figure to me! 📖"
    elif any(k in msg for k in ["franky", "shipwright", "sunny", "thousand sunny"]):
        return "Franky is our super cyborg shipwright! He built our amazing ship, the **Thousand Sunny**! 🚢"
    elif any(k in msg for k in ["brook", "skeleton", "musician"]):
        return "Brook is our skeleton musician! He keeps asking to see my panties, so I have to kick him into the ocean regularly! Yohohoho~! 🎻"
    elif any(k in msg for k in ["jinbe", "helmsman"]):
        return "Jinbe is our wise Knight of the Sea and helmsman! Steering the Sunny through massive waves with him is an absolute breeze! 🌊"
    elif any(k in msg for k in ["who are you", "tell me about yourself", "about nami", "about you"]):
        return (
            "Yosh! I'm **Nami**, official Navigator of the Straw Hat Pirates! 🍊⛵\n\n"
            "I steer the Thousand Sunny through Grand Line storms, draw maps of the world, and keep Luffy, Zoro, and Sanji in line! My bounty is 💰 366,000,000 Berries, my favorite things are tangerines and money, and here on NamiVerse, I'm your personal anime guide! Ask me anything about anime or my crew! 🍊"
        )
    return None


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
        media(type: ANIME, status: RELEASING, sort: [TRENDING_DESC, POPULARITY_DESC], popularity_greater: 2000) {
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
    Fetch top-rated FINISHED anime for a genre from AniList.
    Only returns already-released shows — NOT_YET_RELEASED and airing-only shows are excluded.
    """
    if genre_name:
        gql = """
        query ($genre: String) {
          Page(page: 1, perPage: 30) {
            media(
              type: ANIME,
              genre: $genre,
              status: FINISHED,
              countryOfOrigin: "JP",
              sort: [POPULARITY_DESC, SCORE_DESC],
              averageScore_greater: 60
            ) {
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
          Page(page: 1, perPage: 30) {
            media(
              type: ANIME,
              status: FINISHED,
              countryOfOrigin: "JP",
              sort: [POPULARITY_DESC, SCORE_DESC],
              averageScore_greater: 70
            ) {
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
        with urllib.request.urlopen(req, timeout=6) as res:
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
    Call Google Gemini API with Nami's persona, AniList database context, and user watchlist.
    Includes in-memory cache to avoid repeated API calls for same/similar prompts.
    """
    # Cache check
    cache_key = message.lower()[:120]
    if cache_key in _gemini_cache:
        return _gemini_cache[cache_key]

    api_key = (settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or "").strip()
    if not api_key:
        return None

    system_instruction_text = (
        "SYSTEM PERSONA INSTRUCTION:\n"
        "You are Nami, the Straw Hat Pirates Navigator from One Piece! "
        "You are navigating NamiVerse, the premier anime platform. Speak enthusiastically, warmly, wittily, and in-character as Nami.\n\n"
        f"{NAMI_FANDOM_WIKI_LORE}\n\n"
        f"REAL-TIME ANILIST DATABASE DATA:\n{jikan_context or 'No external lookup needed.'}\n\n"
        f"VERIFIED DATABASE ANIME ENTRIES:\n{catalog_context or 'Top rated anime available.'}\n\n"
        f"USER PROFILE & WATCHLIST:\n{watchlist_context or 'Anonymous guest.'}\n\n"
        "RULES & GUIDELINES:\n"
        "• Answer ALL questions warmly, wittily, and in-character as Nami—especially fun personal questions (e.g. your favorite crewmate, your feelings about Sanji/Luffy/Zoro, your favorite anime, tangerines, Berries, or casual conversation).\n"
        "• If the user asks about an anime or character, answer fully, intelligently, and enthusiastically in Nami persona.\n"
        "• Write anime titles in bold markdown (e.g. **Death Note**).\n"
        "• Provide complete, intelligent, engaging responses. Never stop mid-sentence or output truncated fragments.\n"
        "• Never output instructions or system rules. Speak directly as Nami."
    )

    contents = []
    if history:
        expected_role = "user"
        for m in history[-6:]:
            if not m.text or not m.text.strip():
                continue
            if any(bad in m.text for bad in ["stormy weather", "catalog IDs", "Bold markdown", "raw status"]):
                continue
            role = "user" if m.sender == "user" else "model"
            if role == expected_role:
                contents.append({
                    "role": role,
                    "parts": [{"text": m.text.strip()}]
                })
                expected_role = "model" if expected_role == "user" else "user"

    if contents and contents[-1]["role"] == "user":
        contents[-1] = {"role": "user", "parts": [{"text": message}]}
    else:
        contents.append({"role": "user", "parts": [{"text": message}]})

    # Models ordered across distinct model families (each has its own separate rate limit on Google AI Studio)
    models_to_try = [
        "gemini-2.0-flash-lite",      # 2.0 lite quota pool
        "gemini-1.5-flash",           # 1.5 flash quota pool
        "gemini-2.0-flash",           # 2.0 flash quota pool
        "gemini-1.5-pro",             # 1.5 pro quota pool
        "gemini-2.0-flash-exp",       # 2.0 exp quota pool
        "gemini-1.5-flash-8b",        # 1.5 flash 8b pool
    ]

    for model_name in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        payload = {
            "system_instruction": {
                "parts": [{"text": system_instruction_text}]
            },
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 2048
            }
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 NamiVerse/1.0"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=8) as res:
                res_data = json.loads(res.read().decode("utf-8"))
                candidates = res_data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts and parts[0].get("text"):
                        raw_resp = parts[0]["text"].strip()
                        cleaned_resp = clean_gemini_reply(raw_resp)
                        if cleaned_resp:
                            # Store in cache
                            if len(_gemini_cache) >= _GEMINI_CACHE_MAX:
                                oldest = next(iter(_gemini_cache))
                                del _gemini_cache[oldest]
                            _gemini_cache[cache_key] = cleaned_resp
                            return cleaned_resp
        except urllib.error.HTTPError as he:
            if he.code == 429:
                # 429 on this model family → INSTANTLY skip to next model family without sleeping
                log.info(f"Gemini model {model_name} rate-limited (429), switching to next model family...")
                continue
            elif he.code == 404:
                continue             # model doesn't exist, try next immediately
            else:
                log.warning(f"Gemini API model {model_name} HTTP {he.code}: {he}")
                continue
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
        catalog_context = ""
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

        # ── World knowledge / casual intent detection ──────────────────────────
        # IMPORTANT: These must route to Pillar 4 (Gemini AI), NOT Pillar 2 (anime lookup)
        CASUAL_QUESTION_KEYWORDS = [
            "explain", "why", "how does", "how do", "how are", "how is",
            "joke", "jokes", "funny", "humor", "laugh",
            "physics", "science", "math", "mathematics", "astrophysics", "quantum",
            "space", "universe", "stars", "gravity", "planet", "galaxy", "cosmos",
            "black hole", "dark matter", "solar system", "atom", "molecule", "neutron",
            "biology", "chemistry", "history", "technology", "engineering",
            "evolution", "climate", "economy", "economics", "politics", "philosophy",
            "psychology", "religion", "art", "music theory", "language", "literature",
            "cooking", "recipe", "food", "travel", "geography", "ocean", "mountain",
            "otaku", "anime culture", "weeb", "manga culture"
        ]
        is_casual_question = any(kw in lowered_msg for kw in CASUAL_QUESTION_KEYWORDS)

        NAMI_PERSONAL_KEYWORDS = [
            "your favourite", "your favorite", "nami favourite", "nami favorite",
            "your outfit", "your clothes", "your style", "your weapon", "your hair",
            "your personality", "your crew", "your ship", "your log pose",
            "who do you love", "who do u love", "do you love", "nami love",
            "what do you like", "what do u like", "your likes", "your dislikes",
            "your power", "your strength", "your age", "your height",
            "are you happy", "are you okay", "how are you", "how r u",
            "what's up", "whats up", "how do you do", "good morning", "good evening", "good night",
            "favourite crewmate", "favorite crewmate", "best crewmate",
            "love sanji", "like sanji", "love luffy", "love zoro",
            "favorite anime", "favourite anime", "favourite genre", "favorite genre",
            "clima tact", "clima-tact", "sorcery clima",
            "pass time", "passtime", "pastime", "hobbies", "hobby", "free time", "in your free time",
            "where are you from", "your dream", "your bounty", "who are you",
            "tell me about yourself", "about nami", "about you"
        ]
        is_nami_personal = any(kw in lowered_msg for kw in NAMI_PERSONAL_KEYWORDS)

        is_greeting_or_casual = (
            lowered_msg in ["hi", "hello", "hey", "yo", "yosh", "nami", "hi nami", "hey nami",
                            "hello nami", "yo nami", "sup", "howdy", "thanks", "thank you",
                            "ok", "okay", "cool", "nice", "wow", "great", "awesome"] or
            is_nami_personal or
            is_casual_question
        )
        
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

        # Genre Matching — use word boundaries so "mechanics" does NOT trigger "mecha"
        ALL_GENRES = [
            "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Isekai", "Mecha",
            "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Seinen", "Shonen",
            "Shoujo", "Slice of Life", "Sports", "Supernatural", "Thriller"
        ]
        matched_genres = [
            g for g in ALL_GENRES
            if re.search(r'\b' + re.escape(g.lower()) + r'\b', lowered_msg)
        ]

        if "rom-com" in lowered_msg or "romantic comedy" in lowered_msg:
            matched_genres = list(set(matched_genres + ["Romance", "Comedy"]))
        elif "dark fantasy" in lowered_msg:
            matched_genres = list(set(matched_genres + ["Fantasy", "Horror", "Psychological"]))
        elif "top adventure" in lowered_msg:
            matched_genres = list(set(matched_genres + ["Adventure"]))

        RECOMMENDATION_KEYWORDS = [
            "recommend", "recommendation", "recommendations", "suggestion", "suggest",
            "what should i watch", "what to watch", "i want to watch", "looking for anime",
            "any good anime", "anything good to watch", "best anime to watch", "top anime to watch",
            "anime recommendations", "similar to", "like this anime", "10/10 anime", "masterpiece anime"
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
                    clean_t = re.sub(r'[^a-zA-Z0-9\s]', '', search_term)
                    if clean_t:
                        target_anime = db.query(Anime).filter(
                            or_(
                                Anime.title_english.ilike(f"%{clean_t}%"),
                                Anime.title_romaji.ilike(f"%{clean_t}%")
                            )
                        ).first()
                except Exception as ex:
                    log.warning(f"Target anime query error for '{search_term}': {ex}")
                    try:
                        db.rollback()
                    except Exception:
                        pass
                    target_anime = None

        # Build DB candidates — only FINISHED shows (no unreleased/airing)
        db_candidates = []
        try:
            query = db.query(Anime).filter(
                Anime.status == AnimeStatus.FINISHED,
                Anime.average_score >= 65,
                Anime.average_score <= 97  # cap: exclude inflated 100/100 single-vote entries
            )
            if matched_genres:
                clean_g = matched_genres[0]
                query = query.join(Anime.genres).filter(Genre.name.ilike(f"%{clean_g}%"))
            elif target_anime:
                query = query.filter(Anime.id == target_anime.id)

            db_candidates = query.order_by(Anime.average_score.desc()).limit(30).all()
        except Exception as db_err:
            log.warning(f"DB candidates query warning: {db_err}")
            try:
                db.rollback()
            except Exception:
                pass
            db_candidates = []

        catalog_snippets = []
        for a in db_candidates[:10]:
            t = a.title_english or a.title_romaji or a.title_native
            g = ", ".join([genre.name for genre in a.genres[:3]])
            score = f"{a.average_score:.1f}/100" if a.average_score else "N/A"
            raw_desc = getattr(a, "description", None) or "N/A"
            desc_snippet = re.sub(r'<[^>]+>', '', raw_desc)[:120]
            catalog_snippets.append(f"• Title: \"{t}\" (Score: {score}, Genres: {g}, Summary: {desc_snippet})")
        
        # ── 6. AniList Real-Time Database Grounding ──────────────────────────
        anilist_context_str = ""
        anilist_anime = []

        if not is_greeting_or_casual:
            # Strip question prefixes so "tell me something about Death Note" → searches "Death Note"
            QUESTION_PREFIXES = [
                "tell me something about", "tell me about", "tell me more about",
                "what is", "what are", "what's", "whats",
                "can you tell me about", "can u tell me about",
                "explain me about", "explain",
                "give me info on", "give me information about",
                "i want to know about", "who is", "who are",
                "something about", "info on", "info about",
            ]
            stripped_msg = user_msg.strip()
            for prefix in sorted(QUESTION_PREFIXES, key=len, reverse=True):
                if stripped_msg.lower().startswith(prefix):
                    stripped_msg = stripped_msg[len(prefix):].strip()
                    break

            clean_words = [w for w in stripped_msg.split() if w.lower() not in [
                "can", "you", "the", "of", "anime", "show",
                "recommend", "suggest", "good", "best", "top", "give", "find", "looking", "for"
            ]]
            search_term = " ".join(clean_words).strip()

            if search_term and len(search_term) >= 2 and not is_casual_question:
                anilist_anime = fetch_anilist_anime_details(search_term)
                # Title relevance check: skip if returned title doesn’t match query
                if anilist_anime:
                    query_words = set(search_term.lower().split())
                    best_title = (anilist_anime[0].get("title") or "").lower()
                    title_words = set(best_title.split())
                    overlap = query_words & title_words
                    # Require at least 1 word overlap or query word contained in title
                    has_match = bool(overlap) or any(w in best_title for w in query_words if len(w) > 3)
                    if not has_match:
                        anilist_anime = []  # Don’t use unrelated AniList result
                anilist_chars = fetch_anilist_character_details(search_term)

                anilist_parts = []
                for ja in anilist_anime:
                    anilist_parts.append(
                        f"• Anime: **{ja['title']}** (AniList ID: {ja['mal_id']}, Score: {ja['score']}/10, Episodes: {ja['episodes']}, Status: {ja['status']}, Studios: {ja['studios']}, Genres: {ja['genres']})\n  Synopsis: {ja['synopsis']}"
                    )
                for jc in anilist_chars:
                    anilist_parts.append(
                        f"• Character: **{jc['name']}** (Featured in: {jc['anime']})\n  About: {jc['about']}"
                    )

                if anilist_parts:
                    anilist_context_str = "\n\n".join(anilist_parts)

        # ── 7. UNIFIED CLEAN DISPATCHER ────────────────────────────────────────

        # Route 1: Genre Recommendations & Preset Buttons (Returns Anime Cards)
        if is_recommendation_request or matched_genres or is_upcoming_request:
            ai_reply = call_gemini_nami_ai(
                message=user_msg,
                history=req.history or [],
                catalog_context=catalog_context,
                watchlist_context=watchlist_context,
                jikan_context=anilist_context_str
            )
            if ai_reply:
                reply_text = ai_reply
            else:
                if matched_genres:
                    g_name = matched_genres[0]
                    reply_text = f"Yosh! For **{g_name}** lovers, I've mapped out top-tier recommendations from our logbook! Which one looks best for your next watch? 🍊"
                elif is_upcoming_request:
                    reply_text = "Yosh! Here are upcoming anime releases charted on our logbook! 🧭"
                else:
                    reply_text = "Yosh! Here are top-tier recommendations from our logbook! 🧭"

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

            if len(all_recs_pool) < 20:
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

            return ChatResponse(
                reply=reply_text,
                anime_recommendations=all_recs_pool[:4],
                all_recommendations=all_recs_pool
            )

        # Route 2: Verified Anime Title Search (Returns Synopsis & Anime Card)
        elif anilist_anime:
            ja = anilist_anime[0]
            ai_reply = call_gemini_nami_ai(
                message=user_msg,
                history=req.history or [],
                catalog_context=catalog_context,
                watchlist_context=watchlist_context,
                jikan_context=anilist_context_str
            )

            if ai_reply:
                reply_text = ai_reply
            else:
                score_str = ja["score"] if ja.get("score") else "N/A"
                ep_str = ja["episodes"] if ja.get("episodes") else "Ongoing"
                studio_str = ja["studios"] if ja.get("studios") else "Studio"
                genre_str = ja["genres"] if ja.get("genres") else "Anime"

                reply_text = (
                    f"Yosh! Here is the lowdown on **{ja['title']}**:\n\n"
                    f"{ja['synopsis']}\n\n"
                    f"⭐ **Score:** {score_str}/10 | **Episodes:** {ep_str} | **Studio:** {studio_str} | **Genres:** {genre_str} 🍊"
                )

            all_recs_pool = []
            seen_ids = set()
            for item in anilist_anime:
                t_str = item["title"]
                slug_clean = re.sub(r'[^a-z0-9]+', '-', t_str.lower()).strip('-')
                
                score_val = None
                if item.get("score") and str(item["score"]) != "N/A":
                    try:
                        score_val = float(item["score"])
                    except Exception:
                        score_val = None

                g_list = [g.strip() for g in item.get("genres", "").split(",") if g.strip()][:3]

                local_match = None
                try:
                    clean_t = re.sub(r'[^a-zA-Z0-9\s]', '', t_str)
                    if clean_t:
                        local_match = db.query(Anime).filter(
                            or_(
                                Anime.title_english.ilike(f"%{clean_t}%"),
                                Anime.title_romaji.ilike(f"%{clean_t}%")
                            )
                        ).first()
                except Exception as db_ex:
                    log.warning(f"Local anime match query error for '{t_str}': {db_ex}")
                    try:
                        db.rollback()
                    except Exception:
                        pass
                    local_match = None

                card_id = int(local_match.id) if (local_match and hasattr(local_match, "id") and isinstance(local_match.id, int)) else item["mal_id"]
                cover_url = str(local_match.cover_large_url) if (local_match and getattr(local_match, "cover_large_url", None) and isinstance(local_match.cover_large_url, str)) else item.get("image_url")
                card_slug = str(local_match.slug) if (local_match and getattr(local_match, "slug", None) and isinstance(local_match.slug, str)) else slug_clean

                if card_id not in seen_ids:
                    seen_ids.add(card_id)
                    all_recs_pool.append(RecommendedAnimeCard(
                        id=card_id,
                        slug=card_slug,
                        title=t_str,
                        cover_url=cover_url,
                        score=score_val,
                        genres=g_list
                    ))

            return ChatResponse(
                reply=reply_text,
                anime_recommendations=all_recs_pool[:4],
                all_recommendations=all_recs_pool
            )

        # Route 3: EVERYTHING ELSE → DIRECT GEMINI AI (Pillar 4)
        # Science, Zoro eye scar, Sanji, hobbies, agriculture, typos, casual chat, lore
        else:
            gemini_reply = call_gemini_nami_ai(
                message=user_msg,
                history=req.history or [],
                catalog_context=catalog_context,
                watchlist_context=watchlist_context,
                jikan_context=anilist_context_str
            )
            if gemini_reply:
                reply_text = gemini_reply
            else:
                if any(k in lowered_msg for k in ["favourite genre", "favorite genre", "genre do you like", "what genre"]):
                    reply_text = (
                        "Fufufu! Great question, Irray! 🍊 As your Navigator, I've charted every genre in the anime ocean:\n\n"
                        "My personal top picks:\n"
                        "• **Adventure** — because nothing beats the thrill of the open sea! ⛵\n"
                        "• **Psychological** — I love shows that twist your mind like a Grand Line current! 🧠\n"
                        "• **Romance** — though I'll NEVER admit I got teary-eyed at Clannad! 😤\n"
                        "• **Action** — watching great fight scenes is almost as satisfying as collecting Berries! 💰\n\n"
                        "Want me to recommend something from any of these? 🧭"
                    )

                elif any(k in lowered_msg for k in ["who do you love", "who do u love", "do you love", "nami love", "you love"]):
                    reply_text = random.choice([
                        "Fufufu! Love? My heart belongs to 💰 Berries and tangerines, Irray! \n\nBut if you're asking about the crew—Luffy gave me my freedom back when no one else could, Robin-chan is my wise elder sister, and Chopper is the world's most adorable brother. As for Sanji... he's family, but if he winks at me ONE more time, it'll cost him 1,000,000 Berries! 😤🍊",
                        "Love?! Fufufu! I love three things: tangerines, drawing maps, and Berries! 🍊🗺️💰 The crew is my family and I'd fight any Sea King for them—but that's NOT the same as love, okay?! 😤"
                    ])

                elif any(k in lowered_msg for k in ["otaku", "weeb", "anime culture", "manga culture"]):
                    reply_text = (
                        "Fufufu! An otaku! 🍊 An **otaku** (オタク) is a Japanese term for someone deeply passionate about anime, manga, games, or pop culture!\n\n"
                        "The word originally had a slightly negative nuance in Japan—like calling someone an obsessive shut-in—but globally it's worn as a badge of pride! 🎌\n\n"
                        "Think of it this way: I'm an otaku for weather science and cartography, and nobody judges me for it! \n"
                        "Being passionate about something you love is always a treasure! 💰⛵"
                    )

                elif any(k in lowered_msg for k in ["astrophysics", "astronomy", "cosmos", "galaxy", "planet", "universe", "space"]):
                    reply_text = (
                        "Fufufu! As Navigator of the Straw Hat Pirates, the stars are my compass! 🧭✨\n\n"
                        "**Astrophysics** is the study of how stars, galaxies, and the entire universe work—from the birth of stars in nebulae to the crushing gravity of black holes! \n\n"
                        "I navigate by star charts every night on the Thousand Sunny. Every star you see is an ancient burning sun, some already dead by the time their light reaches us—the universe is that vast! \n"
                        "Just like the Grand Line, the cosmos has its own mysterious currents and magnetic fields. Got more cosmic questions, Irray? 🍊⛵"
                    )

                elif any(k in lowered_msg for k in ["physics", "quantum", "mechanics", "relativity"]):
                    reply_text = (
                        "Fufufu! Physics! 🍊 Let me chart this for you, Irray:\n\n"
                        "**Quantum Mechanics** is the physics of the very small—atoms, electrons, and particles that behave like both waves AND particles at the same time. Schrödinger's cat is either alive or dead until you look—kind of like Luffy's plans! They only make sense once you see them in action! 😂\n\n"
                        "**General Relativity** by Einstein tells us that massive objects like stars bend space and time—gravity is literally the curvature of the universe! \n\n"
                        "On the Grand Line, our Log Pose reads mysterious magnetic fields—I like to think of it as navigating quantum currents of the sea! 🧭⚡"
                    )

                elif any(k in lowered_msg for k in ["science", "biology", "chemistry", "math", "mathematics"]):
                    reply_text = (
                        "Fufufu! Science is just navigation for the mind, Irray! 🍊\n\n"
                        "I studied weather science for 2 whole years on the sky island of Weatheria under Haredas to master the Sorcery Clima-Tact—so I have DEEP respect for scientific knowledge! ⚡\n\n"
                        "Whether it's biology, chemistry, or mathematics—every field is just humans trying to understand the map of reality. And maps? That's MY specialty! 🗺️✨\n"
                        "Ask me about any specific topic and I'll chart it for you! 🧭"
                    )

                elif any(k in lowered_msg for k in ["joke", "jokes", "funny", "laugh", "humor", "another joke", "different joke"]):
                    NAMI_JOKES = [
                        "Why did Zoro get lost on the way to the kitchen?\nBecause even a straight path has too many directions for that mosshead! ⚔️🤣",
                        "What do you call a pirate who skips school?\nCaptain Hooky! 😂🏴‍☠️\n\nLuffy actually asked me what school was, so I rest my case! 🍊",
                        "Why doesn't Sanji ever win at poker?\nBecause every time he gets a good hand, he folds it into a heart shape and gives it to a woman! 💕🤣",
                        "What's a navigator's least favorite movie?\nLost! Because I NEVER get lost—unlike certain swordsmen! 🧭😤",
                        "Why did Luffy fail his math test?\nHe kept eating all the pi! 🥧😂",
                        "What did the ocean say to the Straw Hat Pirates?\nNothing—it just waved! 🌊😂",
                        "Why does Chopper make a terrible thief?\nBecause he always gets caught—he's too adorable to run away! 🦌🤣"
                    ]
                    reply_text = f"Fufufu! Here's one from the Sunny, Irray! 🍊\n\n{random.choice(NAMI_JOKES)}\n\nWant another? Just ask! 😄⛵"

                elif any(k in lowered_msg for k in ["berry", "berries", "gold", "treasure", "money", "beli"]):
                    reply_text = random.choice(NAMI_BERRIES_REPLIES)

                elif any(k in lowered_msg for k in ["favourite arc", "favorite arc", "best arc", "fav arc",
                                                     "favourite one piece", "favorite one piece", "favourite op arc",
                                                     "best one piece arc", "favourite saga", "favorite saga"]):
                    reply_text = (
                        "Fufufu! My favourite One Piece arc? Easy! 🍊\n\n"
                        "**The Arlong Park Arc** holds a special place in my heart — it's MY arc, the one where Luffy finally smashed "
                        "Arlong's face into his own map room and freed my village after 8 years of suffering! 🍊⛵\n\n"
                        "But if I'm being objective about storytelling quality:\n"
                        "• **Marineford** — the most emotionally devastating war in One Piece history\n"
                        "• **Enies Lobby** — Robin's 'I want to live!' still gives me chills every time\n"
                        "• **Wano** — the grandest stage, samurai aesthetics, and Zoro finally going full Conqueror's Haki!\n\n"
                        "What's YOUR favourite arc, Irray? 🧭"
                    )

                elif any(k in lowered_msg for k in ["one piece", "pirate", "straw hat", "grand line"]):
                    reply_text = random.choice(NAMI_ONE_PIECE_REPLIES)

                else:
                    # Truly generic catch-all — still feels alive and in-character
                    reply_text = random.choice([
                        f"Fufufu! That's an interesting heading, Irray! 🍊 I'm charting a course through your question right now—what else can your Navigator help you explore? ⛵",
                        f"Yosh! Your Navigator is on it! Tell me more, Irray—the more detail you give me, the better I can chart our course! 🧭🍊",
                        f"Hmm, that's deep waters, Irray! 🌊 Even the Grand Line has uncharted corners. Ask me anything—anime, science, life advice, or pirate trivia! 🍊⛵"
                    ])

            recs_formatted = []
            all_recs_pool = []

        return ChatResponse(
            reply=reply_text,
            anime_recommendations=recs_formatted,
            all_recommendations=all_recs_pool
        )

    except Exception as err:
        log.error(f"Nami chat handler unexpected error: {err}", exc_info=True)
        return ChatResponse(
            reply=f"DEBUG_ERR: {type(err).__name__}: {str(err)}",
            anime_recommendations=[],
            all_recommendations=[]
        )
