import re

import phonenumbers

from app.models import IdentifierType


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DOMAIN_RE = re.compile(r"^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$")
USERNAME_RE = re.compile(r"^@?[A-Za-z0-9_.]{3,64}$")
ETH_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
BTC_RE = re.compile(r"^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$")
IP_RE = re.compile(r"^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$")


def detect_type(raw_value: str) -> IdentifierType:
    value = raw_value.strip()
    lower_val = value.lower()
    if lower_val.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")) or "suspect_" in lower_val:
        return IdentifierType.photo

    if EMAIL_RE.match(value):
        return IdentifierType.email

    if IP_RE.match(value):
        return IdentifierType.ip

    try:
        parsed = phonenumbers.parse(value, "IN")
        if phonenumbers.is_possible_number(parsed) and phonenumbers.is_valid_number(parsed):
            return IdentifierType.phone
    except phonenumbers.NumberParseException:
        pass

    if ETH_RE.match(value) or BTC_RE.match(value):
        return IdentifierType.wallet

    if DOMAIN_RE.match(value):
        return IdentifierType.domain

    if USERNAME_RE.match(value):
        return IdentifierType.username

    if " " in value and any(char.isalpha() for char in value):
        return IdentifierType.name

    return IdentifierType.other


def normalize(raw_value: str, id_type: IdentifierType) -> str:
    value = raw_value.strip()
    if id_type in {IdentifierType.email, IdentifierType.domain, IdentifierType.username}:
        return value.lower().lstrip("@") if id_type == IdentifierType.username else value.lower()

    if id_type == IdentifierType.ip:
        return value.strip()

    if id_type == IdentifierType.phone:
        parsed = phonenumbers.parse(value, "IN")
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)

    if id_type == IdentifierType.photo:
        val = value.replace("\\", "/").strip("/")
        return val

    if id_type == IdentifierType.name:
        from anyascii import anyascii
        return anyascii(value).lower().strip()

    # Transliterate any other fallback values
    from anyascii import anyascii
    return anyascii(value)