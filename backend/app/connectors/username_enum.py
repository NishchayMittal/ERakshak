import asyncio
import httpx
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

# High-value OSINT targets only. Low value / noisy sites have been removed to pinpoint identity.
SITES = [
    {
        "name": "GitHub",
        "uri_check": "https://github.com/{account}",
        "e_code": 200,
        "not_found": [],  # returns 404 for nonexistent
    },
    {
        "name": "Reddit",
        "uri_check": "https://www.reddit.com/user/{account}/about.json",
        "profile_url": "https://www.reddit.com/user/{account}",
        "e_code": 200,
        "not_found": ['"error": 404', '"error":404', 'doesnt exist', 'does not exist'],
    },
    {
        "name": "Keybase",
        "uri_check": "https://keybase.io/_/api/1.0/user/lookup.json?usernames={account}",
        "profile_url": "https://keybase.io/{account}",
        "e_code": 200,
        "not_found": ['"them": []', '"them": [null]'], 
    },
    {
        "name": "Patreon",
        "uri_check": "https://www.patreon.com/{account}",
        "e_code": 200,
        "not_found": [],  # returns 404 for nonexistent
    },
    {
        "name": "Gravatar",
        "uri_check": "https://en.gravatar.com/{account}.json",
        "profile_url": "https://en.gravatar.com/{account}",
        "e_code": 200,
        "not_found": ['user not found'],  # returns 404
    },
    {
        "name": "Linktree",
        "uri_check": "https://linktr.ee/{account}",
        "e_code": 200,
        "not_found": ["page not found", "doesn't exist", "no user"],
    },
    {
        "name": "Instagram",
        "uri_check": "https://imginn.com/{account}/",
        "profile_url": "https://instagram.com/{account}",
        "e_code": 200,
        "not_found": [],  # returns 410 or 404 for nonexistent
    }
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
        if not username or len(username) < 3:
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

                if response.status_code != site["e_code"]:
                    return None

                body_lower = response.text.lower()
                for nf_pattern in site.get("not_found", []):
                    if nf_pattern.lower() in body_lower:
                        return None

                # Additional specific checks
                if site["name"] == "Keybase":
                    import json
                    d = response.json()
                    them = d.get("them", [])
                    if not them or them[0] is None:
                        return None

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
