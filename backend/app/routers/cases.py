from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
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
from app.models import Case, Investigator, Identifier, Finding, CaseNote, LinkFeedback, AuditLog
from app.schemas import CaseCreate, CaseOut, CaseUpdate, LinkFeedbackCreate, LinkFeedbackOut, EvidencePackOut
from app.correlation.matcher import trigger_background_retrain


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


@router.patch("/{case_id}", response_model=CaseOut)
def update_case(
    case_id: str,
    payload: CaseUpdate,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    updated_fields = {}
    if payload.title is not None:
        case.title = payload.title
        updated_fields["title"] = payload.title
    if payload.description is not None:
        case.description = payload.description
        updated_fields["description"] = payload.description
    if payload.status is not None:
        case.status = payload.status
        updated_fields["status"] = payload.status

    if updated_fields:
        db.commit()
        db.refresh(case)
        log_action(db, "case.update", investigator_id=current_investigator.id, case_id=case.id, detail=updated_fields)

    return case


from app.compiler import generate_case_graph

@router.get("/{case_id}/graph")
def get_case_graph(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator),
):
    return generate_case_graph(case_id, db, current_investigator.id)


class IdentifierInputItem(BaseModel):
    type: str
    rawValue: str
    metadata: dict | None = None


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
    created_identifiers = []
    
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
            investigator_id=current_investigator.id,
            identifier_metadata=item.metadata
        )
        db.add(db_id)
        db.commit()
        db.refresh(db_id)
        created_identifiers.append(db_id)

        log_action(
            db,
            "identifier.create",
            investigator_id=current_investigator.id,
            case_id=case_id,
            detail={"identifier_id": db_id.id, "type": db_id.type.value, "normalized_value": db_id.normalized_value},
        )

        from app.connectors.runner import run_connectors_and_pivot
        await run_connectors_and_pivot(db, db_id, current_investigator.id, depth=0)

    # Pre-link multiple seeds together if 2+ given (join as confirmed root edges)
    if len(created_identifiers) >= 2:
        for idx_a in range(len(created_identifiers)):
            for idx_b in range(idx_a + 1, len(created_identifiers)):
                id_a = created_identifiers[idx_a]
                id_b = created_identifiers[idx_b]
                # Check if feedback already exists to avoid duplication
                existing_fb = db.query(LinkFeedback).filter(
                    LinkFeedback.case_id == case_id,
                    LinkFeedback.source_id == id_a.id,
                    LinkFeedback.target_id == id_b.id
                ).first()
                if not existing_fb:
                    new_fb = LinkFeedback(
                        case_id=case_id,
                        source_id=id_a.id,
                        target_id=id_b.id,
                        status="confirmed",
                        investigator_id=current_investigator.id
                    )
                    db.add(new_fb)
                    db.commit()
                    log_action(
                        db,
                        "link.prelink_seeds",
                        investigator_id=current_investigator.id,
                        case_id=case_id,
                        detail={"source_id": id_a.id, "target_id": id_b.id, "status": "confirmed"}
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


@router.post("/{case_id}/feedback", response_model=LinkFeedbackOut, status_code=status.HTTP_201_CREATED)
def submit_link_feedback(
    case_id: str,
    payload: LinkFeedbackCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    feedback = LinkFeedback(
        case_id=case_id,
        source_id=payload.source_id,
        target_id=payload.target_id,
        status=payload.status,
        investigator_id=current_investigator.id
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    log_action(
        db, 
        "feedback.submit", 
        investigator_id=current_investigator.id, 
        case_id=case_id, 
        detail={"feedback_id": feedback.id, "source_id": payload.source_id, "target_id": payload.target_id, "status": payload.status}
    )

    # Trigger model retraining in background thread (P2's implementation)
    trigger_background_retrain(db)

    return feedback


@router.get("/{case_id}/feedback", response_model=list[LinkFeedbackOut])
def get_link_feedbacks(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    return db.query(LinkFeedback).filter(LinkFeedback.case_id == case_id).all()


from app.narrative import generate_narrative

@router.get("/{case_id}/narrative")
def get_case_narrative(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    # Case validation is handled inside compile_evidence_pack, 
    # but we can do it here for explicit 404
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    evidence_pack = compile_evidence_pack(case_id, db, current_investigator.id)
    narrative_text = generate_narrative(evidence_pack)
    
    return {
        "case_id": case_id,
        "narrative": narrative_text
    }


from app.compiler import compile_evidence_pack

@router.get("/{case_id}/export/json", response_model=EvidencePackOut)
def export_case_json(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    return compile_evidence_pack(case_id, db, current_investigator.id)


@router.get("/{case_id}/export/csv")
def export_case_csv(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    evidence_pack = compile_evidence_pack(case_id, db, current_investigator.id)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Identifier ID", "Identifier Type", "Raw Value", "Normalized Value", "Connector", "Finding Type", "Finding Value", "Confidence"])
    
    for i in evidence_pack["identifiers"]:
        if not i["findings"]:
            writer.writerow([i["id"], i["type"], i["raw_value"], i["normalized_value"], "N/A", "N/A", "N/A", i["confidence"]])
        for f in i["findings"]:
            writer.writerow([i["id"], i["type"], i["raw_value"], i["normalized_value"], f["connector"], f["type"], f["value"], f["confidence"]])

    output.seek(0)
    headers = {"Content-Disposition": f"attachment; filename=ERakshak_Dossier_{case_id}.csv"}
    return StreamingResponse(io.BytesIO(output.getvalue().encode('utf-8')), headers=headers, media_type="text/csv")


import re

@router.get("/{case_id}/export/pdf")
def export_case_pdf(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    evidence_pack = compile_evidence_pack(case_id, db, current_investigator.id)
    narrative_text = generate_narrative(evidence_pack)
    case_data = evidence_pack["case"]
    
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
    story.append(Paragraph(f"<b>Case Title:</b> {case_data['title']}", meta_style))
    story.append(Paragraph(f"<b>Status:</b> {case_data['status'].upper()}", meta_style))
    story.append(Paragraph(f"<b>Date Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", meta_style))
    story.append(Spacer(1, 20))

    # LLM Narrative Section
    story.append(Paragraph(f"<b>Executive Summary (AI Generated)</b>", styles['Heading2']))
    story.append(Spacer(1, 8))
    
    # Basic markdown parsing for reportlab
    parsed_narrative = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', narrative_text)
    parsed_narrative = re.sub(r'### (.*)', r'<b>\1</b>', parsed_narrative)
    parsed_narrative = parsed_narrative.replace('- ', '• ')
    parsed_narrative = parsed_narrative.replace('> [!WARNING]', '<b>[WARNING]</b>')
    
    for line in parsed_narrative.split('\n'):
        if line.strip():
            if line.startswith('> '):
                line = '<i>' + line[2:] + '</i>'
            story.append(Paragraph(line, meta_style))
            story.append(Spacer(1, 4))

    story.append(Spacer(1, 15))

    # Identifiers
    story.append(Paragraph(f"<b>Seed Identifiers & Suspect Profiles</b>", styles['Heading2']))
    story.append(Spacer(1, 8))
    
    for i in evidence_pack["identifiers"]:
        story.append(Paragraph(f"• <b>{i['type'].upper()}</b>: {i['raw_value']} (Normalized: {i['normalized_value']})", meta_style))
        for f in i["findings"]:
            story.append(Paragraph(f"   - <i>{f['connector']} ({f['type']})</i>: {f['value']} [Confidence: {f['confidence']}]", meta_style))
        story.append(Spacer(1, 10))

    story.append(Spacer(1, 15))

    # Case Notes
    story.append(Paragraph(f"<b>Investigator Case Notes</b>", styles['Heading2']))
    story.append(Spacer(1, 8))
    notes = evidence_pack.get("notes", [])
    if notes:
        for note in notes:
            story.append(Paragraph(f"<b>Agent {note['author_id']}</b> ({note['created_at']}):", meta_style))
            story.append(Paragraph(f"{note['text']}", meta_style))
            story.append(Spacer(1, 8))
    else:
        story.append(Paragraph("No notes added to this case yet.", meta_style))

    doc.build(story)
    buffer.seek(0)
    
    headers = {"Content-Disposition": f"attachment; filename=ERakshak_Dossier_{case_id}.pdf"}
    return StreamingResponse(buffer, headers=headers, media_type="application/pdf")


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_case(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    # Delete all dependent data
    identifier_ids = [i.id for i in db.query(Identifier).filter(Identifier.case_id == case_id).all()]
    if identifier_ids:
        db.query(Finding).filter(Finding.identifier_id.in_(identifier_ids)).delete(synchronize_session=False)

    db.query(Identifier).filter(Identifier.case_id == case_id).delete(synchronize_session=False)
    db.query(CaseNote).filter(CaseNote.case_id == case_id).delete(synchronize_session=False)
    db.query(LinkFeedback).filter(LinkFeedback.case_id == case_id).delete(synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.case_id == case_id).delete(synchronize_session=False)

    db.delete(case)
    db.commit()

    return None