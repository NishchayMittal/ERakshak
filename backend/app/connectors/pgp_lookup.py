import logging
import httpx
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

logger = logging.getLogger(__name__)


class PgpLookupConnector(BaseConnector):
    name = "pgp_lookup"
    applies_to = (IdentifierType.email,)
    timeout_seconds = 6.0
    max_retries = 1

    async def check_health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.head("https://keys.openpgp.org/", follow_redirects=True)
                return res.status_code in {200, 301, 302}
        except Exception as e:

            logger.error(f"Unexpected error: {e}", exc_info=True)
            return False

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        email = identifier_value.strip().lower()
        url = f"https://keys.openpgp.org/vks/v1/by-email/{email}"
        
        from app.connectors.base import get_limiter_for_connector
        limiter = get_limiter_for_connector(self.name)
        await limiter.acquire()

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds, follow_redirects=True) as client:
                res = await client.get(url)
                if res.status_code == 200 and "-----BEGIN PGP PUBLIC KEY BLOCK-----" in res.text:
                    lines = res.text.splitlines()
                    key_version = "Unknown"
                    for line in lines:
                        if line.startswith("Version:"):
                            key_version = line.split(":", 1)[1].strip()
                            break

                    result_val = f"PGP Public Key Found (Server: keys.openpgp.org) | Version: {key_version}"
                    return [Finding(
                        connector_name=self.name,
                        result_type="pgp_key",
                        result_value=result_val,
                        confidence=0.9,
                        raw_payload={
                            "email": email,
                            "server": "keys.openpgp.org",
                            "key_block": res.text,
                            "key_version": key_version
                        }
                    )]
        except Exception as e:

            logger.warning(f"Silenced exception: {e}", exc_info=True)
        return []
