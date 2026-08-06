import logging
import asyncio
import httpx
from app.connectors.base import BaseConnector, Finding, get_limiter_for_connector
from app.models import IdentifierType

logger = logging.getLogger(__name__)

class BucketEnumConnector(BaseConnector):
    name = "bucket_enum"
    applies_to = (IdentifierType.domain, IdentifierType.username)
    
    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        base_name = identifier_value.split(".")[0] if identifier_value.count(".") > 0 else identifier_value
        base_name = base_name.replace(" ", "").lower()
        
        permutations = [
            base_name,
            f"{base_name}-backup",
            f"{base_name}-data",
            f"{base_name}-assets",
            f"{base_name}-public",
        ]
        
        urls_to_check = []
        for p in permutations:
            urls_to_check.extend([
                f"https://{p}.s3.amazonaws.com",
                f"https://storage.googleapis.com/{p}"
            ])
            
        findings = []
        timeout = httpx.Timeout(5.0)
        limiter = get_limiter_for_connector(self.name)
        
        async def check_url(url: str):
            try:
                await limiter.acquire()
                async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                    resp = await client.head(url)
                    if resp.status_code in (200, 403):
                        findings.append(Finding(
                            connector_name=self.name,
                            result_type="cloud_bucket",
                            result_value=url,
                            confidence=0.9,
                            raw_payload={"status_code": resp.status_code, "url": url}
                        ))
            except Exception as e:

                logger.warning(f"Silenced exception: {e}", exc_info=True)
                
        await asyncio.gather(*(check_url(u) for u in urls_to_check))
        return findings
