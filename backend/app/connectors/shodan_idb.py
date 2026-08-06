import logging
import httpx
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

logger = logging.getLogger(__name__)


class ShodanIdbConnector(BaseConnector):
    name = "shodan_idb"
    applies_to = (IdentifierType.ip,)
    timeout_seconds = 5.0
    max_retries = 1

    async def check_health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.head("https://internetdb.shodan.io/8.8.8.8", follow_redirects=True)
                return res.status_code in {200, 404}
        except Exception as e:

            logger.error(f"Unexpected error: {e}", exc_info=True)
            return False

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        ip = identifier_value.strip()
        url = f"https://internetdb.shodan.io/{ip}"
        
        payload = await self._get_json(url)
        if not isinstance(payload, dict):
            return []

        ports = payload.get("ports") or []
        cpes = payload.get("cpes") or []
        hostnames = payload.get("hostnames") or []
        vulns = payload.get("vulns") or []
        tags = payload.get("tags") or []

        ports_str = ", ".join(map(str, sorted(ports))) if ports else "None"
        hostnames_str = ", ".join(hostnames) if hostnames else "None"
        vulns_str = ", ".join(vulns) if vulns else "None"

        result_val = f"Open Ports: {ports_str} | Hostnames: {hostnames_str} | CVEs: {vulns_str}"

        return [Finding(
            connector_name=self.name,
            result_type="ports_vulns",
            result_value=result_val,
            confidence=0.95,
            raw_payload={
                "ip": ip,
                "ports": ports,
                "cpes": cpes,
                "hostnames": hostnames,
                "vulns": vulns,
                "tags": tags
            }
        )]
