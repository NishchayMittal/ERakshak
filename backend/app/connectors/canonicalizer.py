import re
from urllib.parse import urlparse
import phonenumbers
from anyascii import anyascii

from app.connectors.base import Finding
from app.models import IdentifierType
from app.normalize import detect_type, normalize


def clean_domain(value: str) -> str:
    """
    Cleans a domain or subdomain value by:
    - Lowercasing
    - Stripping protocols (http://, https://)
    - Stripping www.
    - Stripping trailing slash and path
    """
    val = value.strip().lower()
    if "://" in val:
        # Parse URL
        try:
            parsed = urlparse(val)
            val = parsed.netloc or parsed.path
        except Exception:
            pass
    
    # Remove protocol prefix manually if urlparse didn't handle it
    val = re.sub(r'^https?://', '', val)
    # Remove path/query suffix
    val = val.split('/')[0].split('?')[0]
    # Remove www.
    if val.startswith("www."):
        val = val[4:]
    # Remove port if present
    val = val.split(':')[0]
    return val.strip()


def canonicalize_findings(findings: list[Finding]) -> list[Finding]:
    """
    Processes and canonicalizes a list of raw connector findings:
    - Standardizes domain findings (domain-stripping, lowercase)
    - Standardizes emails (lowercase)
    - Normalizes phone numbers (E.164 via phonenumbers)
    - Transliterates names (anyascii, lowercase, trimmed)
    - Removes duplicates from identical source types, keeping the highest confidence finding.
    """
    processed_findings: list[Finding] = []
    
    for f in findings:
        connector_name = f.connector_name
        result_type = f.result_type
        result_value = f.result_value
        confidence = f.confidence
        raw_payload = f.raw_payload
        
        # 1. Apply canonicalization logic based on result_type
        if result_type in ("subdomain", "domain"):
            result_value = clean_domain(result_value)
            
        elif result_type == "registrant_email":
            result_value = result_value.strip().lower()
            
        elif result_type == "registrant_phone":
            val = result_value.strip()
            # Remove common prefixes like tel:
            if val.startswith("tel:"):
                val = val[4:]
            try:
                parsed = phonenumbers.parse(val, "IN")
                if phonenumbers.is_possible_number(parsed) and phonenumbers.is_valid_number(parsed):
                    result_value = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
            except Exception:
                # If parsing fails, fall back to removing non-numeric chars except leading +
                result_value = re.sub(r'[^\d+]', '', val)
                
        elif result_type in ("registrant_name", "registrant_org"):
            # Romanize using anyascii and convert to lowercase/strip
            result_value = anyascii(result_value).strip().lower()
            
        elif result_type == "face_similarity":
            # Example value: "Match: Suspect Alpha (Developer Profile) (Similarity: 92.5%)"
            # Romanize the result value
            result_value = anyascii(result_value).strip().lower()
            
        elif result_type == "social_profile":
            # Lowercase the entire profile link or username part
            result_value = result_value.strip().lower()
            
        else:
            # Fallback Romanization
            result_value = anyascii(result_value).strip().lower()
            
        # Update raw payload if applicable
        processed_findings.append(
            Finding(
                connector_name=connector_name,
                result_type=result_type,
                result_value=result_value,
                confidence=confidence,
                raw_payload=raw_payload
            )
        )
        
    # --- Result Confidence Scoring (Post-Processing) ---
    # Apply context scoring to individual findings
    for pf in processed_findings:
        connector = pf.connector_name
        rtype = pf.result_type
        rval = pf.result_value
        payload = pf.raw_payload or {}

        # GitHub Profile boost
        if "github.com" in rval or (isinstance(payload, dict) and payload.get("site") == "github"):
            repos = payload.get("public_repos") or len(payload.get("repos", []))
            followers = payload.get("followers", 0)
            if repos > 0 or followers > 0:
                pf.confidence = min(1.0, pf.confidence + 0.1)

    # Count breach lookup exposures
    breach_findings = [f for f in processed_findings if f.connector_name == "breach_lookup"]
    if len(breach_findings) > 5:
        for f in breach_findings:
            f.confidence = 1.0  # Flag high risk

    # 2. Global cross-connector duplicate removal: group by (result_type, result_value)
    # and keep the one with the highest confidence score, merging sources and payloads.
    deduped_map: dict[tuple[str, str], Finding] = {}
    for pf in processed_findings:
        key = (pf.result_type, pf.result_value)
        if key in deduped_map:
            existing = deduped_map[key]
            # Merge connector names
            connectors = set(existing.connector_name.split(", "))
            connectors.add(pf.connector_name)
            existing.connector_name = ", ".join(sorted(connectors))
            # Keep max confidence
            existing.confidence = max(existing.confidence, pf.confidence)
            # Merge payloads
            if pf.raw_payload:
                if not existing.raw_payload:
                    existing.raw_payload = {}
                existing.raw_payload = {**existing.raw_payload, **pf.raw_payload}
        else:
            deduped_map[key] = pf
            
    return list(deduped_map.values())


def is_public_ip(ip: str) -> bool:
    """Checks if an IPv4 address is a valid public IP."""
    try:
        parts = list(map(int, ip.split('.')))
        if len(parts) != 4:
            return False
        # Private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16
        if parts[0] == 10:
            return False
        if parts[0] == 172 and (16 <= parts[1] <= 31):
            return False
        if parts[0] == 192 and parts[1] == 168:
            return False
        if parts[0] == 127:
            return False
        if parts[0] == 169 and parts[1] == 254:
            return False
        if parts[0] >= 224:
            return False
        return True
    except Exception:
        return False


import json

def extract_identifier_from_finding(finding: Finding) -> tuple[IdentifierType, str] | None:
    """
    Extracts a valid IdentifierType and value from a Finding if it represents a potential pivot.
    Returns None if the finding is not high-confidence or doesn't map to a valid identifier.
    """
    result_type = finding.result_type
    val = finding.result_value
    payload = finding.raw_payload or {}
    
    # Text to search for identifiers (includes result value and raw json payload)
    search_text = f"{val} {json.dumps(payload) if isinstance(payload, (dict, list)) else str(payload)}"
    
    # 1. Look for IP A-records first to trigger IP pivots
    if result_type == "dns_a_record":
        ips = [ip.strip() for ip in val.split(",") if ip.strip()]
        for ip in ips:
            if is_public_ip(ip):
                return IdentifierType.ip, ip

    # 1b. Look for general IPv4 matches (excluding private/loopback)
    ip_matches = re.findall(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b', search_text)
    if ip_matches:
        for ip in ip_matches:
            if is_public_ip(ip):
                return IdentifierType.ip, ip

    # 2. Look for email addresses in the finding text/payload
    email_matches = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', search_text)
    if email_matches:
        return IdentifierType.email, email_matches[0].strip().lower()
        
    # 3. Look for phone numbers in E.164-like format (e.g., +919876543210)
    if "wayback" not in finding.connector_name.lower():
        phone_matches = re.findall(r'\+?[1-9]\d{9,14}', search_text)
        if phone_matches:
            val_match = phone_matches[0].strip()
            # Exclude year/timestamp prefixes like 1999... or 2005...
            if not (len(val_match) >= 12 and (val_match.startswith("19") or val_match.startswith("20"))):
                return IdentifierType.phone, val_match
            
    # 4. Check raw_payload for a direct username field
    if isinstance(payload, dict) and payload.get("username"):
        uname = str(payload["username"]).strip().lstrip("@")
        if uname and len(uname) >= 2:
            return IdentifierType.username, uname

    # 4b. Check for commit_email findings → pivot to email
    if result_type == "commit_email" and isinstance(payload, dict):
        email = payload.get("email", "")
        if email and "@" in email:
            return IdentifierType.email, email.strip().lower()

    # 5. Look for profile links to extract usernames
    profile_matches = re.findall(
        r'https?://(?:www\.)?(?:'
        r'github\.com'
        r'|reddit\.com/user'
        r'|twitter\.com'
        r'|instagram\.com'
        r'|news\.ycombinator\.com/user\?id='
        r')/([a-zA-Z0-9_.-]+)',
        search_text, re.IGNORECASE
    )
    if profile_matches:
        username = profile_matches[0].split('/')[0].split('?')[0].strip()
        if username and len(username) >= 2:
            return IdentifierType.username, username

    # 6. Map explicit result types
    if result_type == "registrant_email":
        return IdentifierType.email, val.strip().lower()

    elif result_type == "registrant_phone":
        return IdentifierType.phone, val.strip()

    elif result_type == "registrant_name":
        name = val.split(" (")[0].strip()
        if name and "profile" not in name.lower() and "leak" not in name.lower():
            return IdentifierType.name, name

    elif result_type == "face_similarity":
        name = None
        if isinstance(payload, dict):
            name = payload.get("suspect_name")
        if not name:
            cleaned_val = val
            if cleaned_val.startswith("match: "):
                cleaned_val = cleaned_val[7:]
            name = cleaned_val.split(" (similarity:")[0].split(" (")[0].strip()
        if name and "profile" not in name.lower() and "leak" not in name.lower():
            return IdentifierType.name, name

    elif result_type == "subdomain":
        return IdentifierType.domain, clean_domain(val)

    elif result_type == "wikipedia_entry":
        # Extract the Wikipedia page URL as a domain for further pivoting
        if isinstance(payload, dict):
            page_url = payload.get("page_url", "")
            if page_url:
                # Extract domain from URL
                domain_match = re.search(r'https?://([^/]+)', page_url)
                if domain_match:
                    return IdentifierType.domain, domain_match.group(1)
        return None

    return None
