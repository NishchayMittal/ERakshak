from urllib.parse import quote_plus

from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType


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
        except Exception:
            return False

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        domain = identifier_value.lstrip("@").strip().lower()
        url = f"https://crt.sh/?q=%25.{quote_plus(domain)}&output=json"
        payload = await self._get_json(url)
        if not isinstance(payload, list):
            return []

        MAX_SUBDOMAINS = 50   # cap to avoid flooding the graph
        seen: set[str] = set()
        candidates: list[str] = []

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

        # Sort alphabetically so results are deterministic and meaningful
        candidates.sort()

        findings: list[Finding] = []
        for host in candidates[:MAX_SUBDOMAINS]:
            findings.append(Finding(
                connector_name=self.name,
                result_type="subdomain",
                result_value=host,
                confidence=0.7,
                raw_payload={"domain": domain},
            ))
        return findings