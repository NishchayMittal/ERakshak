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
        timeout = httpx.Timeout(self.timeout_seconds)
        backoff = 0.5
        for attempt in range(self.max_retries + 1):
            try:
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