import logging
import time
from typing import Dict, Any, Optional
import httpx

logger = logging.getLogger("anilist_adapter")

ANILIST_API_URL = "https://graphql.anilist.co"

MEDIA_QUERY = """
query ($page: Int, $perPage: Int, $id: Int, $search: String, $status: MediaStatus) {
  Page (page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
      perPage
    }
    media (id: $id, search: $search, status: $status, type: ANIME, sort: POPULARITY_DESC) {
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
              medium
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
              medium
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
            title {
              romaji
              english
              native
            }
            coverImage {
              large
              medium
            }
            format
            status
            season
            seasonYear
            averageScore
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
    airingSchedules (airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
      id
      airingAt
      episode
      mediaId
      media {
        id
        title { romaji english native }
        coverImage { large medium }
        bannerImage
        description
        format
        status
        season
        seasonYear
        genres
        averageScore
        popularity
        siteUrl
      }
    }
  }
}
"""



RELATIONS_QUERY = """
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    relations {
      edges {
        relationType
        node {
          id
          type
          title {
            romaji
            english
            native
          }
          coverImage {
            large
            medium
          }
          format
          status
          season
          seasonYear
          averageScore
        }
      }
    }
  }
}
"""


class AniListClient:
    def __init__(self):
        self.client = httpx.Client(
            timeout=30.0,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            }
        )

    def fetch_relations_for_id(self, anilist_id: int) -> list:
        """
        Lightweight fetch of only the relation edges for a single anime ID.
        Used by BFS traversal to walk the full franchise chain.
        """
        try:
            response = self._execute_query(RELATIONS_QUERY, {"id": anilist_id})
            media = response.get("data", {}).get("Media", {})
            return media.get("relations", {}).get("edges", [])
        except Exception:
            return []

    def fetch_anime_page(self, page: int = 1, per_page: int = 10) -> Dict[str, Any]:
        """
        Fetch a page of anime catalog from AniList ordered by popularity.
        """
        variables = {"page": page, "perPage": per_page}
        return self._execute_query(MEDIA_QUERY, variables)

    def search_anime(self, search: str, page: int = 1, per_page: int = 10) -> list:
        """
        Search AniList GraphQL API for anime matching a search keyword.
        """
        variables = {"search": search, "page": page, "perPage": per_page}
        response = self._execute_query(MEDIA_QUERY, variables)
        return response.get("data", {}).get("Page", {}).get("media", [])

    def fetch_upcoming_anime(self, page: int = 1, per_page: int = 50) -> list:
        """
        Fetch unreleased / announced upcoming anime from AniList GraphQL API.
        """
        variables = {"status": "NOT_YET_RELEASED", "page": page, "perPage": per_page}
        response = self._execute_query(MEDIA_QUERY, variables)
        return response.get("data", {}).get("Page", {}).get("media", [])

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
                  type
                  title {
                    romaji
                    english
                    native
                  }
                  coverImage {
                    large
                    medium
                  }
                  bannerImage
                  format
                  status
                  season
                  seasonYear
                  averageScore
                  popularity
                  favourites
                  episodes
                  duration
                  countryOfOrigin
                  isAdult
                  description
                  siteUrl
                }
              }
            }
          }
        }
        """
        variables = {"username": username}
        return self._execute_query(query, variables)


    def fetch_reviews_for_id(self, anilist_id: int, page: int = 1, per_page: int = 20) -> list:
        """
        Fetch community reviews for a specific anime from AniList.
        Returns a list of review objects with user info, body, score, rating.
        """
        query = """
        query ($mediaId: Int, $page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            reviews(mediaId: $mediaId, sort: RATING_DESC) {
              id
              summary
              body(asHtml: false)
              rating
              ratingAmount
              score
              createdAt
              updatedAt
              user {
                id
                name
                avatar {
                  large
                  medium
                }
              }
            }
          }
        }
        """
        variables = {"mediaId": anilist_id, "page": page, "perPage": per_page}
        try:
            response = self._execute_query(query, variables)
            return response.get("data", {}).get("Page", {}).get("reviews", [])
        except Exception as e:
            logger.warning(f"Failed to fetch reviews for {anilist_id}: {e}")
            return []

    def fetch_recommendations_for_id(self, anilist_id: int, page: int = 1, per_page: int = 25) -> list:
        """
        Fetch curated AniList recommendations (user-voted) for a specific anime.
        Returns a list of recommendation nodes with related media info.
        """
        query = """
        query ($mediaId: Int, $page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            recommendations(mediaId: $mediaId, sort: RATING_DESC, onList: false) {
              id
              rating
              mediaRecommendation {
                id
                title {
                  romaji
                  english
                  native
                }
                format
                status
                averageScore
                episodes
                season
                seasonYear
                coverImage {
                  large
                  medium
                  color
                }
                genres
              }
            }
          }
        }
        """
        variables = {"mediaId": anilist_id, "page": page, "perPage": per_page}
        try:
            response = self._execute_query(query, variables)
            recs = response.get("data", {}).get("Page", {}).get("recommendations", [])
            # Filter out null mediaRecommendation and require positive rating
            return [r for r in recs if r.get("mediaRecommendation")]
        except Exception as e:
            logger.warning(f"Failed to fetch recommendations for {anilist_id}: {e}")
            return []

    def fetch_videos_for_id(self, anilist_id: int) -> dict:
        """
        Fetch trailer info and streaming episodes for a specific anime from AniList.
        Returns a dict with 'trailer' and 'streamingEpisodes' keys.
        """
        query = """
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            trailer {
              id
              site
              thumbnail
            }
            streamingEpisodes {
              title
              thumbnail
              url
              site
            }
          }
        }
        """
        variables = {"id": anilist_id}
        try:
            response = self._execute_query(query, variables)
            media = response.get("data", {}).get("Media", {}) or {}
            return {
                "trailer": media.get("trailer"),
                "streamingEpisodes": media.get("streamingEpisodes") or [],
            }
        except Exception as e:
            logger.warning(f"Failed to fetch videos for {anilist_id}: {e}")
            return {"trailer": None, "streamingEpisodes": []}

    def _execute_query(self, query: str, variables: Dict[str, Any]) -> Dict[str, Any]:
        import time
        payload = {"query": query, "variables": variables}
        max_retries = 3
        backoff_delays = [0.6, 1.5, 3.0]

        for attempt in range(max_retries):
            try:
                response = self.client.post(ANILIST_API_URL, json=payload)
                
                # Check rate limiting headers
                rate_limit_remaining = response.headers.get("x-ratelimit-remaining")
                if rate_limit_remaining and int(rate_limit_remaining) < 5:
                    logger.warning(f"AniList Rate limit remaining low ({rate_limit_remaining}), throttling 0.3s...")
                    time.sleep(0.3)
                    
                # Handle 429 Too Many Requests or 5xx server errors by retrying
                if response.status_code == 429 or response.status_code >= 500:
                    retry_after = response.headers.get("retry-after")
                    sleep_time = backoff_delays[attempt]
                    if retry_after and retry_after.isdigit():
                        retry_sec = int(retry_after)
                        if retry_sec <= 4:
                            sleep_time = float(retry_sec)
                    if attempt < max_retries - 1:
                        logger.warning(f"AniList status {response.status_code}, retrying attempt {attempt+1}/{max_retries} in {sleep_time}s...")
                        time.sleep(sleep_time)
                        continue

                response.raise_for_status()
                return response.json()
            except (httpx.HTTPStatusError, httpx.TimeoutException, httpx.RequestError) as e:
                if attempt < max_retries - 1:
                    sleep_time = backoff_delays[attempt]
                    logger.warning(f"AniList query attempt {attempt+1} failed ({e}), retrying in {sleep_time}s...")
                    time.sleep(sleep_time)
                else:
                    logger.error(f"All {max_retries} AniList query attempts failed: {e}")
                    raise e
            except Exception as e:
                logger.error(f"Error querying AniList: {e}")
                raise e

    def close(self):
        self.client.close()
