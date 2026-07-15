import asyncio
import logging
from sqlalchemy.orm import Session

from app.audit import log_action
from app.connectors.base import registry
from app.connectors.canonicalizer import canonicalize_findings, extract_identifier_from_finding
from app.database import SessionLocal
from app.models import Finding, Identifier
from app.normalize import normalize

logger = logging.getLogger(__name__)


async def run_connectors_and_pivot(
    db: Session,
    identifier: Identifier,
    investigator_id: str,
    depth: int = 0
) -> list[Finding]:
    """
    Runs connectors for a given identifier, canonicalizes findings, saves them,
    and checks for pivot-back conditions (recursively up to depth 2).
    """
    connectors = registry.for_type(identifier.type)
    if not connectors:
        return []

    # 1. Run connectors concurrently
    async def invoke(connector):
        try:
            raw_res = await connector.run(identifier.normalized_value)
            return connector, raw_res
        except Exception as e:
            logger.error(f"Error running connector {connector.name}: {e}")
            return connector, []

    results = await asyncio.gather(*(invoke(c) for c in connectors))

    # 2. Canonicalize and save findings
    db_findings: list[Finding] = []
    for connector, raw_results in results:
        # Canonicalize raw results
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
                "result_count": len(canonicalized_results)
            },
        )

    # 3. Pivot-Back Loop Check (Recursion depth limit of 2)
    if depth < 2:
        for f in db_findings:
            # Check high confidence: confidence >= 0.7
            if f.confidence >= 0.7:
                pivot = extract_identifier_from_finding(f)
                if pivot:
                    p_type, p_value = pivot
                    p_normalized = normalize(p_value, p_type)
                    
                    # Check if it already exists as an identifier in this case
                    exists = db.query(Identifier).filter(
                        Identifier.case_id == identifier.case_id,
                        Identifier.type == p_type,
                        Identifier.normalized_value == p_normalized
                    ).first()
                    
                    if not exists:
                        # Insert new identifier
                        new_ident = Identifier(
                            type=p_type,
                            raw_value=p_value,
                            normalized_value=p_normalized,
                            confidence=f.confidence,
                            source=f"pivot:{f.connector_name}",
                            case_id=identifier.case_id,
                            investigator_id=investigator_id
                        )
                        db.add(new_ident)
                        db.commit()
                        db.refresh(new_ident)
                        
                        log_action(
                            db,
                            "identifier.create",
                            investigator_id=investigator_id,
                            case_id=identifier.case_id,
                            detail={
                                "identifier_id": new_ident.id,
                                "type": new_ident.type.value,
                                "normalized_value": new_ident.normalized_value,
                                "source": new_ident.source
                            },
                        )
                        
                        # Asynchronously trigger connectors for the new identifier (depth + 1)
                        asyncio.create_task(
                            run_connectors_and_pivot_background(
                                identifier.case_id,
                                new_ident.id,
                                investigator_id,
                                depth + 1
                            )
                        )
                        
    return db_findings


async def run_connectors_and_pivot_background(
    case_id: str,
    identifier_id: str,
    investigator_id: str,
    depth: int
):
    """
    Background runner that creates a new database session and executes the
    connector/pivot pipeline for an identifier.
    """
    db = SessionLocal()
    try:
        identifier = db.query(Identifier).filter(
            Identifier.id == identifier_id,
            Identifier.case_id == case_id
        ).first()
        if identifier:
            await run_connectors_and_pivot(db, identifier, investigator_id, depth)
    except Exception as e:
        logger.error(f"Error in background pivot pipeline: {e}")
    finally:
        db.close()
