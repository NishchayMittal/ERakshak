import hashlib
import httpx
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType


class GravatarEmailConnector(BaseConnector):
    name = "gravatar_email"
    applies_to = (IdentifierType.email,)
    timeout_seconds = 5.0
    max_retries = 1

    # Known email providers that are more likely to have a genuine Gravatar profile
    KNOWN_PROVIDERS = {
        "gmail.com", "googlemail.com",  # Google
        "yahoo.com", "ymail.com", "rocketmail.com",  # Yahoo
        "outlook.com", "hotmail.com", "live.com", "msn.com",  # Microsoft
        "icloud.com", "me.com", "mac.com",  # Apple
        "protonmail.com", "protonmail.ch",  # ProtonMail
        "zoho.com",  # Zoho Mail
        "gmx.com", "gmx.net",  # GMX
    }

    async def check_health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.head("https://en.gravatar.com/", follow_redirects=True)
                return res.status_code in {200, 301, 302}
        except Exception:
            return False

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        email = identifier_value.strip().lower()
        if "@" not in email:
            return []
        domain = email.split("@")[1]
        md5 = hashlib.md5(email.encode('utf-8')).hexdigest()
        url = f"https://en.gravatar.com/{md5}.json"

        payload = await self._get_json(url)
        if not isinstance(payload, dict) or "entry" not in payload:
            return []

        entries = payload.get("entry") or []
        if not entries or not isinstance(entries, list):
            return []

        entry = entries[0]
        display_name = entry.get("displayName") or ""
        profile_url = entry.get("profileUrl") or ""
        about_me = entry.get("aboutMe") or ""
        thumbnail_url = entry.get("thumbnailUrl") or ""
        accounts = entry.get("accounts") or []

        account_names = []
        for acct in accounts:
            if isinstance(acct, dict) and acct.get("shortname"):
                account_names.append(acct.get("shortname"))

        accounts_str = f" | Linked: {', '.join(account_names)}" if account_names else ""
        result_val = f"Gravatar Profile: {display_name} ({profile_url}){accounts_str}"
        if about_me:
            result_val += f" | Bio: {about_me}"

        # Base confidence
        confidence = 0.8
        # Boost for known email providers
        if domain in self.KNOWN_PROVIDERS:
            confidence += 0.05
        # Boost for having a display name
        if display_name:
            confidence += 0.05
        # Boost for having a profile URL
        if profile_url:
            confidence += 0.05
        # Cap at 1.0
        confidence = min(1.0, confidence)

        findings = [Finding(
            connector_name=self.name,
            result_type="social_profile",
            result_value=result_val,
            confidence=confidence,
            raw_payload={
                "site": "gravatar",
                "email": email,
                "display_name": display_name,
                "profile_url": profile_url,
                "about_me": about_me,
                "thumbnail_url": thumbnail_url,
                "verified_accounts": accounts,
            }
        )]
        return findings