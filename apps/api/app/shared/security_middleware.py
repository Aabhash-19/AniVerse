import time
import json
import logging
import uuid
from datetime import datetime
from typing import Dict, Tuple
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import redis

logger = logging.getLogger("security_middleware")
logger.setLevel(logging.INFO)

# Setup standard console handler for structured JSON logs
if not logger.handlers:
    ch = logging.StreamHandler()
    formatter = logging.Formatter('%(message)s')
    ch.setFormatter(formatter)
    logger.addHandler(ch)

class SecurityMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, redis_url: str = None):
        super().__init__(app)
        self.redis_client = None
        if redis_url:
            try:
                self.redis_client = redis.from_url(redis_url, socket_timeout=1)
                self.redis_client.ping()
            except Exception:
                logger.warning("Redis server offline. Falling back to in-memory rate limiter.")
                self.redis_client = None

        # Local in-memory rate limiter state
        self.memory_limit: Dict[str, Tuple[int, float]] = {}

    def _is_rate_limited(self, ip: str) -> bool:
        """
        Check rate limit: maximum 100 requests per minute per IP.
        """
        limit = 100
        window = 60
        now = time.time()

        if self.redis_client:
            try:
                key = f"rate_limit:{ip}"
                current = self.redis_client.get(key)
                if current and int(current) >= limit:
                    return True
                pipe = self.redis_client.pipeline()
                pipe.incr(key)
                pipe.expire(key, window)
                pipe.execute()
                return False
            except Exception:
                # Redis exception fallback to memory limit
                pass

        # In-memory rate limiting implementation
        if ip not in self.memory_limit:
            self.memory_limit[ip] = (1, now)
            return False
        
        count, start_time = self.memory_limit[ip]
        if now - start_time > window:
            self.memory_limit[ip] = (1, now)
            return False
        
        if count >= limit:
            return True
            
        self.memory_limit[ip] = (count + 1, start_time)
        return False

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        # 1. Rate Limiting Check
        client_ip = request.client.host if request.client else "127.0.0.1"
        
        # Bypass rate limit for docs / openapi schema to avoid UI locks
        is_docs = request.url.path.startswith(("/docs", "/redoc", "/openapi.json"))
        if not is_docs and self._is_rate_limited(client_ip):
            response = Response(
                content=json.dumps({"detail": "Too many requests. Please try again later."}),
                status_code=429,
                media_type="application/json"
            )
            # Add security headers even on rate limit response
            self._add_security_headers(response)
            response.headers["X-Request-ID"] = request_id
            return response

        # 2. Track Latency
        start_time = time.time()
        error_code = None
        try:
            response = await call_next(request)
        except Exception as e:
            error_code = type(e).__name__
            logger.error(json.dumps({
                "timestamp": datetime.utcnow().isoformat(),
                "request_id": request_id,
                "method": request.method,
                "route": request.url.path,
                "status_code": 500,
                "latency_ms": int((time.time() - start_time) * 1000),
                "error_code": error_code,
                "message": str(e)
            }))
            raise e

        latency_ms = int((time.time() - start_time) * 1000)

        # 3. Add Custom Headers
        response.headers["X-Request-ID"] = request_id
        self._add_security_headers(response)

        # 4. Structured JSON Logging
        log_payload = {
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            "request_id": request_id,
            "method": request.method,
            "route": request.url.path,
            "status_code": response.status_code,
            "latency_ms": latency_ms,
            "error_code": error_code
        }
        logger.info(json.dumps(log_payload))

        return response

    def _add_security_headers(self, response: Response):
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com; "
            "frame-src 'self' https://www.youtube.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https://s4.anilist.co https://img.youtube.com; "
            "connect-src 'self' http://localhost:8000 http://localhost:3000 ws://localhost:8000"
        )
