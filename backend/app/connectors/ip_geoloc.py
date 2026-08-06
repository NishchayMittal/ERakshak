import logging
import httpx
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

logger = logging.getLogger(__name__)


class IpGeolocConnector(BaseConnector):
    name = "ip_geoloc"
    applies_to = (IdentifierType.ip,)
    timeout_seconds = 6.0
    max_retries = 1

    async def check_health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.head("http://ip-api.com/json/8.8.8.8", follow_redirects=True)
                return res.status_code in {200, 301, 302}
        except Exception as e:

            logger.error(f"Unexpected error: {e}", exc_info=True)
            return False

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        ip = identifier_value.strip()
        url = f"http://ip-api.com/json/{ip}"
        
        payload = await self._get_json(url)
        if not isinstance(payload, dict) or payload.get("status") != "success":
            return []

        country = payload.get("country") or "Unknown"
        region = payload.get("regionName") or "Unknown"
        city = payload.get("city") or "Unknown"
        isp = payload.get("isp") or "Unknown"
        org = payload.get("org") or "Unknown"
        as_num = payload.get("as") or "Unknown"
        lat = payload.get("lat") or 0.0
        lon = payload.get("lon") or 0.0

        result_val = f"Location: {city}, {region}, {country} | ISP: {isp} (Org: {org}) [AS: {as_num}]"

        return [Finding(
            connector_name=self.name,
            result_type="ip_geolocation",
            result_value=result_val,
            confidence=0.9,
            raw_payload={
                "country": country,
                "region": region,
                "city": city,
                "isp": isp,
                "org": org,
                "as": as_num,
                "latitude": lat,
                "longitude": lon,
                "ip": ip,
            }
        )]
