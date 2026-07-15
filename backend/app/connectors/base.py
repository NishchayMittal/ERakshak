from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx

from app.models import IdentifierType


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
        self.last_update = asyncio.get_event_loop().time()
        self.lock = asyncio.Lock()

    async def acquire(self):
        async with self.lock:
            while True:
                now = asyncio.get_event_loop().time()
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
DOMAIN_LIMITER = TokenBucketLimiter(rate=0.7)    #rdap/crt.sh (~1 request per 1.5s)
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
    timeout_seconds: float = 15.0
    max_retries: int = 2

    @abstractmethod
    async def run(self, identifier_value: str) -> list[Finding]:
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
                    response = await client.get(url, params=params)
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