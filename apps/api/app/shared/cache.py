import json
import logging
from typing import Any, Optional
import redis
from app.config import settings

logger = logging.getLogger("redis_cache")

# Initialize Redis client. If Redis URL is unreachable, we will handle exceptions.
try:
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
except Exception as e:
    logger.error(f"Failed to connect to Redis at {settings.REDIS_URL}: {e}")
    redis_client = None


def get_cached_json(key: str) -> Optional[Any]:
    """
    Retrieve cached JSON payload from Redis.
    Fails gracefully returning None if Redis is unavailable.
    """
    if redis_client is None:
        return None
    try:
        data = redis_client.get(key)
        if data:
            logger.info(f"Cache HIT for key: {key}")
            return json.loads(data)
        logger.info(f"Cache MISS for key: {key}")
    except Exception as e:
        logger.warning(f"Error reading from Redis cache: {e}")
    return None


def set_cached_json(key: str, data: Any, expire_seconds: int = 3600) -> bool:
    """
    Store JSON-serializable data in Redis cache with an expiration timeout.
    Fails gracefully returning False if Redis is unavailable.
    """
    if redis_client is None:
        return False
    try:
        payload = json.dumps(data)
        redis_client.setex(key, expire_seconds, payload)
        logger.info(f"Cache SET for key: {key} (expires: {expire_seconds}s)")
        return True
    except Exception as e:
        logger.warning(f"Error writing to Redis cache: {e}")
    return False


def invalidate_cache(key: str) -> bool:
    """
    Remove a key from Redis cache.
    """
    if redis_client is None:
        return False
    try:
        redis_client.delete(key)
        logger.info(f"Cache INVALIDATE for key: {key}")
        return True
    except Exception as e:
        logger.warning(f"Error invalidating Redis cache key {key}: {e}")
    return False
