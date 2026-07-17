import asyncio
import logging
from sqlalchemy.orm import Session

import os
import json
import redis.asyncio as redis_async
from app.audit import log_action
from app.connectors.base import registry
from app.connectors.canonicalizer import canonicalize_findings, extract_identifier_from_finding
from app.database import SessionLocal
from app.models import Finding, Identifier, IdentifierType
from app.normalize import normalize

logger = logging.getLogger(__name__)

# Common email prefixes to probe when a domain is searched
DOMAIN_EMAIL_PROBES = ("admin", "info", "contact", "support", "hello", "webmaster")


async def _verify_gravatar_email(email: str) -> bool:
    """Passively checks if an email is registered on Gravatar."""
    import hashlib
    import httpx
    md5 = hashlib.md5(email.encode('utf-8')).hexdigest()
    url = f"https://www.gravatar.com/avatar/{md5}?d=404"
    try:
        async with httpx.AsyncClient(timeout=3.0, follow_redirects=True) as client:
            res = await client.head(url)
            return res.status_code == 200
    except Exception:
        return False

# Maximum number of pivoted identifiers per depth level (prevents explosion)
MAX_PIVOTS_PER_LEVEL = 10


def _identifier_exists(db: Session, case_id: str, id_type: IdentifierType, normalized: str) -> bool:
    """Check if an identifier already exists in this case."""
    return db.query(Identifier).filter(
        Identifier.case_id == case_id,
        Identifier.type == id_type,
        Identifier.normalized_value == normalized
    ).first() is not None


def _create_pivot_identifier(
    db: Session,
    case_id: str,
    investigator_id: str,
    id_type: IdentifierType,
    raw_value: str,
    normalized_value: str,
    confidence: float,
    source: str,
    metadata: dict | None = None,
) -> Identifier | None:
    """Create a new pivoted identifier if it doesn't already exist. Returns None if duplicate."""
    if _identifier_exists(db, case_id, id_type, normalized_value):
        return None

    new_ident = Identifier(
        type=id_type,
        raw_value=raw_value,
        normalized_value=normalized_value,
        confidence=confidence,
        source=source,
        case_id=case_id,
        investigator_id=investigator_id,
        identifier_metadata=metadata,
    )
    db.add(new_ident)
    db.commit()
    db.refresh(new_ident)

    log_action(
        db,
        "identifier.create",
        investigator_id=investigator_id,
        case_id=case_id,
        detail={
            "identifier_id": new_ident.id,
            "type": new_ident.type.value,
            "normalized_value": new_ident.normalized_value,
            "source": new_ident.source,
        },
    )
    return new_ident

async def publish_update(case_id: str, action: str, detail: dict):
    message = {"action": action, "case_id": case_id, "detail": detail}
    try:
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        r = await redis_async.from_url(redis_url)
        await r.publish(f"case_updates:{case_id}", json.dumps(message))
        await r.aclose()
    except Exception as e:
        logger.info(f"Local Environment: Redis offline. Broadcasting case update in-memory to WebSockets.")
        from app.ws_manager import manager
        await manager.broadcast_to_case(case_id, message)


async def run_connectors_and_pivot(
    db: Session,
    identifier: Identifier,
    investigator_id: str,
    depth: int = 0,
) -> list[Finding]:
    """
    Runs connectors for a given identifier, canonicalizes findings, saves them,
    and checks for pivot-back conditions (recursively up to depth 2).

    Smart Cross-Type Pivoting chains:
      Domain  →  WHOIS email  →  breach lookup + username scan
      Domain  →  DNS A record →  (future: IP geolocation, Shodan)
      Username →  GitHub commit email  →  breach lookup
      Email   →  username split  →  username enumeration
      Domain  →  common email probes (admin@, info@) → breach lookup
    """
    pivot_tasks: list[asyncio.Task] = []

    # ─── Cross-type pivot: Email → Username (works at ALL depths now) ───
    if identifier.type == IdentifierType.email:
        username_part = identifier.normalized_value.split("@")[0]
        if len(username_part) >= 3:
            new_uname = _create_pivot_identifier(
                db, identifier.case_id, investigator_id,
                IdentifierType.username, username_part, username_part,
                confidence=0.9, source="pivot:email_split",
            )
            if new_uname:
                pivot_tasks.append(asyncio.create_task(
                    run_connectors_and_pivot_background(
                        identifier.case_id, new_uname.id,
                        investigator_id, depth + 1,
                    )
                ))

    # ─── Cross-type pivot: Domain → Common Email Probes ───
    # Only at depth 0 to avoid unbounded expansion
    if identifier.type == IdentifierType.domain and depth == 0:
        domain = identifier.normalized_value
        
        # Concurrently verify which email probes actually exist on Gravatar
        async def verify_probe(prefix: str):
            email = f"{prefix}@{domain}"
            active = await _verify_gravatar_email(email)
            return prefix, active

        probe_statuses = await asyncio.gather(*(verify_probe(p) for p in DOMAIN_EMAIL_PROBES))

        for prefix, is_active in probe_statuses:
            if is_active:
                probe_email = f"{prefix}@{domain}"
                new_email = _create_pivot_identifier(
                    db, identifier.case_id, investigator_id,
                    IdentifierType.email, probe_email, probe_email,
                    confidence=0.85, source="pivot:domain_email_inference",
                )
                if new_email:
                    pivot_tasks.append(asyncio.create_task(
                        run_connectors_and_pivot_background(
                            identifier.case_id, new_email.id,
                            investigator_id, depth + 1,
                        )
                    ))

    # ─── Run connectors for this identifier ───
    connectors = registry.for_type(identifier.type)
    if not connectors:
        return []

    async def invoke(connector):
        try:
            raw_res = await connector.run(
                identifier.normalized_value,
                metadata=identifier.identifier_metadata or {},
            )
            return connector, raw_res
        except Exception as e:
            logger.error(f"Error running connector {connector.name}: {e}")
            return connector, []

    results = await asyncio.gather(*(invoke(c) for c in connectors))

    # ─── Canonicalize and save findings ───
    db_findings: list[Finding] = []
    for connector, raw_results in results:
        canonicalized_results = canonicalize_findings(raw_results)

        connector_db_findings = []
        for res in canonicalized_results:
            finding = Finding(
                identifier_id=identifier.id,
                connector_name=res.connector_name,
                result_type=res.result_type,
                result_value=res.result_value,
                confidence=res.confidence,
                raw_payload=res.raw_payload,
            )
            db.add(finding)
            connector_db_findings.append(finding)
            db_findings.append(finding)

        db.commit()
        for f in connector_db_findings:
            db.refresh(f)

        log_action(
            db,
            "connector.run",
            investigator_id=investigator_id,
            case_id=identifier.case_id,
            detail={
                "identifier_id": identifier.id,
                "connector": connector.name,
                "result_count": len(canonicalized_results),
            },
        )
        
        # Publish to WebSockets
        if connector_db_findings:
            await publish_update(
                identifier.case_id,
                "findings_discovered",
                {"identifier_id": identifier.id, "count": len(connector_db_findings)}
            )

    # ─── Pivot-Back Loop: extract new identifiers from findings ───
    if depth < 2:
        pivots_created = 0
        for f in db_findings:
            if pivots_created >= MAX_PIVOTS_PER_LEVEL:
                break
            if f.confidence < 0.7:
                continue

            pivot = extract_identifier_from_finding(f)
            if not pivot:
                continue

            p_type, p_value = pivot
            try:
                p_normalized = normalize(p_value, p_type)
            except Exception:
                continue

            new_ident = _create_pivot_identifier(
                db, identifier.case_id, investigator_id,
                p_type, p_value, p_normalized,
                confidence=f.confidence,
                source=f"pivot:{f.connector_name}",
            )
            if new_ident:
                pivots_created += 1
                from app.worker import dispatch_task
                dispatch_task(
                    identifier.case_id,
                    new_ident.id,
                    investigator_id,
                    depth + 1
                )
    return db_findings


async def run_connectors_and_pivot_background(
    case_id: str,
    identifier_id: str,
    investigator_id: str,
    depth: int,
):
    """
    Background runner that creates a new database session and executes the
    connector/pivot pipeline for an identifier.
    """
    db = SessionLocal()
    try:
        identifier = db.query(Identifier).filter(
            Identifier.id == identifier_id,
            Identifier.case_id == case_id,
        ).first()
        if identifier:
            await run_connectors_and_pivot(db, identifier, investigator_id, depth)
    except Exception as e:
        logger.error(f"Error in background pivot pipeline: {e}")
    finally:
        db.close()
