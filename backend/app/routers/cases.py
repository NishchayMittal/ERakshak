from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import networkx as nx
from networkx.readwrite import json_graph
from rapidfuzz import fuzz
from pydantic import BaseModel
import asyncio
import io
import csv
from datetime import datetime

from app.audit import log_action
from app.auth import get_current_investigator
from app.database import get_db
from app.models import Case, Investigator, Identifier, Finding, CaseNote
from app.schemas import CaseCreate, CaseOut


router = APIRouter(prefix="/cases", tags=["cases"])


@router.post("", response_model=CaseOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=CaseOut, status_code=status.HTTP_201_CREATED)
def create_case(
    payload: CaseCreate,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator),
):
    case = Case(
        title=payload.title,
        description=payload.description,
        status=payload.status,
        lead_investigator_id=current_investigator.id,
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    log_action(db, "case.create", investigator_id=current_investigator.id, case_id=case.id, detail={"title": case.title})
    return case


@router.get("", response_model=list[CaseOut])
@router.get("/", response_model=list[CaseOut])
def list_cases(db: Session = Depends(get_db), current_investigator: Investigator = Depends(get_current_investigator)):
    return (
        db.query(Case)
        .filter(Case.lead_investigator_id == current_investigator.id)
        .order_by(Case.created_at.desc())
        .all()
    )


@router.get("/{case_id}", response_model=CaseOut)
def get_case(case_id: str, db: Session = Depends(get_db), current_investigator: Investigator = Depends(get_current_investigator)):
    case = (
        db.query(Case)
        .filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id)
        .first()
    )
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    return case


@router.get("/{case_id}/graph")
def get_case_graph(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator),
):
    case = (
        db.query(Case)
        .filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id)
        .first()
    )
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    # Fetch all identifiers in this case
    identifiers = db.query(Identifier).filter(Identifier.case_id == case_id).all()
    identifier_ids = [i.id for i in identifiers]

    # Fetch all findings for these identifiers
    findings = (
        db.query(Finding)
        .filter(Finding.identifier_id.in_(identifier_ids))
        .all()
        if identifier_ids
        else []
    )

    G = nx.MultiDiGraph()

    # Get all seed name identifiers for name matching score
    seed_names = [i.normalized_value for i in identifiers if i.type.value == "name"]

    # 1. Add identifier nodes
    id_map = {}
    for identifier in identifiers:
        node_id = identifier.normalized_value
        id_map[identifier.id] = node_id
        if not G.has_node(node_id):
            G.add_node(
                node_id,
                label=node_id,
                type=identifier.type.value,
                node_class="identifier",
                id=identifier.id,
            )

    # 2. Add finding nodes and edges
    for finding in findings:
        parent_node_id = id_map.get(finding.identifier_id)
        if not parent_node_id:
            continue

        source_connector = finding.connector_name
        result_type = finding.result_type
        result_val = finding.result_value
        confidence = finding.confidence

        target_node_id = None
        target_type = "other"
        edge_label = result_type

        # Parse specific findings
        if result_type == "subdomain":
            target_node_id = result_val.strip().lower()
            target_type = "subdomain"
        elif result_type == "registrant_email":
            target_node_id = result_val.strip().lower()
            target_type = "email"
        elif result_type == "registrant_phone":
            target_node_id = result_val.strip()
            target_type = "phone"
        elif result_type == "registrant_name":
            target_node_id = result_val.split(" (")[0].strip()
            target_type = "name"
            if seed_names:
                match_score = max(fuzz.token_set_ratio(n, target_node_id) / 100.0 for n in seed_names)
                confidence = max(confidence * match_score, 0.1)
        elif result_type == "registrant_org":
            target_node_id = result_val.split(" (")[0].strip()
            target_type = "org"
        elif result_type == "social_profile":
            if "Profile: " in result_val:
                target_node_id = result_val.split("Profile: ")[1].strip()
            else:
                target_node_id = result_val.strip()
            target_type = "social_profile"
        elif result_type == "face_similarity":
            target_node_id = result_val.split("Match: ")[1].split(" (Similarity:")[0].strip()
            target_type = "person"
        elif result_type == "leak_record":
            breach_name = result_val.split(" (Hint:")[0].strip()
            target_node_id = breach_name
            target_type = "breach"
            
            payload = finding.raw_payload or {}
            ip = payload.get("ip_address")
            if ip:
                ip_node_id = ip.strip()
                if not G.has_node(ip_node_id):
                    G.add_node(
                        ip_node_id,
                        label=ip_node_id,
                        type="ip",
                        node_class="finding",
                        id=finding.id,
                    )
                G.add_edge(
                    parent_node_id,
                    ip_node_id,
                    label="leak_ip",
                    source=source_connector,
                    confidence=1.0,
                )
        elif result_type == "archived_page":
            payload = finding.raw_payload or {}
            orig_url = payload.get("original_url")
            if orig_url:
                target_node_id = orig_url.strip()
                target_type = "url"

        if target_node_id:
            if not G.has_node(target_node_id):
                G.add_node(
                    target_node_id,
                    label=target_node_id,
                    type=target_type,
                    node_class="finding",
                    id=finding.id,
                )
            G.add_edge(
                parent_node_id,
                target_node_id,
                label=edge_label,
                source=source_connector,
                confidence=float(confidence),
            )

    # 3. Pivot detection (high degree)
    for node, degree in dict(G.degree()).items():
        if degree >= 3:
            G.nodes[node]["pivot"] = True
            G.nodes[node]["expand_investigation"] = True

    return json_graph.node_link_data(G)


class IdentifierInputItem(BaseModel):
    type: str
    rawValue: str


class IdentifiersSubmitPayload(BaseModel):
    identifiers: list[IdentifierInputItem]


@router.post("/{case_id}/identifiers")
async def submit_case_identifiers(
    case_id: str,
    payload: IdentifiersSubmitPayload,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    saved_findings = []
    
    # Process each identifier in the payload
    for item in payload.identifiers:
        id_type_str = item.type
        from app.models import IdentifierType
        try:
            valid_type = IdentifierType(id_type_str)
        except ValueError:
            from app.normalize import detect_type
            valid_type = detect_type(item.rawValue)

        from app.normalize import normalize
        normalized_value = normalize(item.rawValue, valid_type)

        db_id = Identifier(
            type=valid_type,
            raw_value=item.rawValue,
            normalized_value=normalized_value,
            confidence=1.0,
            source="manual_intake",
            case_id=case_id,
            investigator_id=current_investigator.id
        )
        db.add(db_id)
        db.commit()
        db.refresh(db_id)

        log_action(
            db,
            "identifier.create",
            investigator_id=current_investigator.id,
            case_id=case_id,
            detail={"identifier_id": db_id.id, "type": db_id.type.value, "normalized_value": db_id.normalized_value},
        )

        from app.connectors.base import registry
        connectors = registry.for_type(db_id.type)

        async def invoke(connector):
            try:
                return connector, await connector.run(db_id.normalized_value)
            except Exception:
                return connector, []

        results = await asyncio.gather(*(invoke(connector) for connector in connectors))

        for connector, connector_results in results:
            connector_saved = []
            for result in connector_results:
                finding = Finding(
                    identifier_id=db_id.id,
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
                case_id=case_id,
                detail={"identifier_id": db_id.id, "connector": connector.name, "result_count": len(connector_results)},
            )

    is_ambiguous = any(item.type == "name" for item in payload.identifiers)
    fields_needed = ["city", "age", "employer"] if is_ambiguous else []

    return {
        "ok": True,
        "jobId": "pipeline-job-123",
        "ambiguous": is_ambiguous,
        "ambiguousFieldsNeeded": fields_needed
    }


@router.get("/{case_id}/entities/{entity_id}/graph")
def get_entity_graph(
    case_id: str,
    entity_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    return get_case_graph(case_id, db, current_investigator)


@router.get("/{case_id}/entities/{entity_id}/profile")
def get_entity_profile(
    case_id: str,
    entity_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    # Find identifier where value or database id matches entity_id
    identifiers = db.query(Identifier).filter(
        Identifier.case_id == case_id,
        (Identifier.normalized_value == entity_id) | (Identifier.id == entity_id)
    ).all()

    findings = []
    if identifiers:
        id_ids = [i.id for i in identifiers]
        findings = db.query(Finding).filter(Finding.identifier_id.in_(id_ids)).all()
    else:
        # Search directly for matching finding result values in the case
        findings = db.query(Finding).join(Identifier).filter(
            Identifier.case_id == case_id,
            Finding.result_value == entity_id
        ).all()

    attributes = []
    for f in findings:
        attributes.append({
            "key": f.result_type,
            "value": f.result_value,
            "source": f.connector_name,
            "confidence": f.confidence,
            "discoveredAt": f.discovered_at.isoformat()
        })

    return {
        "entityId": entity_id,
        "displayName": entity_id,
        "attributes": attributes
    }


@router.get("/{case_id}/entities/{entity_id}/timeline")
def get_entity_timeline(
    case_id: str,
    entity_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    identifiers = db.query(Identifier).filter(
        Identifier.case_id == case_id,
        (Identifier.normalized_value == entity_id) | (Identifier.id == entity_id)
    ).all()

    findings = []
    if identifiers:
        id_ids = [i.id for i in identifiers]
        findings = db.query(Finding).filter(Finding.identifier_id.in_(id_ids)).all()
    else:
        findings = db.query(Finding).join(Identifier).filter(
            Identifier.case_id == case_id,
            Finding.result_value == entity_id
        ).all()

    timeline = []
    for f in findings:
        date_str = f.discovered_at.isoformat()
        label = f"{f.connector_name} - {f.result_type}: {f.result_value}"
        
        if f.connector_name == "wayback_cdx" and f.raw_payload:
            ts = f.raw_payload.get("timestamp")
            if ts and len(ts) >= 8:
                date_str = f"{ts[0:4]}-{ts[4:6]}-{ts[6:8]}"
                label = f"Wayback Snapshot: {f.raw_payload.get('original_url')}"
        elif f.connector_name == "whois_rdap" and f.result_type == "domain_event":
            val = f.result_value
            if ": " in val:
                date_str = val.split(": ")[1].split("T")[0]
                label = val.split(": ")[0]

        timeline.append({
            "id": f.id,
            "date": date_str,
            "label": label,
            "source": f.connector_name,
            "entityId": entity_id
        })

    timeline.sort(key=lambda x: x["date"], reverse=True)
    return timeline


@router.get("/{case_id}/notes")
def get_case_notes(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    notes = db.query(CaseNote).filter(CaseNote.case_id == case_id).order_by(CaseNote.created_at.asc()).all()
    return [{
        "id": n.id,
        "caseId": n.case_id,
        "authorId": n.author_id,
        "text": n.text,
        "createdAt": n.created_at.isoformat()
    } for n in notes]


class NoteCreatePayload(BaseModel):
    authorId: str
    text: str


@router.post("/{case_id}/notes")
def create_case_note(
    case_id: str,
    payload: NoteCreatePayload,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    note = CaseNote(
        case_id=case_id,
        author_id=payload.authorId,
        text=payload.text
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    return {
        "id": note.id,
        "caseId": note.case_id,
        "authorId": note.author_id,
        "text": note.text,
        "createdAt": note.created_at.isoformat()
    }


@router.get("/{case_id}/export/json")
def export_case_json(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    identifiers = db.query(Identifier).filter(Identifier.case_id == case_id).all()
    notes = db.query(CaseNote).filter(CaseNote.case_id == case_id).all()
    
    data = {
        "case": {
            "id": case.id,
            "title": case.title,
            "description": case.description,
            "status": case.status,
            "created_at": case.created_at.isoformat()
        },
        "identifiers": [{
            "id": i.id,
            "type": i.type.value,
            "raw_value": i.raw_value,
            "normalized_value": i.normalized_value,
            "confidence": i.confidence,
            "source": i.source,
            "findings": [{
                "id": f.id,
                "connector": f.connector_name,
                "type": f.result_type,
                "value": f.result_value,
                "confidence": f.confidence,
                "raw_payload": f.raw_payload
            } for f in db.query(Finding).filter(Finding.identifier_id == i.id).all()]
        } for i in identifiers],
        "notes": [{
            "id": n.id,
            "author_id": n.author_id,
            "text": n.text,
            "created_at": n.created_at.isoformat()
        } for n in notes]
    }
    return data


@router.get("/{case_id}/export/csv")
def export_case_csv(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    identifiers = db.query(Identifier).filter(Identifier.case_id == case_id).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Identifier ID", "Identifier Type", "Raw Value", "Normalized Value", "Connector", "Finding Type", "Finding Value", "Confidence"])
    
    for i in identifiers:
        findings = db.query(Finding).filter(Finding.identifier_id == i.id).all()
        if not findings:
            writer.writerow([i.id, i.type.value, i.raw_value, i.normalized_value, "N/A", "N/A", "N/A", i.confidence])
        for f in findings:
            writer.writerow([i.id, i.type.value, i.raw_value, i.normalized_value, f.connector_name, f.result_type, f.result_value, f.confidence])

    output.seek(0)
    headers = {"Content-Disposition": f"attachment; filename=ERakshak_Dossier_{case_id}.csv"}
    return StreamingResponse(io.BytesIO(output.getvalue().encode('utf-8')), headers=headers, media_type="text/csv")


@router.get("/{case_id}/export/pdf")
def export_case_pdf(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    notes = db.query(CaseNote).filter(CaseNote.case_id == case_id).all()
    identifiers = db.query(Identifier).filter(Identifier.case_id == case_id).all()
    
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
    story = []
    styles = getSampleStyleSheet()

    # Title
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#1A202C')
    )
    story.append(Paragraph(f"e-Rakshak Dossier Report", title_style))
    story.append(Spacer(1, 10))

    # Meta
    meta_style = ParagraphStyle(
        'MetaStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#4A5568')
    )
    story.append(Paragraph(f"<b>Case Title:</b> {case.title}", meta_style))
    story.append(Paragraph(f"<b>Status:</b> {case.status.upper()}", meta_style))
    story.append(Paragraph(f"<b>Date Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", meta_style))
    story.append(Spacer(1, 20))

    # Identifiers
    story.append(Paragraph(f"<b>Seed Identifiers & Suspect Profiles</b>", styles['Heading2']))
    story.append(Spacer(1, 8))
    
    for identifier in identifiers:
        story.append(Paragraph(f"• <b>{identifier.type.value.upper()}</b>: {identifier.raw_value} (Normalized: {identifier.normalized_value})", meta_style))
        findings = db.query(Finding).filter(Finding.identifier_id == identifier.id).all()
        for f in findings:
            story.append(Paragraph(f"   - <i>{f.connector_name} ({f.result_type})</i>: {f.result_value} [Confidence: {f.confidence}]", meta_style))
        story.append(Spacer(1, 10))

    story.append(Spacer(1, 15))

    # Case Notes
    story.append(Paragraph(f"<b>Investigator Case Notes</b>", styles['Heading2']))
    story.append(Spacer(1, 8))
    if notes:
        for note in notes:
            story.append(Paragraph(f"<b>Agent {note.author_id}</b> ({note.created_at.strftime('%Y-%m-%d %H:%M:%S')}):", meta_style))
            story.append(Paragraph(f"{note.text}", meta_style))
            story.append(Spacer(1, 8))
    else:
        story.append(Paragraph("No notes added to this case yet.", meta_style))

    doc.build(story)
    buffer.seek(0)
    
    headers = {"Content-Disposition": f"attachment; filename=ERakshak_Dossier_{case_id}.pdf"}
    return StreamingResponse(buffer, headers=headers, media_type="application/pdf")