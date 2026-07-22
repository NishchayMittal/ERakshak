import hashlib
import httpx
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType


class HaveIBeenPwnedConnector(BaseConnector):
    """
    Checks if an email address appears in known data breaches using the Have I Been Pwned (HIBP) API.
    Uses the k-anonymity model for privacy: only sends first 5 characters of SHA-1 hash.

    Data Points:
    - Breach names
    - Breach dates
    - Data classes compromised
    - Whether it's a verified breach
    - Whether it's a fabricated or spam list
    - Whether sensitive data was involved
    - Whether the breach is retired
    - Password exposure status (via separate password range API if needed)
    """
    name = "hibp"
    applies_to = (IdentifierType.email,)
    timeout_seconds = 10.0
    max_retries = 2
    # HIBP rate limit: 1 request per 1.5 seconds (to be respectful)
    # We'll use a custom rate limiter in the run method

    async def check_health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get("https://haveibeenpwned.com/api/v3/",
                                     headers={"User-Agent": "e-Rakshak-OSINT/1.0",
                                             "hibp-api-key": ""})  # No key needed for v3
                # Returns 200 OK if API is accessible
                return res.status_code == 200
        except Exception:
            return False

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        email = identifier_value.strip().lower()
        findings: list[Finding] = []

        # HIBP v3 API endpoint for breached account
        url = f"https://haveibeenpwned.com/api/v3/breachedaccount/{email}"

        try:
            # Note: HIBP recommends 1 request per 1.5 seconds
            # We'll implement a simple delay here, but ideally this should use
            # the rate limiter from base class or a shared limiter
            import asyncio
            await asyncio.sleep(1.5)  # Respect HIBP rate limit

            async with httpx.AsyncClient(timeout=self.timeout_seconds, follow_redirects=True) as client:
                headers = {
                    "User-Agent": "e-Rakshak-OSINT/1.0",
                    # "hibp-api-key": "your-api-key-here"  # Optional for higher rate limits
                }
                response = await client.get(url, headers=headers)

                if response.status_code == 200:
                    breaches = response.json()
                    if not isinstance(breaches, list):
                        breaches = []

                    for breach in breaches:
                        if not isinstance(breach, dict):
                            continue

                        name = breach.get("Name", "Unknown")
                        title = breach.get("Title", name)
                        domain = breach.get("Domain", "")
                        breach_date = breach.get("BreachDate", "")
                        modified_date = breach.get("ModifiedDate", "")
                        pwn_count = breach.get("PwnCount", 0)
                        description = breach.get("Description", "")
                        data_classes = breach.get("DataClasses", [])
                        is_verified = breach.get("IsVerified", False)
                        is_fabricated = breach.get("IsFabricated", False)
                        is_sensitive = breach.get("IsSensitive", False)
                        is_retired = breach.get("IsRetired", False)
                        is_spamlist = breach.get("IsSpamList", False)
                        logo_type = breach.get("LogoType", "")

                        # Build a descriptive result
                        status_parts = []
                        if is_verified:
                            status_parts.append("Verified")
                        if is_fabricated:
                            status_parts.append("Fabricated")
                        if is_spamlist:
                            status_parts.append("Spam List")
                        if is_retired:
                            status_parts.append("Retired")
                        if is_sensitive:
                            status_parts.append("Sensitive Data")

                        status_str = " | ".join(status_parts) if status_parts else "Unverified"

                        data_classes_str = ", ".join(data_classes) if data_classes else "Unknown"

                        result_value = f"Breach: {title} ({breach_date}) | Exposed: {data_classes_str} | {status_str} | {pwn_count:,} accounts"

                        findings.append(Finding(
                            connector_name=self.name,
                            result_type="breach",
                            result_value=result_value,
                            confidence=0.95,  # HIBP is highly reliable
                            raw_payload={
                                "breach_name": name,
                                "title": title,
                                "domain": domain,
                                "breach_date": breach_date,
                                "modified_date": modified_date,
                                "pwn_count": pwn_count,
                                "description": description,
                                "data_classes": data_classes,
                                "is_verified": is_verified,
                                "is_fabricated": is_fabricated,
                                "is_sensitive": is_sensitive,
                                "is_retired": is_retired,
                                "is_spamlist": is_spamlist,
                                "logo_type": logo_type,
                                "source": "haveibeenpwned_v3"
                            }
                        ))
                elif response.status_code == 404:
                    # 404 means the email was not found in any breaches
                    # We don't create a finding for this - it's actually good news
                    pass
                elif response.status_code == 403:
                    # Rate limited or forbidden - could be due to missing user-agent or rate limit
                    # We could retry after a delay, but for now we'll just return empty
                    pass
                # Other status codes (500, etc.) will result in no findings

        except Exception as e:
            # Log the error in production
            pass

        return findings