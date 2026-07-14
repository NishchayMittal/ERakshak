import asyncio
import httpx
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

SITES = [
    {
        "name": "GitHub",
        "uri_check": "https://github.com/{account}",
        "e_code": 200
    },
    {
        "name": "Reddit",
        "uri_check": "https://www.reddit.com/user/{account}",
        "e_code": 200
    },
    {
        "name": "Linktree",
        "uri_check": "https://linktr.ee/{account}",
        "e_code": 200
    },
    {
        "name": "DockerHub",
        "uri_check": "https://hub.docker.com/u/{account}",
        "e_code": 200
    },
    {
        "name": "Pinterest",
        "uri_check": "https://www.pinterest.com/{account}/",
        "e_code": 200
    },
    {
        "name": "Steam",
        "uri_check": "https://steamcommunity.com/id/{account}",
        "e_code": 200
    },
    {
        "name": "Archive.org",
        "uri_check": "https://archive.org/details/@{account}",
        "e_code": 200
    },
    {
        "name": "SlideShare",
        "uri_check": "https://www.slideshare.net/{account}",
        "e_code": 200
    },
    {
        "name": "Roblox",
        "uri_check": "https://www.roblox.com/user.aspx?username={account}",
        "e_code": 200
    },
    {
        "name": "Chess.com",
        "uri_check": "https://www.chess.com/member/{account}",
        "e_code": 200
    },
    {
        "name": "Scribd",
        "uri_check": "https://www.scribd.com/{account}",
        "e_code": 200
    },
    {
        "name": "Letterboxd",
        "uri_check": "https://letterboxd.com/{account}/",
        "e_code": 200
    }
]

class UsernameEnumConnector(BaseConnector):
    name = "username_enumeration"
    applies_to = (IdentifierType.username,)
    timeout_seconds = 5.0

    async def check_health(self) -> bool:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.head("https://github.com/", follow_redirects=True)
                return res.status_code == 200
        except Exception:
            return False

    async def run(self, identifier_value: str) -> list[Finding]:
        username = identifier_value.lstrip("@").strip()
        if not username:
            return []

        async def check_site(client: httpx.AsyncClient, site: dict) -> Finding | None:
            url = site["uri_check"].format(account=username)
            # Use headers to look like a browser and avoid bot blockers
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            try:
                response = await client.get(url, headers=headers, timeout=self.timeout_seconds, follow_redirects=True)
                if response.status_code == site["e_code"]:
                    # Basic check for some sites that return 200 but contain "not found" text
                    text = response.text.lower()
                    if "user not found" in text or "page not found" in text or "profile not found" in text:
                        return None
                    return Finding(
                        connector_name=self.name,
                        result_type="social_profile",
                        result_value=f"{site['name']} Profile: {url}",
                        confidence=0.85,
                        raw_payload={
                            "site_name": site["name"],
                            "profile_url": url,
                            "status_code": response.status_code
                        }
                    )
            except Exception:
                pass
            return None

        # Run concurrent checks
        async with httpx.AsyncClient() as client:
            tasks = [check_site(client, site) for site in SITES]
            results = await asyncio.gather(*tasks)
            return [r for r in results if r is not None]
