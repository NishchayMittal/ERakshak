import asyncio
import httpx
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

# Each site entry defines:
#   uri_check   - URL template with {account}
#   e_code      - HTTP status of a FOUND user (None = any 2xx)
#   not_found   - body substrings that signal user absence (for 200-always SPAs)
#   api_check   - if True, uses JSON API URL instead of HTML page
#   profile_url - override URL to show the user (when api url differs from profile url)
SITES = [
    {
        "name": "GitHub",
        "uri_check": "https://github.com/{account}",
        "e_code": 200,
        "not_found": [],  # returns 404 for nonexistent
    },
    {
        "name": "Reddit",
        # Use JSON API — always returns 200 but body contains error:404 for missing users
        "uri_check": "https://www.reddit.com/user/{account}/about.json",
        "profile_url": "https://www.reddit.com/user/{account}",
        "e_code": 200,
        "not_found": ['"error": 404', '"error":404', 'doesnt exist', 'does not exist'],
    },
    {
        "name": "Linktree",
        "uri_check": "https://linktr.ee/{account}",
        "e_code": 200,
        "not_found": ["page not found", "doesn't exist", "no user"],
    },
    {
        "name": "DockerHub",
        # Docker Hub API — returns 404 JSON for missing users
        "uri_check": "https://hub.docker.com/v2/users/{account}/",
        "profile_url": "https://hub.docker.com/u/{account}",
        "e_code": 200,
        "not_found": [],  # returns 404 for nonexistent
    },
    {
        "name": "Chess.com",
        # Chess.com has an open REST API — returns 200+JSON or 404
        "uri_check": "https://api.chess.com/pub/player/{account}",
        "profile_url": "https://www.chess.com/member/{account}",
        "e_code": 200,
        "not_found": [],  # returns 404 for nonexistent
    },
    {
        "name": "Letterboxd",
        "uri_check": "https://letterboxd.com/{account}/",
        "e_code": 200,
        "not_found": ["there's no one here", "page not found", "sorry"],
    },
    {
        "name": "Scribd",
        "uri_check": "https://www.scribd.com/{account}",
        "e_code": 200,
        "not_found": ["page not found", "doesn't exist", "sorry, the page"],
    },
]


class UsernameEnumConnector(BaseConnector):
    name = "username_enumeration"
    applies_to = (IdentifierType.username,)
    timeout_seconds = 6.0
    max_retries = 0

    async def check_health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.head("https://github.com/", follow_redirects=True)
                return res.status_code == 200
        except Exception:
            return False

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        username = identifier_value.lstrip("@").strip()
        if not username:
            return []

        # Concurrency limit — 4 simultaneous requests max
        sem = asyncio.Semaphore(4)
        from app.connectors.base import get_limiter_for_connector
        limiter = get_limiter_for_connector(self.name)

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/json,*/*",
        }

        async def check_site(client: httpx.AsyncClient, site: dict) -> Finding | None:
            url = site["uri_check"].format(account=username)
            try:
                async with sem:
                    await limiter.acquire()
                    response = await client.get(
                        url,
                        headers=headers,
                        timeout=self.timeout_seconds,
                        follow_redirects=True
                    )

                # Step 1: if the status code is not the expected found-code, skip
                if response.status_code != site["e_code"]:
                    return None

                # Step 2: check body for known "not found" signals specific to this site
                body_lower = response.text.lower()
                for nf_pattern in site.get("not_found", []):
                    if nf_pattern.lower() in body_lower:
                        return None

                # Step 3: profile page exists — return a verified finding
                # If the site uses a different API URL vs profile URL, use the profile_url
                profile_tpl = site.get("profile_url", site["uri_check"])
                profile_url = profile_tpl.format(account=username)

                return Finding(
                    connector_name=self.name,
                    result_type="social_profile",
                    result_value=f"{site['name']} Profile: {profile_url}",
                    confidence=0.9,
                    raw_payload={
                        "site_name": site["name"],
                        "profile_url": profile_url,
                        "status_code": response.status_code,
                        "verified": True,
                    }
                )
            except Exception:
                return None

        async with httpx.AsyncClient() as client:
            tasks = [check_site(client, site) for site in SITES]
            results = await asyncio.gather(*tasks)
            return [r for r in results if r is not None]
