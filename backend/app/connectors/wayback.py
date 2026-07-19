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

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        domain = identifier_value.lstrip("@").strip().lower()
        url = "https://web.archive.org/cdx/search/cdx"
        params = {
            "url": domain,
            "matchType": "domain",      # official: match all pages under this domain
            "output": "json",
            "limit": "10",
            "collapse": "timestamp:4",  # collapse to one result per year (first 4 digits)
            "fl": "timestamp,original,mimetype,statuscode",
            "filter": "statuscode:200", # only successful snapshots
        }

        payload = await self._get_json(url, params=params)
        findings = []

        # Pathway 1: Parse Wayback results
        if isinstance(payload, list) and len(payload) > 1:
            for row in payload[1:]:
                if not isinstance(row, list) or len(row) < 4:
                    continue
                timestamp, original, mimetype, statuscode = row[0], row[1], row[2], row[3]
                
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

        # Pathway 2: Active robots.txt path extraction
        import httpx
        try:
            async with httpx.AsyncClient(timeout=3.0, follow_redirects=True) as client:
                res = await client.get(f"https://{domain}/robots.txt", headers={"User-Agent": "Mozilla/5.0"})
                if res.status_code == 200:
                    paths = set()
                    for line in res.text.splitlines():
                        if line.lower().startswith(("disallow:", "allow:")):
                            parts = line.split(":", 1)
                            if len(parts) > 1:
                                path = parts[1].strip()
                                if path and not path.startswith(("*", "/*")) and len(path) > 1:
                                    paths.add(path)
                    
                    for p in sorted(list(paths))[:10]:
                        findings.append(
                            Finding(
                                connector_name=self.name,
                                result_type="discovered_path",
                                result_value=f"Active Path: https://{domain}{p}",
                                confidence=0.9,  # High confidence since it is live from the host
                                raw_payload={"domain": domain, "robots_txt": True}
                            )
                        )
        except Exception:
            pass

        return findings
