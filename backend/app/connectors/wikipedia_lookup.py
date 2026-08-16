import logging
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

logger = logging.getLogger(__name__)


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
                "User-Agent": "Orion-CyberIntel/2.0 (https://github.com/erakshak/orion; forensic-tool@svnit.ac.in)",
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

        # Strategy 3: Try typo & phonetic variations of the name
        from app.connectors.username_mutator import _phonetic_variants, _typo_variants
        variant_queries = []
        for alt, _ in _phonetic_variants(name)[:4]:
            variant_queries.append(alt.replace(".", " ").replace("_", " "))
        for alt, _ in _typo_variants(name)[:4]:
            variant_queries.append(alt.replace(".", " ").replace("_", " "))

        for vq in variant_queries:
            if vq.lower() == name.lower():
                continue
            title = await self._exact_search(client, vq, target_name=name)
            if title:
                return title

        # Strategy 4: Search individual distinct words of the name if multi-word
        words = [w.strip() for w in name.split() if len(w.strip()) >= 3]
        if len(words) >= 2:
            for w in words:
                title = await self._exact_search(client, w, target_name=name)
                if title:
                    return title

        # Strategy 5: Use the name directly as a page title guess
        # Wikipedia URLs use underscores for spaces, and capitalize first letter
        guessed_title = name.strip().title().replace(" ", "_")
        summary = await self._fetch_summary(client, guessed_title)
        if summary and not self._is_disambiguation(summary):
            # Check that the page actually relates to the person we're searching for
            extract = summary.get("extract", "")
            page_title_lower = summary.get("title", "").lower()
            name_lower = name.lower()

            from rapidfuzz import fuzz
            if fuzz.token_set_ratio(name_lower, page_title_lower) >= 60 or fuzz.partial_ratio(name_lower, extract.lower()) >= 65:
                return summary.get("title", guessed_title)

        return None

    async def _exact_search(self, client: httpx.AsyncClient, query: str, target_name: str | None = None) -> str | None:
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

            # Score each result: compare against target_name if provided, else query
            target_clean = (target_name or query).lower()
            query_words = set(w.lower() for w in target_clean.split() if len(w) > 2)

            best_score = -1
            best_title = None

            for result in search_results[:5]:
                title = result.get("title", "")
                title_lower = title.lower()

                score = 0

                from rapidfuzz import fuzz
                # Exact title match is best
                if title_lower == target_clean:
                    score += 100
                elif title_lower.startswith(target_clean):
                    score += 50
                elif target_clean in title_lower:
                    score += 30

                # Length penalty: if the candidate title is only a single short word while target has multiple words
                target_words_count = len(target_clean.split())
                title_words_count = len(title_lower.split())
                
                # Balanced fuzzy metric using token_sort_ratio and character ratio
                fuzzy_sim = max(
                    fuzz.token_sort_ratio(target_clean, title_lower),
                    fuzz.ratio(target_clean, title_lower),
                    fuzz.ratio(target_clean.replace(" ", ""), title_lower.replace(" ", ""))
                )
                score += fuzzy_sim * 1.0

                # Word overlap score
                title_words = set(w.lower() for w in title.split() if len(w) > 2)
                overlap = len(query_words & title_words) if query_words else 0
                score += overlap * 10

                if target_words_count >= 2 and title_words_count == 1:
                    score -= 25  # Penalize choosing a single name (like 'Arnold') when a full name was queried

                # Check if it's a person (has birth/death years in title like "Virat Kohli (cricketer)")
                has_disambiguation = "(disambiguation)" in title_lower
                if has_disambiguation:
                    score -= 200  # Strongly penalize disambiguation pages

                if score > best_score:
                    best_score = score
                    best_title = title

            # Only return if we have a reasonable match
            if best_score >= 60:
                return best_title

        except Exception as e:


            logger.warning(f"Silenced exception: {e}", exc_info=True)

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
        except Exception as e:

            logger.warning(f"Silenced exception: {e}", exc_info=True)

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