from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

# Roles that belong to the domain owner or technical operator — worth pivoting on
RELEVANT_ROLES = {"registrant", "technical", "administrative", "billing"}
# Roles that belong to infrastructure/registry — label them but don't pivot on contact details
INFRASTRUCTURE_ROLES = {"registrar", "abuse", "reseller", "sponsor", "proxy", "notifications"}


class WhoisConnector(BaseConnector):
    name = "whois_rdap"
    applies_to = (IdentifierType.domain,)
    timeout_seconds = 6.0

    async def check_health(self) -> bool:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.head("https://rdap.org/", follow_redirects=True)
                return res.status_code in {200, 301, 302}
        except Exception:
            return False

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        domain = identifier_value.lstrip("@").strip().lower()
        url = f"https://rdap.org/domain/{domain}"
        payload = await self._get_json(url)
        if not isinstance(payload, dict):
            return []

        findings = []

        # 1. Registration Events (dates) — always relevant
        for event in payload.get("events", []):
            if not isinstance(event, dict):
                continue
            action = event.get("eventAction", "")
            date = (event.get("eventDate") or "")[:10]   # date only, strip time
            # Skip low-signal "last update of RDAP database" events
            if action and date and "rdap" not in action.lower():
                findings.append(Finding(
                    connector_name=self.name,
                    result_type="domain_event",
                    result_value=f"{action.replace('_', ' ').title()}: {date}",
                    confidence=1.0,
                    raw_payload=event
                ))

        # 2. Nameservers — always relevant, reveal hosting infrastructure
        ns_list = [
            ns["ldhName"].lower()
            for ns in payload.get("nameservers", [])
            if isinstance(ns, dict) and ns.get("ldhName")
        ]
        if ns_list:
            findings.append(Finding(
                connector_name=self.name,
                result_type="nameservers",
                result_value=", ".join(ns_list),
                confidence=1.0,
                raw_payload={"nameservers": ns_list}
            ))

        # Helper: extract a single vCard field value
        def vcard_field(vcard, field_name):
            if not isinstance(vcard, list) or len(vcard) < 2:
                return None
            for prop in vcard[1]:
                if isinstance(prop, list) and len(prop) >= 4 and prop[0] == field_name:
                    val = prop[3]
                    # Strip tel: URI prefix
                    if field_name == "tel" and isinstance(val, str):
                        val = val.replace("tel:", "").replace("Tel:", "")
                    return val
            return None

        # Filter for GDPR-redacted / privacy placeholder values
        REDACTED_SIGNALS = ("redacted", "privacy", "select contact", "masked", "not disclosed")
        def is_redacted(val: str) -> bool:
            return any(sig in val.lower() for sig in REDACTED_SIGNALS)

        # 3. Entity parsing — ROLE-AWARE
        def parse_entity(entity, depth=0):
            if not isinstance(entity, dict):
                return
            roles = {r.lower() for r in entity.get("roles", [])}
            vcard = entity.get("vcardArray")

            entity_is_relevant    = bool(roles & RELEVANT_ROLES)
            entity_is_infra       = bool(roles & INFRASTRUCTURE_ROLES)

            if vcard:
                fn    = vcard_field(vcard, "fn")
                org   = vcard_field(vcard, "org")
                email = vcard_field(vcard, "email")
                tel   = vcard_field(vcard, "tel")
                role_label = ", ".join(sorted(roles)) if roles else "contact"

                if entity_is_infra and not entity_is_relevant:
                    # For registrar entities: only record the registrar NAME as metadata,
                    # NOT the abuse email/phone (those belong to MarkMonitor, not the domain owner)
                    if fn and not is_redacted(fn) and "registrar" in roles:
                        findings.append(Finding(
                            connector_name=self.name,
                            result_type="registrar",
                            result_value=fn.strip(),
                            confidence=1.0,
                            raw_payload={"role": "registrar"}
                        ))
                    # Completely skip abuse sub-entities — they're the registrar's own contacts
                    # Do not recurse into abuse sub-entities
                    if "abuse" in roles:
                        return
                    # For non-abuse infra entities, still recurse in case there's a
                    # relevant sub-entity (some registries nest technical contacts)
                    for sub in entity.get("entities", []):
                        parse_entity(sub, depth + 1)
                    return

                # Relevant entity (registrant / technical / administrative / billing)
                if fn and not is_redacted(fn):
                    findings.append(Finding(
                        connector_name=self.name,
                        result_type="registrant_name",
                        result_value=f"{fn.strip()} ({role_label})",
                        confidence=0.95,
                        raw_payload={"role": role_label}
                    ))
                if org and not is_redacted(org):
                    findings.append(Finding(
                        connector_name=self.name,
                        result_type="registrant_org",
                        result_value=f"{org.strip()} ({role_label})",
                        confidence=0.95,
                        raw_payload={"role": role_label}
                    ))
                if email and not is_redacted(email):
                    findings.append(Finding(
                        connector_name=self.name,
                        result_type="registrant_email",
                        result_value=email.strip().lower(),
                        confidence=1.0,
                        raw_payload={"role": role_label}
                    ))
                if tel and not is_redacted(tel):
                    findings.append(Finding(
                        connector_name=self.name,
                        result_type="registrant_phone",
                        result_value=tel.strip(),
                        confidence=0.95,
                        raw_payload={"role": role_label}
                    ))

            # Recurse into sub-entities
            for sub in entity.get("entities", []):
                parse_entity(sub, depth + 1)

        for entity in payload.get("entities", []):
            parse_entity(entity)

        return findings
