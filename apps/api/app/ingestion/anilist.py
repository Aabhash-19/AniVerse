import logging
from typing import Dict, Any, Optional
import httpx

logger = logging.getLogger("anilist_adapter")

ANILIST_API_URL = "https://graphql.anilist.co"

MEDIA_QUERY = """
query ($page: Int, $perPage: Int, $id: Int) {
  Page (page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
      perPage
    }
    media (id: $id, type: ANIME, sort: POPULARITY_DESC) {
      id
      title {
        romaji
        english
        native
      }
      synonyms
      description
      format
      status
      source
      season
      seasonYear
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      episodes
      duration
      countryOfOrigin
      isAdult
      averageScore
      popularity
      favourites
      coverImage {
        large
        medium
      }
      bannerImage
      siteUrl
      genres
      tags {
        id
        name
        description
        category
        isAdult
        rank
        isMediaSpoiler
      }
      studios {
        edges {
          isMain
          node {
            id
            name
            isAnimationStudio
            siteUrl
          }
        }
      }
      characters (sort: [ROLE, RELEVANCE], perPage: 25) {
        edges {
          role
          node {
            id
            name {
              first
              middle
              last
              native
            }
            description
            image {
              large
            }
            gender
            dateOfBirth {
              year
              month
              day
            }
          }
          voiceActors (language: JAPANESE) {
            id
            name {
              first
              middle
              last
              native
            }
            image {
              large
            }
            description
          }
        }
      }
      staff (perPage: 15) {
        edges {
          role
          node {
            id
            name {
              first
              middle
              last
              native
            }
            description
            image {
              large
            }
          }
        }
      }
      relations {
        edges {
          relationType
          node {
            id
            type
          }
        }
      }
    }
  }
}
"""

# ── Airing Schedule Query ──────────────────────────────────────────────────────
AIRING_SCHEDULE_QUERY = """
query ($start: Int, $end: Int, $page: Int, $perPage: Int) {
  Page (page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
    }
    airingSchedules (airingAt_greater: $start, airingAt_less: $end, sort: TIME_ASC) {
      id
      airingAt
      episode
      mediaId
      media {
        id
        title { romaji english native }
        coverImage { large medium }
        format
        status
        season
        seasonYear
        genres
        averageScore
        popularity
      }
    }
  }
}
"""


class AniListClient:
    def __init__(self):
        self.client = httpx.Client(timeout=30.0)

    def fetch_anime_page(self, page: int = 1, per_page: int = 10) -> Dict[str, Any]:
        """
        Fetch a page of anime catalog from AniList ordered by popularity.
        """
        variables = {"page": page, "perPage": per_page}
        return self._execute_query(MEDIA_QUERY, variables)

    def fetch_anime_by_id(self, anilist_id: int) -> Optional[Dict[str, Any]]:
        """
        Fetch full details for a single anime by its AniList ID.
        """
        variables = {"id": anilist_id, "page": 1, "perPage": 1}
        response = self._execute_query(MEDIA_QUERY, variables)
        media_list = response.get("data", {}).get("Page", {}).get("media", [])
        if media_list:
            return media_list[0]
        return None

    def fetch_airing_schedule(
        self, start_timestamp: int, end_timestamp: int, page: int = 1, per_page: int = 50
    ) -> Dict[str, Any]:
        """
        Fetch upcoming airing episodes within a Unix timestamp window.
        Returns AiringSchedule entries with embedded minimal media info.
        """
        variables = {
            "start": start_timestamp,
            "end": end_timestamp,
            "page": page,
            "perPage": per_page,
        }
        return self._execute_query(AIRING_SCHEDULE_QUERY, variables)

    def fetch_user_lists(self, username: str) -> Dict[str, Any]:
        """
        Fetch the anime lists for a specific AniList user.
        """
        query = """
        query ($username: String) {
          MediaListCollection(userName: $username, type: ANIME) {
            lists {
              name
              status
              entries {
                status
                progress
                score(format: POINT_100)
                notes
                repeat
                startedAt {
                  year
                  month
                  day
                }
                completedAt {
                  year
                  month
                  day
                }
                media {
                  id
                }
              }
            }
          }
        }
        """
        variables = {"username": username}
        return self._execute_query(query, variables)

    def _execute_query(self, query: str, variables: Dict[str, Any]) -> Dict[str, Any]:
        payload = {"query": query, "variables": variables}
        try:
            logger.info(f"Querying AniList API variables: {variables}")
            response = self.client.post(ANILIST_API_URL, json=payload)
            
            # Check rate limiting headers if needed
            rate_limit_remaining = response.headers.get("x-ratelimit-remaining")
            if rate_limit_remaining and int(rate_limit_remaining) < 10:
                logger.warning(f"AniList Rate limit remaining low: {rate_limit_remaining}")
                
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error querying AniList: {e.response.text}")
            raise e
        except Exception as e:
            logger.error(f"Error querying AniList: {e}")
            raise e

    def close(self):
        self.client.close()
