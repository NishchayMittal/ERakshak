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
        
    # 2. Duplicate removal: group by (connector_name, result_type, result_value)
    # and keep the one with the highest confidence score.
    deduped_map: dict[tuple[str, str, str], Finding] = {}
    for pf in processed_findings:
        key = (pf.connector_name, pf.result_type, pf.result_value)
        if key in deduped_map:
            if pf.confidence > deduped_map[key].confidence:
                deduped_map[key] = pf
        else:
            deduped_map[key] = pf
            
    return list(deduped_map.values())


def extract_identifier_from_finding(finding: Finding) -> tuple[IdentifierType, str] | None:
    """
    Extracts a valid IdentifierType and value from a Finding if it represents a potential pivot.
    Returns None if the finding is not high-confidence or doesn't map to a valid identifier.
    """
    result_type = finding.result_type
    val = finding.result_value
    
    # 1. Map explicit result types
    if result_type == "registrant_email":
        return IdentifierType.email, val
        
    elif result_type == "registrant_phone":
        return IdentifierType.phone, val
        
    elif result_type == "registrant_name":
        # WHOIS name e.g. "john doe (registrant)" -> extract "john doe"
        name = val.split(" (")[0].strip()
        if name:
            return IdentifierType.name, name
            
    elif result_type == "face_similarity":
        # Extract suspect name. If in payload, use that.
        name = None
        if finding.raw_payload and isinstance(finding.raw_payload, dict):
            name = finding.raw_payload.get("suspect_name")
        if not name:
            # e.g., "match: suspect alpha (developer profile) (similarity: 92.5%)"
            cleaned_val = val
            if cleaned_val.startswith("match: "):
                cleaned_val = cleaned_val[7:]
            name = cleaned_val.split(" (similarity:")[0].split(" (")[0].strip()
        if name:
            return IdentifierType.name, name
            
    elif result_type == "subdomain":
        return IdentifierType.domain, clean_domain(val)
        
    # 2. Fallback check using detect_type on result_value
    detected = detect_type(val)
    if detected not in (IdentifierType.other, IdentifierType.photo):
        return detected, val
        
    return None
