import logging
from urllib.parse import quote_plus

from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

logger = logging.getLogger(__name__)


class CrtShConnector(BaseConnector):
    name = "crtsh"
    applies_to = (IdentifierType.domain,)
    timeout_seconds = 6.0
    max_retries = 0

    async def check_health(self) -> bool:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.head("https://crt.sh/", follow_redirects=True)
                return res.status_code in {200, 301, 302}
        except Exception as e:

            logger.error(f"Unexpected error: {e}", exc_info=True)
            return False

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        import socket
        import asyncio
        
        domain = identifier_value.lstrip("@").strip().lower()
        
        async def verify_host(host: str) -> bool:
            try:
                loop = asyncio.get_event_loop()
                await loop.getaddrinfo(host, None, family=socket.AF_INET)
                return True
            except Exception as e:

                logger.error(f"Unexpected error: {e}", exc_info=True)
                return False

        # Active Brute-Force candidates list
        common_prefixes = ["www", "mail", "api", "admin", "dev", "auth", "support", "blog", "portal", "test", "shop", "status", "git"]
        brute_candidates = [f"{prefix}.{domain}" for prefix in common_prefixes]

        url = f"https://crt.sh/?q=%25.{quote_plus(domain)}&output=json"
        payload = await self._get_json(url)
        
        candidates = []
        seen = set()
        
        if isinstance(payload, list):
            for row in payload:
                if not isinstance(row, dict):
                    continue
                name_value = row.get("name_value")
                if not isinstance(name_value, str):
                    continue
                for candidate in name_value.splitlines():
                    host = candidate.strip().lower().lstrip("*.")
                    if not host or host == domain or not host.endswith(domain):
                        continue
                    if host in seen:
                        continue
                    seen.add(host)
                    candidates.append(host)
        else:
            # Passive API fails: Fallback to checking active brute candidates
            candidates = brute_candidates

        # Verify all candidates concurrently via active DNS resolution
        verification_results = await asyncio.gather(*(verify_host(host) for host in candidates))
        verified_hosts = [host for host, is_valid in zip(candidates, verification_results) if is_valid]

        # Sort alphabetically so results are deterministic
        verified_hosts.sort()

        MAX_SUBDOMAINS = 50
        findings = []
        for host in verified_hosts[:MAX_SUBDOMAINS]:
            findings.append(Finding(
                connector_name=self.name,
                result_type="subdomain",
                result_value=host,
                confidence=0.9,  # High confidence since it is verified alive
                raw_payload={"domain": domain, "resolved": True},
            ))
        return findings