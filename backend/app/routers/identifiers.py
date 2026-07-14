import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.audit import log_action
from app.auth import get_current_investigator
from app.connectors.base import registry
from app.database import get_db
from app.models import Case, Finding, Identifier, Investigator
from app.normalize import detect_type, normalize
from app.schemas import FindingOut, IdentifierCreate, IdentifierOut


router = APIRouter(prefix="/identifiers", tags=["identifiers"])


@router.post("/", response_model=IdentifierOut, status_code=status.HTTP_201_CREATED)
def create_identifier(
    payload: IdentifierCreate,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator),
):
    case = (
        db.query(Case)
        .filter(Case.id == payload.case_id, Case.lead_investigator_id == current_investigator.id)
        .first()
    )
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    identifier_type = payload.type or detect_type(payload.raw_value)
    normalized_value = normalize(payload.raw_value, identifier_type)

    identifier = Identifier(
        type=identifier_type,
        raw_value=payload.raw_value,
        normalized_value=normalized_value,
        confidence=payload.confidence,
        source=payload.source,
        case_id=case.id,
        investigator_id=current_investigator.id,
    )
    db.add(identifier)
    db.commit()
    db.refresh(identifier)
    log_action(
        db,
        "identifier.create",
        investigator_id=current_investigator.id,
        case_id=case.id,
        detail={"identifier_id": identifier.id, "type": identifier.type.value, "normalized_value": identifier.normalized_value},
    )
    return identifier


@router.post("/{identifier_id}/run-connectors", response_model=list[FindingOut])
async def run_connectors(
    identifier_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator),
):
    identifier = (
        db.query(Identifier)
        .join(Case, Case.id == Identifier.case_id)
        .filter(Identifier.id == identifier_id, Case.lead_investigator_id == current_investigator.id)
        .first()
    )
    if not identifier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Identifier not found")

    connectors = registry.for_type(identifier.type)

    async def invoke(connector):
        try:
            return connector, await connector.run(identifier.normalized_value)
        except Exception:
            return connector, []

    results = await asyncio.gather(*(invoke(connector) for connector in connectors))

    saved_findings: list[Finding] = []
    for connector, connector_results in results:
        connector_saved: list[Finding] = []
        for result in connector_results:
            finding = Finding(
                identifier_id=identifier.id,
                connector_name=result.connector_name,
                result_type=result.result_type,
                result_value=result.result_value,
                confidence=result.confidence,
                raw_payload=result.raw_payload,
            )
            db.add(finding)
            connector_saved.append(finding)
            saved_findings.append(finding)
        db.commit()
        for finding in connector_saved:
            db.refresh(finding)
        log_action(
            db,
            "connector.run",
            investigator_id=current_investigator.id,
            case_id=identifier.case_id,
            detail={"identifier_id": identifier.id, "connector": connector.name, "result_count": len(connector_results)},
        )

    for finding in saved_findings:
        db.refresh(finding)
    return saved_findings


@router.get("/{identifier_id}/findings", response_model=list[FindingOut])
def list_findings(
    identifier_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator),
):
    identifier = (
        db.query(Identifier)
        .join(Case, Case.id == Identifier.case_id)
        .filter(Identifier.id == identifier_id, Case.lead_investigator_id == current_investigator.id)
        .first()
    )
    if not identifier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Identifier not found")

    return (
        db.query(Finding)
        .filter(Finding.identifier_id == identifier.id)
        .order_by(Finding.discovered_at.desc())
        .all()
    )