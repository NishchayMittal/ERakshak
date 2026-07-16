from datetime import datetime
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

class WaybackConnector(BaseConnector):
    name = "wayback_cdx"
    applies_to = (IdentifierType.domain,)
    timeout_seconds = 6.0

    async def check_health(self) -> bool:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.head("https://web.archive.org/", follow_redirects=True)
                return res.status_code in {200, 301, 302}
        except Exception:
            return False

    async def run(self, identifier_value: str) -> list[Finding]:
        domain = identifier_value.lstrip("@").strip().lower()
        url = "https://web.archive.org/cdx/search/cdx"
        params = {
            "url": domain,
            "output": "json",
            "limit": "10",
            "fl": "timestamp,original,mimetype,statuscode"
        }

        payload = await self._get_json(url, params=params)
        if not isinstance(payload, list) or len(payload) <= 1:
            return []

        findings = []
        # First row is headers: ["timestamp", "original", "mimetype", "statuscode"]
        for row in payload[1:]:
            if not isinstance(row, list) or len(row) < 4:
                continue
            timestamp, original, mimetype, statuscode = row[0], row[1], row[2], row[3]
            
            # Format timestamp to readable date: yyyyMMddhhmmss -> yyyy-MM-dd hh:mm:ss
            formatted_date = timestamp
            try:
                dt = datetime.strptime(timestamp, "%Y%m%d%H%M%S")
                formatted_date = dt.strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                pass

            archive_url = f"https://web.archive.org/web/{timestamp}/{original}"

            findings.append(
                Finding(
                    connector_name=self.name,
                    result_type="archived_page",
                    result_value=f"Snapshot ({formatted_date}): {original} [{statuscode}]",
                    confidence=1.0,
                    raw_payload={
                        "timestamp": timestamp,
                        "original_url": original,
                        "mimetype": mimetype,
                        "statuscode": statuscode,
                        "archive_url": archive_url
                    }
                )
            )

        return findings
