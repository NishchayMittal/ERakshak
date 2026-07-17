"""
NameSearchConnector — Resolves a person's name to real digital identities
using publicly accessible free APIs, boosted by demographic anchors.

Anchor keys (passed via `metadata` dict from identifier_metadata):
  - location  : city or region (e.g. "Mumbai", "Surat")
  - employer  : company/org name (e.g. "Google", "SVNIT")
  - age       : integer age (used to estimate graduation/join year ranges)

Data sources:
  1. GitHub Search API  — free, no auth, 10 req/min unauthenticated
     Endpoint: https://api.github.com/search/users
     Query:    q=<fullname>+location:<city>+company:<employer>
     Returns:  Real GitHub accounts with username, display name, location, company

  2. Keybase API        — free, open, no auth
     Endpoint: https://keybase.io/_/api/1.0/user/search.json
     Query:    q=<fullname>&num_wanted=5
     Returns:  Keybase accounts with linked GitHub, Twitter, Reddit handles
     Bonus:    Each Keybase result has linked proofs that become pivot usernames

Every real result is returned as a `social_profile` Finding with high confidence
AND its username is extractable by the canonicalizer → triggers UsernameEnumConnector.
"""
import asyncio
import httpx

from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType


class NameSearchConnector(BaseConnector):
    name = "name_search"
    applies_to = (IdentifierType.name,)
    timeout_seconds = 8.0
    max_retries = 0

    async def check_health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as c:
                r = await c.get("https://api.github.com/zen")
                return r.status_code == 200
        except Exception:
            return False

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
                "Accept": "application/vnd.github+json",
            }
        ) as client:
            gh_task = self._search_github(client, name, location, employer)
            ddg_task = self._search_duckduckgo(client, name, location, employer)
            results = await asyncio.gather(gh_task, ddg_task, return_exceptions=True)

        for r in results:
            if isinstance(r, list):
                findings.extend(r)

        # Deduplicate by result_value
        seen = set()
        deduped = []
        for f in findings:
            if f.result_value not in seen:
                seen.add(f.result_value)
                deduped.append(f)

        return deduped

    # ------------------------------------------------------------------ #
    # GitHub Search                                                         #
    # ------------------------------------------------------------------ #
    async def _search_github(
        self,
        client: httpx.AsyncClient,
        name: str,
        location: str,
        employer: str
    ) -> list[Finding]:
        """
        Search GitHub users API with name + optional location/company anchors.
        Returns up to 5 results — only confirmed public GitHub accounts.
        """
        # Build query — GitHub supports field:value qualifiers
        # Do NOT quote the name — GitHub's search ignores quoted full names
        q_parts = [name]
        if location:
            q_parts.append(f"location:{location}")
        if employer:
            q_parts.append(f"company:{employer}")

        query = " ".join(q_parts)

        try:
            resp = await client.get(
                "https://api.github.com/search/users",
                params={"q": query, "per_page": 5},
            )
            if resp.status_code == 403:
                # Rate limited — try without location/company to reduce query complexity
                resp = await client.get(
                    "https://api.github.com/search/users",
                    params={"q": name, "per_page": 3},
                )
            if resp.status_code == 422:
                # Query too strict — retry without company qualifier
                q_fallback = " ".join(p for p in q_parts if not p.startswith("company:"))
                resp = await client.get(
                    "https://api.github.com/search/users",
                    params={"q": q_fallback, "per_page": 5},
                )
            if resp.status_code != 200:
                return []

            data = resp.json()
        except Exception:
            return []

        items = data.get("items", [])
        findings: list[Finding] = []

        # Pinpoint heuristic: If no anchors provided, cap at top 2 to reduce noise.
        limit = 5 if (location or employer) else 2

        for item in items[:limit]:
            login = item.get("login", "")
            if not login:
                continue

            # Fetch the user's full profile to get name/location/company details
            profile_data = {}
            try:
                pr = await client.get(f"https://api.github.com/users/{login}")
                if pr.status_code == 200:
                    profile_data = pr.json()
            except Exception:
                pass

            gh_name = profile_data.get("name") or ""
            gh_location = profile_data.get("location") or ""
            gh_company = (profile_data.get("company") or "").lstrip("@")
            gh_bio = profile_data.get("bio") or ""
            gh_email = profile_data.get("email") or ""
            gh_blog = profile_data.get("blog") or ""

            # --- Name relevance filter ---
            # Only include if the profile's display name shares a word with the queried name.
            # Meaningful words = words longer than 2 chars (skip "de", "van", etc.)
            queried_words = [w.lower() for w in name.split() if len(w) > 2]
            profile_name_lower = gh_name.lower()
            if gh_name and queried_words:
                if not any(w in profile_name_lower for w in queried_words):
                    continue   # profile display name doesn't match — skip

            profile_url = f"https://github.com/{login}"

            findings.append(Finding(
                connector_name=self.name,
                result_type="social_profile",
                result_value=f"GitHub Profile: {profile_url}",
                confidence=0.85,
                raw_payload={
                    "site": "github",
                    "username": login,
                    "display_name": gh_name,
                    "profile_url": profile_url,
                    "location": gh_location,
                    "company": gh_company,
                    "bio": gh_bio,
                    "email": gh_email,
                    "blog": gh_blog,
                    "anchor_location": gh_location,
                    "verified": True,
                }
            ))

            # If GitHub exposes their public email, emit it as a pivot
            if gh_email and "@" in gh_email:
                findings.append(Finding(
                    connector_name=self.name,
                    result_type="registrant_email",
                    result_value=gh_email.strip().lower(),
                    confidence=0.9,
                    raw_payload={
                        "source": "github_profile",
                        "github_login": login,
                    }
                ))

        return findings

    # ------------------------------------------------------------------ #
    # DuckDuckGo Instant Answer — free, no auth, no rate limit            #
    # ------------------------------------------------------------------ #
    async def _search_duckduckgo(
        self,
        client: httpx.AsyncClient,
        name: str,
        location: str,
        employer: str,
    ) -> list[Finding]:
        """
        Use DuckDuckGo Instant Answer API to find the person's social profiles.
        This is completely free, no API key, no rate limit.

        Strategy: build targeted queries like:
          '{name} site:github.com'
          '{name} site:linkedin.com'
          '{name} site:twitter.com'
        and extract profile links from the abstract or related topics.
        """
        import re

        # Build a contextual name query
        context = ""
        if employer:
            context = f" {employer}"
        elif location:
            context = f" {location}"

        findings: list[Finding] = []
        seen_urls: set[str] = set()

        # Platforms to search via DDG (site: queries)
        platforms = [
            ("github.com", "github", "GitHub"),
            ("linkedin.com/in", "linkedin", "LinkedIn"),
            ("twitter.com", "twitter", "Twitter/X"),
        ]

        for site_query, site_key, site_label in platforms:
            query = f'{name}{context} site:{site_query}'
            try:
                resp = await client.get(
                    "https://api.duckduckgo.com/",
                    params={"q": query, "format": "json", "no_html": "1", "skip_disambig": "1"},
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0"},
                )
                if resp.status_code != 200:
                    continue

                data = resp.json()
                
                # Check AbstractURL — DDG's top result URL
                abstract_url = data.get("AbstractURL", "")
                abstract_text = data.get("Abstract", "")
                
                if abstract_url and site_query.split("/")[0] in abstract_url:
                    if abstract_url not in seen_urls:
                        seen_urls.add(abstract_url)
                        findings.append(Finding(
                            connector_name=self.name,
                            result_type="social_profile",
                            result_value=f"{site_label} Profile: {abstract_url}",
                            confidence=0.75,
                            raw_payload={
                                "site": site_key,
                                "profile_url": abstract_url,
                                "abstract": abstract_text[:200],
                                "source": "duckduckgo_instant",
                            }
                        ))

                # Also check RelatedTopics for profile links
                for topic in data.get("RelatedTopics", [])[:3]:
                    if not isinstance(topic, dict):
                        continue
                    first_url = topic.get("FirstURL", "")
                    text = topic.get("Text", "")
                    if first_url and site_query.split("/")[0] in first_url:
                        if first_url not in seen_urls:
                            seen_urls.add(first_url)
                            findings.append(Finding(
                                connector_name=self.name,
                                result_type="social_profile",
                                result_value=f"{site_label} Profile: {first_url}",
                                confidence=0.65,
                                raw_payload={
                                    "site": site_key,
                                    "profile_url": first_url,
                                    "text": text[:200],
                                    "source": "duckduckgo_related",
                                }
                            ))

            except Exception:
                continue

        return findings
