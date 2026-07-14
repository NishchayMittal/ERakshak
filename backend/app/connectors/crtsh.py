from urllib.parse import quote_plus

from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType


class CrtShConnector(BaseConnector):
    name = "crtsh"
    applies_to = (IdentifierType.domain,)
    timeout_seconds = 20.0
    max_retries = 2

    async def run(self, identifier_value: str) -> list[Finding]:
        domain = identifier_value.lstrip("@")
        url = f"https://crt.sh/?q=%25.{quote_plus(domain)}&output=json"
        payload = await self._get_json(url)
        if not isinstance(payload, list):
            return []

        seen: set[str] = set()
        findings: list[Finding] = []
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
                findings.append(
                    Finding(
                        connector_name=self.name,
                        result_type="subdomain",
                        result_value=host,
                        confidence=0.7,
                        raw_payload=row,
                    )
                )
        return findings