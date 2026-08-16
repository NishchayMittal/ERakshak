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
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("items", [])
            else:
                items = []

            # If no items found and name has phonetic/spelling variants, try top phonetic candidates
            if not items:
                from app.connectors.username_mutator import _phonetic_variants
                phonetic_alts = _phonetic_variants(name)
                for alt_var, _ in phonetic_alts[:3]:
                    # Format alt_var back with spaces if needed
                    alt_query = alt_var.replace(".", " ").replace("_", " ")
                    if alt_query.lower() == name.lower():
                        continue
                    try:
                        r_alt = await client.get(
                            "https://api.github.com/search/users",
                            params={"q": alt_query, "per_page": 3},
                        )
                        if r_alt.status_code == 200:
                            alt_items = r_alt.json().get("items", [])
                            if alt_items:
                                items.extend(alt_items)
                                break
                    except Exception:
                        pass
        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
            return []

        findings: list[Finding] = []

        # Pinpoint heuristic: If no anchors provided, cap at top 3 to reduce noise.
        limit = 5 if (location or employer) else 3

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
            # Use multi-metric fuzzy matching across display name and login handle to handle typos & misspellings
            from rapidfuzz import fuzz
            name_lower = name.lower()
            name_compact = name_lower.replace(" ", "")
            profile_name_lower = gh_name.lower()
            login_lower = login.lower()

            match_scores = []
            if gh_name:
                match_scores.extend([
                    fuzz.token_set_ratio(name_lower, profile_name_lower),
                    fuzz.WRatio(name_lower, profile_name_lower),
                    fuzz.ratio(name_compact, profile_name_lower.replace(" ", "")),
                    fuzz.partial_ratio(name_compact, profile_name_lower.replace(" ", "")),
                ])
            # Also check against the GitHub login/handle
            match_scores.extend([
                fuzz.token_set_ratio(name_lower, login_lower),
                fuzz.WRatio(name_lower, login_lower),
                fuzz.ratio(name_compact, login_lower.replace("-", "").replace("_", "")),
                fuzz.partial_ratio(name_compact, login_lower.replace("-", "").replace("_", "")),
            ])

            best_match = max(match_scores) if match_scores else 0
            if best_match < 60:
                continue   # profile doesn't sufficiently match queried name — skip

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
                            
                            # Use multi-metric fuzzy matching to handle typos, name concatenation, and transposed chars
                            from rapidfuzz import fuzz
                            name_clean = name.lower()
                            name_compact = name_clean.replace(" ", "")
                            match_ratio = max(
                                fuzz.token_set_ratio(name_clean, path_clean),
                                fuzz.WRatio(name_clean, path_clean),
                                fuzz.ratio(name_compact, path_clean),
                                fuzz.partial_ratio(name_compact, path_clean),
                            )
                            
                            # For Wikipedia, we need a slightly higher match to avoid false generic articles
                            threshold = 70 if site_key == "wikipedia" else 58
                            
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
