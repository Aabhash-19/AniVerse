"""
YouTube Video Discovery Candidate Scoring Engine.

Applies confidence scoring rules as defined in the AniVerse PDF specification (Page 8):
- Official verified channel: +50 points
- Title exact match: +20 points
- Title contains anime name: +10 points
- Video type keyword match (PV, Trailer, OP, ED, etc.): +15 points
- Known bad keywords (Reaction, Fan Edit, AMV, etc.): -50 points
- Duration-based heuristics for trailers/clips: +5 to +10 points
"""
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger("video_discovery")

# Official YouTube channel registry (seeded defaults)
OFFICIAL_CHANNELS = [
    {"youtube_channel_id": "UCVTQuK2CaWaTgSsoNkn5AiQ", "name": "Aniplex USA"},
    {"youtube_channel_id": "UC0wNSTMWIL3qaorLx0jie6A", "name": "Muse Asia"},
    {"youtube_channel_id": "UCgnfPPb9JI3e9A4v7iLfu2g", "name": "Crunchyroll"},
    {"youtube_channel_id": "UCkAGrHCLFmlK3H2kd6isipg", "name": "Netflix Anime"},
    {"youtube_channel_id": "UC7f3hvkEt4MkOm1QqomMKKg", "name": "Funimation"},
    {"youtube_channel_id": "UCVTQuK2CaWaTgSsoNkn5AiQ", "name": "Ani-One Asia"},
]

# Positive keyword categories
TRAILER_KEYWORDS = ["trailer", "pv", "preview", "teaser", "official", "mv", "music video"]
EPISODE_KEYWORDS = ["episode", "full episode", "ep.", "ep1", "ep2", "ep3", "episode 1"]
OPENING_KEYWORDS = ["opening", "op", "opening theme", "op1", "op2"]
ENDING_KEYWORDS = ["ending", "ed", "ending theme", "ed1", "ed2"]
CLIP_KEYWORDS = ["clip", "scene", "highlight", "english dub", "dubbed", "sub"]

# Negative indicators — strongly suggests unofficial/fan content
BAD_KEYWORDS = [
    "reaction", "reacting", "react",
    "fan edit", "fan made", "amv", "fan animation",
    "parody", "meme", "funny moments",
    "try not to laugh", "ranked", "top 10", "list",
    "review", "explained", "analysis", "theory",
    "tribute", "fan film", "abridged",
]


def score_video_candidate(
    video_data: Dict[str, Any],
    anime_title: str,
    channel_ids_verified: List[str]
) -> Dict[str, Any]:
    """
    Score a YouTube video candidate for relevance and officiality.
    
    Returns:
        dict with confidence_score (0-100) and matched_rules list
    """
    score = 0
    matched_rules = []

    title = (video_data.get("title") or "").lower()
    description = (video_data.get("description") or "").lower()
    channel_id = video_data.get("channel_id") or ""
    duration = video_data.get("duration_seconds") or 0

    # --- Rule 1: Official Channel Registry (+50) ---
    if channel_id in channel_ids_verified:
        score += 50
        matched_rules.append({"rule": "official_channel", "points": 50})

    # --- Rule 2: Anime title exact match in video title (+20) ---
    anime_lower = anime_title.lower()
    if anime_lower in title:
        score += 20
        matched_rules.append({"rule": "title_exact_match", "points": 20})
    elif any(word in title for word in anime_lower.split() if len(word) > 3):
        score += 10
        matched_rules.append({"rule": "title_partial_match", "points": 10})

    # --- Rule 3: Positive keyword match (+15 for type, +5 per additional) ---
    for kw in TRAILER_KEYWORDS:
        if kw in title:
            score += 15
            matched_rules.append({"rule": f"keyword_trailer:{kw}", "points": 15})
            break

    for kw in OPENING_KEYWORDS:
        if kw in title:
            score += 12
            matched_rules.append({"rule": f"keyword_opening:{kw}", "points": 12})
            break

    for kw in ENDING_KEYWORDS:
        if kw in title:
            score += 12
            matched_rules.append({"rule": f"keyword_ending:{kw}", "points": 12})
            break

    for kw in CLIP_KEYWORDS:
        if kw in title or kw in description:
            score += 8
            matched_rules.append({"rule": f"keyword_clip:{kw}", "points": 8})
            break

    # --- Rule 4: Duration heuristics ---
    # Trailers are usually 60s-5min, full episodes 20-30min
    if 30 < duration <= 300:
        score += 5
        matched_rules.append({"rule": "duration_trailer_range", "points": 5})
    elif duration > 900:  # > 15 minutes - likely full episode
        score += 8
        matched_rules.append({"rule": "duration_full_episode_range", "points": 8})

    # --- Rule 5: Bad keyword detection (-50 each occurrence) ---
    for kw in BAD_KEYWORDS:
        if kw in title or kw in description:
            score -= 50
            matched_rules.append({"rule": f"bad_keyword:{kw}", "points": -50})

    # Clamp score between 0 and 100
    final_score = max(0, min(100, score))

    return {
        "confidence_score": round(final_score, 2),
        "matched_rules": matched_rules,
        "is_likely_official": final_score >= 60,
    }


def create_mock_candidates(anime_title: str, anime_id: int) -> List[Dict[str, Any]]:
    """
    Generate mock video candidates for development use when YouTube API quota is unavailable.
    In production this would call YouTube Data API v3 search endpoint.
    """
    return [
        {
            "provider_video_id": f"MOCK_{anime_id}_TRAILER_001",
            "title": f"{anime_title} – Official PV",
            "description": f"Official trailer for {anime_title}. All rights reserved.",
            "channel_id": "UC0wNSTMWIL3qaorLx0jie6A",  # Muse Asia
            "duration_seconds": 120,
            "thumbnail_url": None,
            "published_at": None,
        },
        {
            "provider_video_id": f"MOCK_{anime_id}_OP_001",
            "title": f"{anime_title} – Opening Theme Full",
            "description": f"Opening theme song for {anime_title}.",
            "channel_id": "UC0wNSTMWIL3qaorLx0jie6A",
            "duration_seconds": 90,
            "thumbnail_url": None,
            "published_at": None,
        },
        {
            "provider_video_id": f"MOCK_{anime_id}_REACTION",
            "title": f"My REACTION to {anime_title} Episode 1!!",
            "description": "Fan reaction video — this is NOT official content.",
            "channel_id": "FAN_CHANNEL_123",
            "duration_seconds": 900,
            "thumbnail_url": None,
            "published_at": None,
        },
    ]
