from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

class WhoisConnector(BaseConnector):
    name = "whois_rdap"
    applies_to = (IdentifierType.domain,)
    timeout_seconds = 15.0

    async def check_health(self) -> bool:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.head("https://rdap.org/", follow_redirects=True)
                return res.status_code in {200, 301, 302}
        except Exception:
            return False

    async def run(self, identifier_value: str) -> list[Finding]:
        domain = identifier_value.lstrip("@").strip().lower()
        url = f"https://rdap.org/domain/{domain}"
        
        payload = await self._get_json(url)
        if not isinstance(payload, dict):
            return []

        findings = []

        # 1. Parse Events (Dates)
        events = payload.get("events", [])
        for event in events:
            if not isinstance(event, dict):
                continue
            action = event.get("eventAction")
            date = event.get("eventDate")
            if action and date:
                findings.append(
                    Finding(
                        connector_name=self.name,
                        result_type="domain_event",
                        result_value=f"{action.replace('_', ' ').title()}: {date}",
                        confidence=1.0,
                        raw_payload=event
                    )
                )

        # 2. Parse Nameservers
        nameservers = payload.get("nameservers", [])
        ns_list = []
        for ns in nameservers:
            if isinstance(ns, dict) and ns.get("ldhName"):
                ns_list.append(ns.get("ldhName"))
        if ns_list:
            findings.append(
                Finding(
                    connector_name=self.name,
                    result_type="nameservers",
                    result_value=", ".join(ns_list),
                    confidence=1.0,
                    raw_payload={"nameservers": ns_list}
                )
            )

        # Helper to extract vCard fields
        def extract_vcard_field(vcard, field_name):
            if not isinstance(vcard, list) or len(vcard) < 2:
                return None
            for prop in vcard[1]:
                if isinstance(prop, list) and len(prop) >= 4 and prop[0] == field_name:
                    return prop[3]
            return None

        # 3. Parse Entities (Registrant Info)
        entities = payload.get("entities", [])
        for entity in entities:
            if not isinstance(entity, dict):
                continue
            roles = entity.get("roles", [])
            vcard = entity.get("vcardArray")
            
            if vcard:
                fn = extract_vcard_field(vcard, "fn")
                org = extract_vcard_field(vcard, "org")
                email = extract_vcard_field(vcard, "email")
                tel = extract_vcard_field(vcard, "tel")

                role_str = ", ".join(roles) if roles else "contact"
                
                if fn:
                    findings.append(
                        Finding(
                            connector_name=self.name,
                            result_type="registrant_name",
                            result_value=f"{fn} ({role_str})",
                            confidence=0.9,
                            raw_payload=entity
                        )
                    )
                if org:
                    findings.append(
                        Finding(
                            connector_name=self.name,
                            result_type="registrant_org",
                            result_value=f"{org} ({role_str})",
                            confidence=0.9,
                            raw_payload=entity
                        )
                    )
                if email:
                    findings.append(
                        Finding(
                            connector_name=self.name,
                            result_type="registrant_email",
                            result_value=email, # Raw email is crucial for correlation pivots!
                            confidence=1.0,
                            raw_payload=entity
                        )
                    )
                if tel:
                    findings.append(
                        Finding(
                            connector_name=self.name,
                            result_type="registrant_phone",
                            result_value=tel,
                            confidence=0.9,
                            raw_payload=entity
                        )
                    )

        return findings
