import logging
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

logger = logging.getLogger(__name__)


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
        except Exception as e:

            logger.error(f"Unexpected error: {e}", exc_info=True)
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
        except Exception as e:

            logger.error(f"Unexpected error: {e}", exc_info=True)
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
            except Exception as e:

                logger.warning(f"Silenced exception: {e}", exc_info=True)

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
                if not all(w in profile_name_lower for w in queried_words):
                    continue   # profile display name doesn't match all words — skip

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
    # DuckDuckGo HTML Search — free, no auth, no rate limit              #
    # ------------------------------------------------------------------ #
    async def _search_duckduckgo(
        self,
        client: httpx.AsyncClient,
        name: str,
        location: str,
        employer: str,
    ) -> list[Finding]:
        """
        Search DuckDuckGo HTML endpoint to find the person's social/bio profiles.
        This is completely free, no API key, no rate limit.

        Why the HTML endpoint (html.duckduckgo.com/html/) instead of the
        Instant Answer API (api.duckduckgo.com)?
          - The Instant Answer API only returns Wikipedia excerpts and
            curated "instant answers" — it almost never returns social
            profile links for real people.
          - The HTML endpoint returns actual web search results, including
            social profiles, Wikipedia pages, and bio sites.

        Strategy: search for the person's name and look for known
        social/bio platform links in the results.
        """
        import re
        from urllib.parse import quote_plus

        # Build a contextual name query
        context_parts = []
        if employer:
            context_parts.append(employer)
        if location:
            context_parts.append(location)

        query = name
        if context_parts:
            query = f"{name} {' '.join(context_parts)}"

        findings: list[Finding] = []
        seen_urls: set[str] = set()

        # Platforms to search for via DDG HTML search
        platforms = [
            # (domain_fragment, site_key, site_label, result_type)
            ("github.com", "github", "GitHub", "github_profile"),
            ("linkedin.com/in", "linkedin", "LinkedIn", "linkedin_profile"),
            ("twitter.com", "twitter", "Twitter/X", "twitter_profile"),
            ("instagram.com", "instagram", "Instagram", "instagram_profile"),
            ("facebook.com", "facebook", "Facebook", "facebook_profile"),
            ("youtube.com", "youtube", "YouTube", "youtube_profile"),
            ("wikipedia.org", "wikipedia", "Wikipedia", "wikipedia_bio"),
        ]

        try:
            resp = await client.post(
                "https://html.duckduckgo.com/html/",
                data={"q": query},
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            if resp.status_code != 200:
                return []

            html = resp.text

            # Extract result URLs from DDG HTML response
            # DDG wraps results in <a class="result__a" href="...">
            # with redirect URLs that contain the actual target
            all_urls: list[str] = []

            # Pattern 1: Standard result links
            for match in re.finditer(r'uddg=([^"&]+)', html):
                from urllib.parse import unquote
                decoded = unquote(match.group(1))
                if decoded and decoded.startswith("http"):
                    all_urls.append(decoded)

            # Pattern 2: Direct links (fallback)
            for match in re.finditer(r'class="result__a"[^>]*href="([^"]+)"', html):
                url = match.group(1)
                if url.startswith("http"):
                    all_urls.append(url)

            # Check each URL against known platforms
            for url in all_urls:
                url_lower = url.lower()
                if url in seen_urls:
                    continue

                for domain_frag, site_key, site_label, result_type in platforms:
                    if domain_frag in url_lower:
                        seen_urls.add(url)

                        # Determine confidence based on how specific the match is
                        if site_key == "wikipedia":
                            confidence = 0.85
                        elif site_key in ("linkedin", "github"):
                            confidence = 0.80
                        else:
                            confidence = 0.70

                        # Check for profile path specificity and name relevance
                        profile_path = self._extract_profile_path(url, site_key)
                        if profile_path:
                            path_clean = profile_path.lower().replace("-", "").replace("_", "")
                            
                            # Use fuzzy matching instead of strict substring checks to handle typos
                            from rapidfuzz import fuzz
                            # token_set_ratio is great here because path_clean might have extra words or missing spaces
                            match_ratio = fuzz.token_set_ratio(name.lower(), path_clean)
                            
                            # For Wikipedia, we need a slightly higher match to avoid false generic articles
                            threshold = 75 if site_key == "wikipedia" else 65
                            
                            if match_ratio < threshold:
                                continue
                                    
                            # Has a username/profile path → more likely a real profile
                            confidence = min(1.0, confidence + 0.10)

                        findings.append(Finding(
                            connector_name=self.name,
                            result_type="social_profile",
                            result_value=f"{site_label} Profile: {url}",
                            confidence=confidence,
                            raw_payload={
                                "site": site_key,
                                "profile_url": url,
                                "profile_path": profile_path or "",
                                "source": "duckduckgo_html",
                                "verified": False,
                            }
                        ))
                        break  # Only add once per URL

        except Exception as e:


            logger.warning(f"Silenced exception: {e}", exc_info=True)

        return findings

    @staticmethod
    def _extract_profile_path(url: str, site_key: str) -> str | None:
        """Extract the username/profile path from a social media URL."""
        from urllib.parse import urlparse

        try:
            parsed = urlparse(url)
            path = parsed.path.strip("/")

            if site_key == "github":
                # github.com/username or github.com/username/
                parts = path.split("/")
                if parts and parts[0] and parts[0] not in ("login", "explore", "topics", "settings", "notifications"):
                    return parts[0]

            elif site_key == "linkedin":
                # linkedin.com/in/username
                if path.startswith("in/"):
                    return path[3:].split("/")[0]

            elif site_key == "instagram":
                parts = path.split("/")
                if parts[0] and parts[0] not in ("p", "explore", "explore", "accounts", "reel"):
                    return parts[0]

            elif site_key == "wikipedia":
                # en.wikipedia.org/wiki/Page_Title
                if "wiki/" in path:
                    return path.split("wiki/")[-1].replace("_", " ")

            elif site_key == "twitter":
                parts = path.split("/")
                if parts and parts[0] not in ("login", "explore", "home", "search", "notifications", "i"):
                    return parts[0]

        except Exception as e:


            logger.warning(f"Silenced exception: {e}", exc_info=True)

        return None
