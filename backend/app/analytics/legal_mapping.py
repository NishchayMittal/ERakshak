"""
Indian Legal Section Mapping Engine
Maps OSINT findings to relevant provisions of:
  - Information Technology Act, 2000 (IT Act)
  - Bharatiya Nyaya Sanhita, 2023 (BNS)
  - Prevention of Money Laundering Act, 2002 (PMLA)
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal


# ─────────────────────────────────────────────
# Data structures
# ─────────────────────────────────────────────

SeverityLevel = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
ActName = Literal["IT Act 2000", "BNS 2023", "PMLA 2002"]


@dataclass
class LegalSection:
    act: ActName
    section: str          # e.g. "Section 66C"
    title: str            # e.g. "Identity Theft"
    description: str      # Plain-language explanation for investigators
    severity: SeverityLevel
    punishment: str       # Punishment as per the act
    bailable: bool        # Whether the offence is bailable


@dataclass
class MappedLegalFlag:
    section: LegalSection
    confidence: float                   # 0.0 – 1.0
    triggered_by: list[dict]            # Evidence citations: {connector, type, value}
    notes: str = ""                     # Investigator-facing contextual note


# ─────────────────────────────────────────────
# Section Definitions
# ─────────────────────────────────────────────

SECTIONS: dict[str, LegalSection] = {
    # ── IT Act 2000 ──────────────────────────────────────────────────────────
    "IT_43": LegalSection(
        act="IT Act 2000",
        section="Section 43",
        title="Penalty & Compensation for Damage to Computer",
        description="Applies when a person accesses or downloads data from a computer system without the owner's permission, or causes denial of service.",
        severity="HIGH",
        punishment="Compensation up to ₹1 Crore payable to the affected person.",
        bailable=True,
    ),
    "IT_66": LegalSection(
        act="IT Act 2000",
        section="Section 66",
        title="Computer Related Offences",
        description="Criminalises dishonest or fraudulent acts described under Section 43 — including hacking and data theft.",
        severity="HIGH",
        punishment="Imprisonment up to 3 years and/or fine up to ₹5 Lakhs.",
        bailable=False,
    ),
    "IT_66B": LegalSection(
        act="IT Act 2000",
        section="Section 66B",
        title="Dishonestly Receiving Stolen Computer Resource",
        description="Applies when a person dishonestly receives or retains any stolen computer resource or communication device knowing it to be stolen.",
        severity="HIGH",
        punishment="Imprisonment up to 3 years and/or fine up to ₹1 Lakh.",
        bailable=False,
    ),
    "IT_66C": LegalSection(
        act="IT Act 2000",
        section="Section 66C",
        title="Identity Theft",
        description="Covers fraudulent or dishonest use of another person's electronic signature, password, or any other unique identification feature.",
        severity="CRITICAL",
        punishment="Imprisonment up to 3 years and fine up to ₹1 Lakh.",
        bailable=False,
    ),
    "IT_66D": LegalSection(
        act="IT Act 2000",
        section="Section 66D",
        title="Cheating by Personation via Computer Resource",
        description="Applies when a person cheats another by impersonating them using a computer resource or communication device (e.g. phishing sites, fake profiles).",
        severity="CRITICAL",
        punishment="Imprisonment up to 3 years and fine up to ₹1 Lakh.",
        bailable=False,
    ),
    "IT_66E": LegalSection(
        act="IT Act 2000",
        section="Section 66E",
        title="Violation of Privacy",
        description="Covers intentional capture, publication, or transmission of images of a person's private areas without consent.",
        severity="HIGH",
        punishment="Imprisonment up to 3 years and/or fine up to ₹2 Lakhs.",
        bailable=False,
    ),
    "IT_66F": LegalSection(
        act="IT Act 2000",
        section="Section 66F",
        title="Cyber Terrorism",
        description="Applies when acts threaten the unity, integrity, security, or sovereignty of India via computer networks, or cause denial of access to authorised personnel.",
        severity="CRITICAL",
        punishment="Imprisonment which may extend to life.",
        bailable=False,
    ),
    "IT_67": LegalSection(
        act="IT Act 2000",
        section="Section 67",
        title="Publishing Obscene Material in Electronic Form",
        description="Covers publication or transmission of obscene material in electronic form.",
        severity="HIGH",
        punishment="First conviction: up to 3 years and fine up to ₹5 Lakhs. Subsequent: up to 5 years and fine up to ₹10 Lakhs.",
        bailable=False,
    ),
    "IT_69": LegalSection(
        act="IT Act 2000",
        section="Section 69",
        title="Power to Issue Directions for Interception / Monitoring / Decryption",
        description="Authorises the Government to intercept, monitor, or decrypt information through any computer resource in the interest of national security. Relevant when encrypted communications (e.g. PGP keys) are discovered.",
        severity="MEDIUM",
        punishment="Failure to comply: imprisonment up to 7 years and fine.",
        bailable=False,
    ),
    "IT_72": LegalSection(
        act="IT Act 2000",
        section="Section 72",
        title="Breach of Confidentiality and Privacy",
        description="Covers disclosure of information accessed during the course of powers granted under the IT Act without the consent of the person.",
        severity="MEDIUM",
        punishment="Imprisonment up to 2 years and/or fine up to ₹1 Lakh.",
        bailable=True,
    ),
    # ── BNS 2023 ─────────────────────────────────────────────────────────────
    "BNS_318": LegalSection(
        act="BNS 2023",
        section="Section 318",
        title="Cheating",
        description="Covers deceiving any person and fraudulently inducing them to deliver property or to do/omit to do any act (digital or physical). Applies to online fraud, fake listings, and crypto scams.",
        severity="HIGH",
        punishment="Imprisonment up to 3 years and/or fine.",
        bailable=False,
    ),
    "BNS_318_4": LegalSection(
        act="BNS 2023",
        section="Section 318(4)",
        title="Cheating with Imprisonment",
        description="Aggravated form of cheating causing delivery of property or inducing an act that leads to damage. Applies to large-scale online fraud and impersonation websites.",
        severity="CRITICAL",
        punishment="Imprisonment up to 7 years and fine.",
        bailable=False,
    ),
    "BNS_316": LegalSection(
        act="BNS 2023",
        section="Section 316",
        title="Criminal Breach of Trust",
        description="Applies when a person entrusted with property or authority over it, dishonestly misappropriates it. Relevant in cases involving fiduciary digital access or stolen credentials.",
        severity="HIGH",
        punishment="Imprisonment up to 3 years and/or fine.",
        bailable=False,
    ),
    "BNS_351": LegalSection(
        act="BNS 2023",
        section="Section 351",
        title="Criminal Intimidation",
        description="Covers threats to cause harm to a person, their reputation, or property with intent to cause alarm. Applies to online harassment and cyberstalking.",
        severity="MEDIUM",
        punishment="Imprisonment up to 2 years and/or fine.",
        bailable=True,
    ),
    "BNS_77": LegalSection(
        act="BNS 2023",
        section="Section 77",
        title="Voyeurism",
        description="Covers watching or capturing images of a woman engaged in a private act, without her consent, in circumstances where she would expect privacy.",
        severity="HIGH",
        punishment="First conviction: 1–3 years. Subsequent: 3–7 years. Plus fine.",
        bailable=False,
    ),
    # ── PMLA 2002 ────────────────────────────────────────────────────────────
    "PMLA_3": LegalSection(
        act="PMLA 2002",
        section="Section 3",
        title="Offence of Money Laundering",
        description="Applies when a person knowingly deals with proceeds of crime — including through cryptocurrency wallets with suspicious transaction volumes or mixing patterns.",
        severity="CRITICAL",
        punishment="Rigorous imprisonment of 3–7 years (up to 10 years for narcotics) and fine.",
        bailable=False,
    ),
    "PMLA_4": LegalSection(
        act="PMLA 2002",
        section="Section 4",
        title="Punishment for Money Laundering",
        description="Prescribes the punishment for the offence of money laundering defined under Section 3. Triggered by significant cryptocurrency flows.",
        severity="CRITICAL",
        punishment="Rigorous imprisonment of 3–7 years and fine which may extend to ₹5 Lakhs.",
        bailable=False,
    ),
}


# ─────────────────────────────────────────────
# Rule Engine
# ─────────────────────────────────────────────

def _make_citation(finding) -> dict:
    return {
        "connector": finding.connector_name,
        "type": finding.result_type,
        "value": finding.result_value[:120],
        "confidence": round(finding.confidence, 2),
    }


def map_findings_to_legal_sections(findings: list) -> list[MappedLegalFlag]:
    """
    Given a flat list of Finding ORM objects, returns a deduplicated list of
    MappedLegalFlag entries — each section appears at most once, with all
    triggering evidence citations merged.
    """
    # section_key -> (MappedLegalFlag, set of triggering finding ids)
    accumulator: dict[str, tuple[MappedLegalFlag, set]] = {}

    def add(key: str, finding, confidence: float, notes: str = ""):
        section = SECTIONS[key]
        citation = _make_citation(finding)
        if key in accumulator:
            flag, seen_ids = accumulator[key]
            if finding.id not in seen_ids:
                flag.triggered_by.append(citation)
                seen_ids.add(finding.id)
                # Take the max confidence seen
                if confidence > flag.confidence:
                    flag.confidence = confidence
        else:
            accumulator[key] = (
                MappedLegalFlag(
                    section=section,
                    confidence=confidence,
                    triggered_by=[citation],
                    notes=notes,
                ),
                {finding.id},
            )

    for f in findings:
        connector = (f.connector_name or "").lower()
        rtype = (f.result_type or "").lower()
        rvalue = (f.result_value or "").lower()

        # ── Breach / Leak data ───────────────────────────────────────────────
        if connector in ("breach_lookup", "hibp", "xposedornot", "breach_demo"):
            add("IT_43", f, 0.85, "Subject's data was found in a breach, indicating they are likely a victim of data theft or unauthorised computer access.")
            add("IT_66C", f, 0.70, "Leaked passwords/credentials place the subject at high risk of Identity Theft.")

        # ── Crypto Wallet ────────────────────────────────────────────────────
        elif connector == "wallet_lookup":
            if "total_received" in rtype or "balance" in rtype or "transaction" in rvalue:
                # Only flag money laundering softly, as crypto isn't inherently illegal
                add("PMLA_3", f, 0.40, "Cryptocurrency wallet with significant transaction volume may warrant scrutiny under PMLA if linked to proceeds of crime.")

        # ── Certificate Transparency / Subdomains ────────────────────────────
        elif connector == "crtsh":
            # Only trigger fraud/cheating if the subdomain looks deceptive
            if "phish" in rvalue or "login" in rvalue or "secure" in rvalue or "bank" in rvalue or "verify" in rvalue:
                add("IT_66D", f, 0.88, "Subdomain name pattern strongly suggests phishing infrastructure, indicating potential cheating by personation.")
                add("BNS_318_4", f, 0.85, "Phishing subdomains indicate structured online fraud and cheating.")

        # ── Shodan — Open Ports / CVEs ───────────────────────────────────────
        elif connector == "shodan_idb":
            if "cve" in rtype or "vuln" in rtype:
                add("IT_43", f, 0.60, "Known CVEs on the target infrastructure present a severe risk of unauthorised access or damage.")

        # ── Bucket Enumeration ───────────────────────────────────────────────
        elif connector == "bucket_enum":
            if "public" in rvalue or "accessible" in rvalue:
                add("IT_43", f, 0.75, "Publicly accessible cloud storage buckets may contain sensitive data, indicating potential unauthorised exposure or data leaks.")

        # ── Wayback Machine ──────────────────────────────────────────────────
        elif connector == "wayback":
            if rtype == "snapshot" and ("login" in rvalue or "password" in rvalue or "admin" in rvalue):
                add("IT_43", f, 0.50, "Historical snapshots showing exposed admin or login interfaces highlight past infrastructure vulnerabilities.")

        # Note: Benign OSINT data like Social Media (social_profiler), GitHub (github_commits), 
        # Wikipedia, EXIF data, or WHOIS records do NOT inherently constitute a crime, 
        # so they no longer trigger arbitrary legal offences.

    return [flag for flag, _ in accumulator.values()]


def run_legal_mapping(db, case_id: str) -> dict:
    """
    Entry point: loads all findings for a case and returns the full legal mapping result.
    """
    from app.models import Identifier, Finding

    identifiers = db.query(Identifier).filter(Identifier.case_id == case_id).all()
    identifier_ids = [i.id for i in identifiers]

    if not identifier_ids:
        return {
            "case_id": case_id,
            "total_flags": 0,
            "flags": [],
            "summary": "No findings available for legal analysis.",
        }

    findings = (
        db.query(Finding)
        .filter(Finding.identifier_id.in_(identifier_ids))
        .all()
    )

    flags = map_findings_to_legal_sections(findings)

    # Sort: CRITICAL first, then HIGH, MEDIUM, LOW; within tier sort by confidence desc
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    flags.sort(key=lambda f: (severity_order.get(f.section.severity, 9), -f.confidence))

    critical_count = sum(1 for f in flags if f.section.severity == "CRITICAL")
    high_count = sum(1 for f in flags if f.section.severity == "HIGH")

    if critical_count > 0:
        summary = f"{critical_count} CRITICAL and {high_count} HIGH severity legal provisions flagged. Immediate legal review recommended."
    elif high_count > 0:
        summary = f"{high_count} HIGH severity legal provisions flagged. Legal consultation advised."
    elif flags:
        summary = f"{len(flags)} legal provision(s) flagged. Further investigation recommended."
    else:
        summary = "No legal provisions flagged from current findings."

    return {
        "case_id": case_id,
        "total_flags": len(flags),
        "critical_count": critical_count,
        "high_count": high_count,
        "summary": summary,
        "flags": [
            {
                "act": f.section.act,
                "section": f.section.section,
                "title": f.section.title,
                "description": f.section.description,
                "severity": f.section.severity,
                "punishment": f.section.punishment,
                "bailable": f.section.bailable,
                "confidence": round(f.confidence, 2),
                "notes": f.notes,
                "triggered_by": f.triggered_by,
            }
            for f in flags
        ],
    }
