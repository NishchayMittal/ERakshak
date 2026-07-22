"""
WikipediaConnector — Resolves a person's name to their Wikipedia page
using the free, no-auth Wikipedia REST API.

Why Wikipedia?
  - Completely free, no API key required, no rate limit for reasonable usage
  - Covers virtually all notable/famous people (celebrities, politicians,
    historical figures, etc.)
  - Returns structured data: page title, extract/summary, page URL,
    thumbnail image, categories, and infobox data
  - The extract (first paragraph) acts as a mini-biography — perfect for
    investigation context

Data source:
  - Endpoint: https://en.wikipedia.org/api/rest_v1/page/summary/{title}
  - Also uses: https://en.wikipedia.org/w/api.php?action=query&list=search
    for finding the correct page title from a name query.

Every result is returned as a "wikipedia_entry" Finding with high confidence.
The canonicalizer extracts the Wikipedia URL which becomes a graph node.
"""
import math
import re
import httpx
import json

from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType


class WikipediaConnector(BaseConnector):
    name = "wikipedia_lookup"
    applies_to = (IdentifierType.name,)
    timeout_seconds = 8.0
    max_retries = 1

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        name = identifier_value.strip()
        if not name or len(name) < 2:
            return []

        meta = metadata or {}
        location = meta.get("location", "").strip()
        employer = meta.get("employer", "").strip()

        findings: list[Finding] = []

        async with httpx.AsyncClient(
            timeout=self.timeout_seconds,
            follow_redirects=True,
            headers={
                "User-Agent": "e-Rakshak-OSINT/1.0 (github.com/erakshak)",
                "Accept": "application/json",
            }
        ) as client:
            # Step 1: Search Wikipedia for the best page title
            page_title = await self._search_wikipedia(client, name, location, employer)
            if not page_title:
                return []

            # Step 2: Fetch the page summary
            summary = await self._fetch_summary(client, page_title)
            if not summary:
                return []

            findings.append(self._build_finding(page_title, summary, name))

        return findings

    # ------------------------------------------------------------------ #
    # Wikipedia Search API                                                 #
    # ------------------------------------------------------------------ #
    async def _search_wikipedia(
        self,
        client: httpx.AsyncClient,
        name: str,
        location: str,
        employer: str,
    ) -> str | None:
        """
        Search Wikipedia's search API for the given name.
        Returns the best matching page title, or None if no good match found.

        Uses multiple query strategies:
          1. Exact name search
          2. Name + location (if provided)
          3. Name + employer (if provided)
          4. Relaxed prefix search
        """
        # Strategy 1: Search by exact name
        title = await self._exact_search(client, name)
        if title:
            return title

        # Strategy 2: Add location or employer context
        context = location or employer
        if context:
            augmented = f"{name} {context}"
            title = await self._exact_search(client, augmented)
            if title:
                return title

        # Strategy 3: Use the name directly as a page title guess
        # Wikipedia URLs use underscores for spaces, and capitalize first letter
        guessed_title = name.strip().title().replace(" ", "_")
        summary = await self._fetch_summary(client, guessed_title)
        if summary and not self._is_disambiguation(summary):
            # Check that the page actually relates to the person we're searching for
            extract = summary.get("extract", "")
            page_title_lower = summary.get("title", "").lower()
            name_lower = name.lower()

            # Verify the name appears in the extract or title
            name_words = set(w.lower() for w in name.split() if len(w) > 2)
            if name_words and (name_lower in page_title_lower or any(w in extract.lower() for w in name_words)):
                return summary.get("title", guessed_title)

        return None

    async def _exact_search(self, client: httpx.AsyncClient, query: str) -> str | None:
        """Search Wikipedia and return the most relevant page title."""
        params = {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "srlimit": 5,
            "format": "json",
            "srprop": "titlesnippet|snippet",
        }
        try:
            resp = await client.get(
                "https://en.wikipedia.org/w/api.php",
                params=params,
            )
            if resp.status_code != 200:
                return None

            data = resp.json()
            search_results = data.get("query", {}).get("search", [])
            if not search_results:
                return None

            # Score each result: prefer exact title matches, then high word overlap
            query_lower = query.lower()
            query_words = set(w.lower() for w in query_lower.split() if len(w) > 2)

            best_score = -1
            best_title = None

            for result in search_results[:5]:
                title = result.get("title", "")
                title_lower = title.lower()
                snippet = result.get("snippet", "").lower()
                snippet_clean = re.sub(r'<[^>]+>', '', snippet)

                score = 0

                # Exact title match is best
                if title_lower == query_lower:
                    score += 100
                # Title starts with query
                elif title_lower.startswith(query_lower):
                    score += 50
                # Title contains query
                elif query_lower in title_lower:
                    score += 30

                # Word overlap score
                title_words = set(w.lower() for w in title.split() if len(w) > 2)
                overlap = len(query_words & title_words) if query_words else 0
                score += overlap * 10

                # Check if it's a person (has birth/death years in title like "Virat Kohli (cricketer)")
                has_disambiguation = "(disambiguation)" in title_lower
                if has_disambiguation:
                    score -= 200  # Strongly penalize disambiguation pages

                if score > best_score:
                    best_score = score
                    best_title = title

            # Only return if we have a reasonable match
            if best_score >= 10:
                return best_title

        except Exception:
            pass

        return None

    async def _fetch_summary(self, client: httpx.AsyncClient, page_title: str) -> dict | None:
        """Fetch the page summary from Wikipedia REST API."""
        if not page_title:
            return None

        safe_title = page_title.replace(" ", "_")
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{safe_title}"

        try:
            resp = await client.get(url)
            if resp.status_code == 200:
                return resp.json()
        except Exception:
            pass

        return None

    @staticmethod
    def _is_disambiguation(summary: dict) -> bool:
        """Check if a Wikipedia page is a disambiguation page."""
        if not summary:
            return True
        # Check the 'type' field
        if summary.get("type") == "disambiguation":
            return True
        # Check the title for "(disambiguation)"
        if "(disambiguation)" in summary.get("title", "").lower():
            return True
        return False

    @staticmethod
    def _build_finding(page_title: str, summary: dict, original_name: str) -> Finding:
        """
        Build a Finding from the Wikipedia summary data.

        The result_value is the Wikipedia article URL.
        raw_payload contains the full structured data for graph display.
        """
        extract = summary.get("extract", "")
        page_url = summary.get("content_urls", {}).get("desktop", {}).get("page", "")
        if not page_url:
            page_url = f"https://en.wikipedia.org/wiki/{page_title.replace(' ', '_')}"

        thumbnail = summary.get("thumbnail", {}).get("source", "")
        description = summary.get("description", "")
        categories = []
        if "categories" in summary:
            categories = [c.get("title", "") for c in summary["categories"][:5]]

        # Truncate extract for UI display if very long
        short_extract = extract[:500] + "..." if len(extract) > 500 else extract

        # Extract the first sentence for compact display
        first_sentence = extract.split(".")[0] + "." if extract else ""

        return Finding(
            connector_name="wikipedia_lookup",
            result_type="wikipedia_entry",
            result_value=f"Wikipedia: {page_title}",
            confidence=0.92,
            raw_payload={
                "page_title": page_title,
                "page_url": page_url,
                "description": description,
                "first_sentence": first_sentence,
                "extract": short_extract,
                "full_extract": extract,
                "thumbnail": thumbnail,
                "categories": categories,
                "matched_name": original_name,
            }
        )