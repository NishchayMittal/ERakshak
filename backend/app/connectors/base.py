from __future__ import annotations
import logging

import asyncio
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional

import httpx
import redis.asyncio as redis

from app.models import IdentifierType

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class Finding:
    connector_name: str
    result_type: str
    result_value: str
    confidence: float
    raw_payload: dict | None = None


class TokenBucketLimiter:
    def __init__(self, rate: float, capacity: float = 1.0):
        self.rate = rate  # tokens per second
        self.capacity = capacity
        self.tokens = capacity
        self.last_update = None
        self._lock = None
        self._loop = None

    async def acquire(self):
        loop = asyncio.get_running_loop()
        if self._lock is None or self._loop != loop:
            self._lock = asyncio.Lock()
            self._loop = loop
            self.last_update = loop.time()

        async with self._lock:
            while True:
                now = loop.time()
                elapsed = now - self.last_update
                self.last_update = now
                self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
                if self.tokens >= 1.0:
                    self.tokens -= 1.0
                    return
                # Sleep until enough tokens have accumulated
                sleep_time = (1.0 - self.tokens) / self.rate
                await asyncio.sleep(sleep_time)


# Predefined rate limiters for the 4 connector categories
DOMAIN_LIMITER = TokenBucketLimiter(rate=0.7)    # rdap/crt.sh (~1 request per 1.5s)
ARCHIVE_LIMITER = TokenBucketLimiter(rate=1.0)   # wayback (~1 request per second)
USERNAME_LIMITER = TokenBucketLimiter(rate=3.0)  # username checks (~3 requests per second)
OFFLINE_LIMITER = TokenBucketLimiter(rate=100.0) # local offline connectors (no limit)


def get_limiter_for_connector(connector_name: str) -> TokenBucketLimiter:
    if connector_name in ("whois_rdap", "crtsh"):
        return DOMAIN_LIMITER
    elif connector_name == "wayback_cdx":
        return ARCHIVE_LIMITER
    elif connector_name == "username_enumeration":
        return USERNAME_LIMITER
    else:
        return OFFLINE_LIMITER


class BaseConnector(ABC):
    name: str
    applies_to: tuple[IdentifierType, ...]
    timeout_seconds: float = 5.0
    max_retries: int = 0
    # Cache TTL in seconds (default 1 hour)
    cache_ttl: int = 3600
    # Redis client (shared across instances)
    _redis_client: Optional[redis.Redis] = None

    @classmethod
    def _get_redis_client(cls) -> Optional[redis.Redis]:
        import asyncio
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if cls._redis_client is not None and getattr(cls, "_loop", None) != loop:
            try:
                cls._redis_client.connection_pool.disconnect()
            except Exception as e:

                logger.warning(f"Silenced exception: {e}", exc_info=True)
            cls._redis_client = None

        if cls._redis_client is None:
            try:
                redis_url = "redis://localhost:6379/0"  # Default, can be overridden by env
                import os
                redis_url = os.environ.get("REDIS_URL", redis_url)
                cls._redis_client = redis.from_url(redis_url)
                cls._loop = loop
            except Exception as e:

                logger.error(f"Unexpected error: {e}", exc_info=True)
                # If Redis is not available, we disable caching
                cls._redis_client = None
                cls._loop = None
        return cls._redis_client

    async def _get_from_cache(self, identifier_value: str) -> Optional[List[Finding]]:
        """Try to get cached findings for this connector and identifier."""
        r = self._get_redis_client()
        if r is None:
            return None
        key = f"connector:{self.name}:{identifier_value}"
        try:
            cached = await r.get(key)
            if cached is not None:
                # Deserialize the list of Findings
                data = json.loads(cached)
                # Convert each dict back to a Finding object
                findings = []
                for item in data:
                    finding = Finding(
                        connector_name=item["connector_name"],
                        result_type=item["result_type"],
                        result_value=item["result_value"],
                        confidence=item["confidence"],
                        raw_payload=item.get("raw_payload")
                    )
                    findings.append(finding)
                return findings
        except redis.exceptions.ConnectionError:
            logger.debug("Redis cache offline, ignoring cache read.")
            self.__class__._redis_client = None
            return None
        except Exception as e:
            logger.warning(f"Cache read error: {e}")
            return None

    async def _set_in_cache(self, identifier_value: str, findings: List[Finding]):
        """Cache the findings for this connector and identifier."""
        r = self._get_redis_client()
        if r is None:
            return
        key = f"connector:{self.name}:{identifier_value}"
        try:
            # Serialize the list of Findings to a list of dicts
            data = []
            for f in findings:
                data.append({
                    "connector_name": f.connector_name,
                    "result_type": f.result_type,
                    "result_value": f.result_value,
                    "confidence": f.confidence,
                    "raw_payload": f.raw_payload
                })
            await r.set(key, json.dumps(data), ex=self.cache_ttl)
        except redis.exceptions.ConnectionError:
            logger.debug("Redis cache offline, ignoring cache write.")
            self.__class__._redis_client = None
        except Exception as e:
            logger.warning(f"Cache write error: {e}")

    @staticmethod
    def _has_mx_record(domain: str) -> bool:
        """Check if a domain has MX records. Returns True if MX found, False otherwise.
        If dnspython is not available, assumes True to avoid blocking."""
        try:
            import dns.resolver
            try:
                answers = dns.resolver.resolve(domain, 'MX')
                return len(list(answers)) > 0
            except Exception as e:

                logger.error(f"Unexpected error: {e}", exc_info=True)
                # No MX records or error
                return False
        except Exception as e:

            logger.error(f"Unexpected error: {e}", exc_info=True)
            # dnspython not installed; assume domain may have MX (fail open)
            return True

    @abstractmethod
    async def run(self, identifier_value: str, metadata: dict | None = None) -> List[Finding]:
        raise NotImplementedError

    async def check_health(self) -> bool:
        return True

    async def _get_json(self, url: str, params: dict | None = None) -> dict | list | None:
        limiter = get_limiter_for_connector(self.name)
        timeout = httpx.Timeout(self.timeout_seconds)
        backoff = 0.5
        for attempt in range(self.max_retries + 1):
            try:
                # Apply rate limiting before the call
                await limiter.acquire()
                async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                    response = await client.get(url, params=params, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) e-Rakshak/1.0"})
                    response.raise_for_status()
                    return response.json()
            except (httpx.HTTPError, ValueError):
                if attempt >= self.max_retries:
                    return None
                await asyncio.sleep(backoff)
                backoff *= 2
        return None


class ConnectorRegistry:
    def __init__(self) -> None:
        self._connectors: list[BaseConnector] = []

    def register(self, connector: BaseConnector) -> None:
        self._connectors.append(connector)

    def for_type(self, id_type: IdentifierType) -> list[BaseConnector]:
        return [connector for connector in self._connectors if id_type in connector.applies_to]

    def all(self) -> list[BaseConnector]:
        return list(self._connectors)


registry = ConnectorRegistry()