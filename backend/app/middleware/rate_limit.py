import time
import threading
from typing import Dict, Tuple
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)

class MemoryEfficientRateLimiter:
    """
    Fixed-window rate limiter utilizing ultra-low memory footprints (2 integers per IP).
    Avoids OOM issues common in sliding-window limiters under high loads.
    """
    def __init__(self, gc_interval: int = 300):
        # Maps key -> (request_count, window_start_time)
        self.history: Dict[str, Tuple[int, int]] = {}
        self.lock = threading.Lock()
        self.last_gc = time.time()
        self.gc_interval = gc_interval

    def _garbage_collect(self, now: int):
        if now - self.last_gc > self.gc_interval:
            # Clean up old records that are well past their 60s windows
            stale_keys = [k for k, v in self.history.items() if now - v[1] > 120]
            for k in stale_keys:
                del self.history[k]
            self.last_gc = now

    def is_allowed(self, client_ip: str, path: str, limit: int, window: int) -> bool:
        now = int(time.time())
        key = f"{client_ip}:{path}"
        
        with self.lock:
            self._garbage_collect(now)
            
            record = self.history.get(key)
            if not record:
                self.history[key] = (1, now)
                return True
                
            count, window_start = record
            
            if now - window_start >= window:
                # Reset window
                self.history[key] = (1, now)
                return True
                
            if count >= limit:
                return False
                
            # Increment count
            self.history[key] = (count + 1, window_start)
            return True


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, default_limit: int = 60, default_window: int = 60):
        super().__init__(app)
        self.limiter = MemoryEfficientRateLimiter()
        self.default_limit = default_limit
        self.default_window = default_window

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        
        # Bypass static files, websockets, and health checks
        if (
            path.startswith("/static")
            or path.startswith("/ws")
            or path == "/"
            or path.startswith("/health")
        ):
            return await call_next(request)

        # Get Client IP
        client_ip = request.client.host if request.client else "unknown"
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()

        # Route specific constraints
        limit, window = self.default_limit, self.default_window
        if path.startswith("/auth/login") or path.startswith("/auth/signup"):
            limit, window = 5, 60  # Strict constraints on sensitive routes
        elif path.startswith("/api/tts") or path.startswith("/tts"):
            limit, window = 30, 60  # 30 TTS requests per minute per IP

        try:
            allowed = self.limiter.is_allowed(client_ip, path, limit, window)
        except Exception as e:
            logger.error(f"Rate limiter check error: {e}")
            allowed = True

        if not allowed:
            logger.warning(f"Rate limit exceeded for {client_ip} on {path}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Too many requests. Please slow down."}
            )

        return await call_next(request)
