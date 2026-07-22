import httpx
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType


class BreachLookupConnector(BaseConnector):
    """
    Queries XposedOrNot's Breach Analytics API to retrieve detailed insights
    about compromised email credentials.

    For every exposure, we extract:
      - Breach Name and Target Domain
      - Leak Date/Year
      - Exact Leaked Data Classes (e.g. Passwords, Names, IP addresses)
      - Breach Summary/Context
      - Password Strength Risk (e.g. plaintext, easytocrack, hardtocrack)
    
    This provides rich structured intelligence directly on the suspect dossier.
    """
    name = "breach_lookup"
    applies_to = (IdentifierType.email,)
    timeout_seconds = 10.0
    max_retries = 0

    async def check_health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.head("https://api.xposedornot.com/v1/breach-analytics", headers={"User-Agent": "e-Rakshak-OSINT/1.0"})
                # The endpoint returns 405 or 400 on head/missing args, but server response shows API is alive
                return res.status_code in {200, 400, 405}
        except Exception:
            return False

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        email = identifier_value.strip().lower()
        # Determine domain for MX check
        domain = ""
        if "@" in email:
            domain = email.split("@")[1]
        mx_valid = self._has_mx_record(domain) if domain else False
        # Base confidence
        base_confidence = 1.0
        if domain:
            if mx_valid:
                # Slight boost for valid MX
                base_confidence = min(1.0, base_confidence + 0.02)
            else:
                # Reduce confidence if no MX (but still possibly valid via A record)
                base_confidence *= 0.9
        findings: list[Finding] = []

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds, follow_redirects=True) as client:
                url = f"https://api.xposedornot.com/v1/breach-analytics?email={email}"
                response = await client.get(url, headers={"User-Agent": "e-Rakshak-OSINT/1.0"})

                if response.status_code == 200:
                    data = response.json()

                    exposed_breaches = data.get("ExposedBreaches") or {}
                    if not isinstance(exposed_breaches, dict):
                        exposed_breaches = {}

                    breaches_details = exposed_breaches.get("breaches_details") or []
                    if not isinstance(breaches_details, list):
                        breaches_details = []

                    for b in breaches_details:
                        if not isinstance(b, dict):
                            continue

                        breach_name = b.get("breach") or "Unknown"
                        domain_from_breach = b.get("domain") or ""
                        xposed_data = b.get("xposed_data") or "Unknown"
                        xposed_date = b.get("xposed_date") or "Unknown"
                        details = b.get("details") or ""
                        password_risk = b.get("password_risk") or "unknown"
                        records = b.get("xposed_records") or 0

                        # Semicolons replaced with clean readable commas
                        data_fields = xposed_data.replace(";", ", ")

                        # Pack all details directly into the readable result string
                        result_value = f"Compromised in {breach_name} ({xposed_date}) | Exposed: {data_fields}"

                        findings.append(Finding(
                            connector_name=self.name,
                            result_type="leak_record",
                            result_value=result_value,
                            confidence=base_confidence,
                            raw_payload={
                                "breach": breach_name,
                                "email": email,
                                "domain": domain_from_breach,
                                "xposed_data_raw": xposed_data,
                                "xposed_fields": [f.strip() for f in data_fields.split(",") if f.strip()],
                                "xposed_date": xposed_date,
                                "description": details,
                                "password_risk": password_risk,
                                "exposed_records_count": records,
                                "source": "xposedornot_analytics",
                                "mx_valid": mx_valid
                            }
                        ))
        except Exception:
            pass

        return findings
