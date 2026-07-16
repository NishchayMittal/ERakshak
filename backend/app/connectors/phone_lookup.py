import phonenumbers
from phonenumbers import carrier, geocoder, timezone
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

PHONE_TYPE_LABELS = {
    phonenumbers.PhoneNumberType.MOBILE: "Mobile",
    phonenumbers.PhoneNumberType.FIXED_LINE: "Fixed Line",
    phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE: "Fixed Line or Mobile",
    phonenumbers.PhoneNumberType.TOLL_FREE: "Toll Free",
    phonenumbers.PhoneNumberType.PREMIUM_RATE: "Premium Rate",
    phonenumbers.PhoneNumberType.SHARED_COST: "Shared Cost",
    phonenumbers.PhoneNumberType.VOIP: "VoIP",
    phonenumbers.PhoneNumberType.PERSONAL_NUMBER: "Personal Number",
    phonenumbers.PhoneNumberType.PAGER: "Pager",
    phonenumbers.PhoneNumberType.UAN: "UAN",
    phonenumbers.PhoneNumberType.UNKNOWN: "Unknown",
}


class PhoneLookupConnector(BaseConnector):
    name = "phone_lookup"
    applies_to = (IdentifierType.phone,)
    timeout_seconds = 2.0  # offline — instant
    max_retries = 0

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        raw = identifier_value.strip()
        findings: list[Finding] = []

        # Try parsing with IN (India) as default region for numbers without country code
        parsed = None
        for region in (None, "IN", "US"):
            try:
                parsed = phonenumbers.parse(raw, region)
                if phonenumbers.is_possible_number(parsed):
                    break
            except Exception:
                parsed = None

        if not parsed or not phonenumbers.is_possible_number(parsed):
            return []

        is_valid = phonenumbers.is_valid_number(parsed)
        e164 = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        region_code = phonenumbers.region_code_for_number(parsed)
        num_type = phonenumbers.number_type(parsed)
        type_label = PHONE_TYPE_LABELS.get(num_type, "Unknown")

        carrier_name = carrier.name_for_number(parsed, "en") or ""
        geo = geocoder.description_for_number(parsed, "en") or ""
        tzones = timezone.time_zones_for_number(parsed)
        tz_str = ", ".join(tzones) if tzones else ""

        # Validity
        findings.append(Finding(
            connector_name=self.name,
            result_type="phone_valid",
            result_value=f"{'Valid' if is_valid else 'Invalid / Unassigned'} | E.164: {e164}",
            confidence=1.0,
            raw_payload={"e164": e164, "valid": is_valid, "region": region_code}
        ))

        # Type
        findings.append(Finding(
            connector_name=self.name,
            result_type="phone_type",
            result_value=f"{type_label}",
            confidence=1.0,
            raw_payload={"type": type_label, "region": region_code}
        ))

        # Carrier
        if carrier_name:
            findings.append(Finding(
                connector_name=self.name,
                result_type="phone_carrier",
                result_value=carrier_name,
                confidence=0.95,
                raw_payload={"carrier": carrier_name}
            ))

        # Geographic region
        if geo:
            findings.append(Finding(
                connector_name=self.name,
                result_type="phone_geocode",
                result_value=geo,
                confidence=0.95,
                raw_payload={"geocode": geo, "region_code": region_code}
            ))

        # Timezone
        if tz_str:
            findings.append(Finding(
                connector_name=self.name,
                result_type="phone_timezone",
                result_value=tz_str,
                confidence=0.9,
                raw_payload={"timezones": list(tzones)}
            ))

        return findings
