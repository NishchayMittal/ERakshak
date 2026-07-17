import dns.resolver
import dns.exception
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType


class DnsResolverConnector(BaseConnector):
    """
    Resolves DNS records for a domain to reveal infrastructure intelligence:
    - A / AAAA: Hosting IP addresses (can pivot to IP geolocation later)
    - MX: Email provider (Google Workspace, Zoho, ProtonMail, etc.)
    - TXT: SPF records reveal third-party services (Mailgun, SendGrid, Salesforce)
    - CNAME: CDN / SaaS providers (Cloudflare, Shopify, Vercel)
    - NS: Authoritative nameservers (DNS hosting provider)

    Fully offline using the system DNS resolver — zero API calls, instant.
    """
    name = "dns_resolver"
    applies_to = (IdentifierType.domain,)
    timeout_seconds = 5.0
    max_retries = 0

    # Well-known MX provider mappings for human-readable labels
    MX_PROVIDERS = {
        "google": "Google Workspace",
        "googlemail": "Google Workspace",
        "outlook": "Microsoft 365",
        "office365": "Microsoft 365",
        "protection.outlook": "Microsoft 365",
        "zoho": "Zoho Mail",
        "protonmail": "ProtonMail",
        "pphosted": "Proofpoint",
        "mimecast": "Mimecast",
        "messagelabs": "Symantec Email Security",
        "secureserver": "GoDaddy",
        "yahoodns": "Yahoo Mail",
        "mailgun": "Mailgun (Transactional)",
        "sendgrid": "SendGrid (Transactional)",
        "amazonaws": "Amazon SES",
        "icloud": "Apple iCloud Mail",
    }

    # Well-known SPF include services
    SPF_SERVICES = {
        "_spf.google.com": "Google Workspace",
        "spf.protection.outlook.com": "Microsoft 365",
        "sendgrid.net": "SendGrid",
        "servers.mcsv.net": "Mailchimp",
        "spf.mailjet.com": "Mailjet",
        "amazonses.com": "Amazon SES",
        "mailgun.org": "Mailgun",
        "zoho.com": "Zoho",
        "spf.brevo.com": "Brevo (Sendinblue)",
        "hubspot.com": "HubSpot",
        "salesforce.com": "Salesforce",
        "freshdesk.com": "Freshdesk",
        "zendesk.com": "Zendesk",
    }

    async def check_health(self) -> bool:
        try:
            dns.resolver.resolve("google.com", "A", lifetime=3)
            return True
        except Exception:
            return False

    def _identify_mx_provider(self, mx_host: str) -> str | None:
        mx_lower = mx_host.lower()
        for key, label in self.MX_PROVIDERS.items():
            if key in mx_lower:
                return label
        return None

    def _parse_spf_services(self, txt_record: str) -> list[str]:
        """Extract third-party services from SPF TXT records."""
        services = []
        if not txt_record.lower().startswith("v=spf1"):
            return services
        for part in txt_record.split():
            if part.startswith("include:"):
                include_domain = part[8:]
                for key, label in self.SPF_SERVICES.items():
                    if key in include_domain.lower():
                        services.append(label)
                        break
        return services

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        domain = identifier_value.strip().lower()
        if not domain or "." not in domain:
            return []

        findings: list[Finding] = []
        resolver = dns.resolver.Resolver()
        resolver.lifetime = self.timeout_seconds
        resolver.timeout = self.timeout_seconds

        # --- A Records (IPv4 hosting IPs) ---
        try:
            answers = resolver.resolve(domain, "A")
            ips = [rdata.address for rdata in answers]
            if ips:
                findings.append(Finding(
                    connector_name=self.name,
                    result_type="dns_a_record",
                    result_value=", ".join(ips),
                    confidence=1.0,
                    raw_payload={"record_type": "A", "ips": ips, "domain": domain}
                ))
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.exception.Timeout, Exception):
            pass

        # --- AAAA Records (IPv6 hosting IPs) ---
        try:
            answers = resolver.resolve(domain, "AAAA")
            ips6 = [rdata.address for rdata in answers]
            if ips6:
                findings.append(Finding(
                    connector_name=self.name,
                    result_type="dns_aaaa_record",
                    result_value=", ".join(ips6),
                    confidence=1.0,
                    raw_payload={"record_type": "AAAA", "ips": ips6, "domain": domain}
                ))
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.exception.Timeout, Exception):
            pass

        # --- MX Records (Email provider) ---
        try:
            answers = resolver.resolve(domain, "MX")
            mx_records = []
            email_provider = None
            for rdata in sorted(answers, key=lambda r: r.preference):
                mx_host = str(rdata.exchange).rstrip(".")
                mx_records.append({"priority": rdata.preference, "host": mx_host})
                if not email_provider:
                    email_provider = self._identify_mx_provider(mx_host)

            if mx_records:
                value = ", ".join(f"{m['host']} (pri {m['priority']})" for m in mx_records)
                if email_provider:
                    value = f"{email_provider} — {value}"
                findings.append(Finding(
                    connector_name=self.name,
                    result_type="dns_mx_record",
                    result_value=value,
                    confidence=1.0,
                    raw_payload={"record_type": "MX", "records": mx_records, "provider": email_provider}
                ))
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.exception.Timeout, Exception):
            pass

        # --- TXT Records (SPF, verification, services) ---
        try:
            answers = resolver.resolve(domain, "TXT")
            spf_services_found: list[str] = []
            verification_services: list[str] = []

            for rdata in answers:
                txt_val = rdata.to_text().strip('"')

                # Parse SPF for third-party service detection
                if txt_val.lower().startswith("v=spf1"):
                    services = self._parse_spf_services(txt_val)
                    spf_services_found.extend(services)

                # Detect site verification tokens (reveal what services they use)
                if "google-site-verification" in txt_val:
                    verification_services.append("Google Search Console")
                elif "facebook-domain-verification" in txt_val:
                    verification_services.append("Facebook/Meta")
                elif "apple-domain-verification" in txt_val:
                    verification_services.append("Apple")
                elif "atlassian-domain-verification" in txt_val:
                    verification_services.append("Atlassian")
                elif "hubspot" in txt_val.lower():
                    verification_services.append("HubSpot")
                elif "docusign" in txt_val.lower():
                    verification_services.append("DocuSign")
                elif "stripe-verification" in txt_val.lower():
                    verification_services.append("Stripe")

            if spf_services_found:
                findings.append(Finding(
                    connector_name=self.name,
                    result_type="dns_services_detected",
                    result_value=f"Email/SaaS Services: {', '.join(set(spf_services_found))}",
                    confidence=0.95,
                    raw_payload={"source": "SPF", "services": list(set(spf_services_found))}
                ))

            if verification_services:
                findings.append(Finding(
                    connector_name=self.name,
                    result_type="dns_verification_tokens",
                    result_value=f"Verified with: {', '.join(set(verification_services))}",
                    confidence=0.9,
                    raw_payload={"source": "TXT verification", "services": list(set(verification_services))}
                ))

        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.exception.Timeout, Exception):
            pass

        # --- CNAME Records ---
        try:
            answers = resolver.resolve(domain, "CNAME")
            cnames = [str(rdata.target).rstrip(".") for rdata in answers]
            if cnames:
                findings.append(Finding(
                    connector_name=self.name,
                    result_type="dns_cname_record",
                    result_value=", ".join(cnames),
                    confidence=1.0,
                    raw_payload={"record_type": "CNAME", "targets": cnames}
                ))
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.exception.Timeout, Exception):
            pass

        return findings
