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
            kb_task = self._search_keybase(client, name)
            results = await asyncio.gather(gh_task, kb_task, return_exceptions=True)

        for r in results:
            if isinstance(r, list):
                findings.extend(r)

        return findings

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

        for item in items[:5]:
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
    # Keybase Search                                                        #
    # ------------------------------------------------------------------ #
    async def _search_keybase(
        self,
        client: httpx.AsyncClient,
        name: str,
    ) -> list[Finding]:
        """
        Search Keybase for the person's name.
        Each Keybase result includes cryptographically verified proof links to
        GitHub, Twitter, Reddit, HackerNews — these become pivot usernames.
        """
        try:
            resp = await client.get(
                "https://keybase.io/_/api/1.0/user/search.json",
                params={"q": name, "num_wanted": 5},
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
        except Exception:
            return []

        findings: list[Finding] = []
        components_list = data.get("list", [])

        for entry in components_list[:5]:
            components = entry.get("components", {})
            kb_username = components.get("username", {}).get("val", "")
            full_name = components.get("full_name", {}).get("val", "")

            if not kb_username:
                continue

            # Only include if display name fuzzy-matches the search name
            if full_name:
                name_lower = name.lower()
                full_lower = full_name.lower()
                # At least one word of the name must appear in keybase display name
                name_words = [w for w in name_lower.split() if len(w) > 2]
                if not any(w in full_lower for w in name_words):
                    continue

            profile_url = f"https://keybase.io/{kb_username}"
            findings.append(Finding(
                connector_name=self.name,
                result_type="social_profile",
                result_value=f"Keybase Profile: {profile_url}",
                confidence=0.8,
                raw_payload={
                    "site": "keybase",
                    "username": kb_username,
                    "display_name": full_name,
                    "profile_url": profile_url,
                    "verified": True,
                }
            ))

            # Extract verified proof accounts — each is a real linked identity
            proofs = components.get("websites", [])
            # GitHub proof
            gh = components.get("github", {})
            if isinstance(gh, dict) and gh.get("val"):
                gh_login = gh["val"]
                findings.append(Finding(
                    connector_name=self.name,
                    result_type="social_profile",
                    result_value=f"GitHub Profile: https://github.com/{gh_login}",
                    confidence=0.95,
                    raw_payload={
                        "site": "github",
                        "username": gh_login,
                        "profile_url": f"https://github.com/{gh_login}",
                        "source": "keybase_proof",
                        "verified": True,
                    }
                ))

            # Twitter proof
            tw = components.get("twitter", {})
            if isinstance(tw, dict) and tw.get("val"):
                tw_handle = tw["val"]
                findings.append(Finding(
                    connector_name=self.name,
                    result_type="social_profile",
                    result_value=f"Twitter/X Profile: https://twitter.com/{tw_handle}",
                    confidence=0.95,
                    raw_payload={
                        "site": "twitter",
                        "username": tw_handle,
                        "profile_url": f"https://twitter.com/{tw_handle}",
                        "source": "keybase_proof",
                        "verified": True,
                    }
                ))

            # Reddit proof
            rd = components.get("reddit", {})
            if isinstance(rd, dict) and rd.get("val"):
                rd_handle = rd["val"]
                findings.append(Finding(
                    connector_name=self.name,
                    result_type="social_profile",
                    result_value=f"Reddit Profile: https://www.reddit.com/user/{rd_handle}",
                    confidence=0.95,
                    raw_payload={
                        "site": "reddit",
                        "username": rd_handle,
                        "profile_url": f"https://www.reddit.com/user/{rd_handle}",
                        "source": "keybase_proof",
                        "verified": True,
                    }
                ))

            # HackerNews proof
            hn = components.get("hackernews", {})
            if isinstance(hn, dict) and hn.get("val"):
                hn_handle = hn["val"]
                findings.append(Finding(
                    connector_name=self.name,
                    result_type="social_profile",
                    result_value=f"HackerNews Profile: https://news.ycombinator.com/user?id={hn_handle}",
                    confidence=0.95,
                    raw_payload={
                        "site": "hackernews",
                        "username": hn_handle,
                        "profile_url": f"https://news.ycombinator.com/user?id={hn_handle}",
                        "source": "keybase_proof",
                        "verified": True,
                    }
                ))

        return findings
