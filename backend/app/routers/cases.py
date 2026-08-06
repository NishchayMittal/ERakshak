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
from app.models import Case, Investigator, Identifier, Finding, CaseNote, LinkFeedback, AuditLog, Alert
from app.schemas import CaseCreate, CaseOut, CaseUpdate, LinkFeedbackCreate, LinkFeedbackOut, EvidencePackOut, AlertOut
from app.correlation.matcher import trigger_background_retrain
from app.narrative import answer_question_about_evidence, generate_narrative
from app.worker import dispatch_rag_reindex
from app.compiler import compile_evidence_pack


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
    dispatch_rag_reindex(case.id, current_investigator.id)
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


@router.get("/cross-correlate")
def cross_correlate_cases(
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator),
):
    """Find identifiers that appear across multiple cases for this investigator."""
    from sqlalchemy import func, distinct

    cases = (
        db.query(Case)
        .filter(Case.lead_investigator_id == current_investigator.id)
        .all()
    )

    if len(cases) < 2:
        return {
            "correlations": [],
            "total_shared_identifiers": 0,
            "cases_analyzed": len(cases),
        }

    case_ids = [c.id for c in cases]
    case_lookup = {c.id: c for c in cases}

    # Find normalized_values that appear in more than one distinct case
    shared_rows = (
        db.query(
            Identifier.normalized_value,
            Identifier.type,
            func.count(distinct(Identifier.case_id)).label("case_count"),
        )
        .filter(Identifier.case_id.in_(case_ids))
        .group_by(Identifier.normalized_value, Identifier.type)
        .having(func.count(distinct(Identifier.case_id)) > 1)
        .all()
    )

    correlations = []
    for norm_val, id_type, case_count in shared_rows:
        # Fetch every identifier row matching this normalized value across the cases
        matching_ids = (
            db.query(Identifier)
            .filter(
                Identifier.case_id.in_(case_ids),
                Identifier.normalized_value == norm_val,
            )
            .all()
        )

        involved_cases = []
        seen_case_ids: set[str] = set()
        for mid in matching_ids:
            case_obj = case_lookup.get(mid.case_id)
            if case_obj and mid.case_id not in seen_case_ids:
                seen_case_ids.add(mid.case_id)
                involved_cases.append({
                    "case_id": case_obj.id,
                    "case_title": case_obj.title,
                    "identifier_id": mid.id,
                    "type": mid.type.value if hasattr(mid.type, "value") else str(mid.type),
                    "raw_value": mid.raw_value,
                    "source": mid.source,
                })

        correlations.append({
            "normalized_value": norm_val,
            "type": id_type.value if hasattr(id_type, "value") else str(id_type),
            "case_count": len(involved_cases),
            "cases": involved_cases,
        })

    # Most-shared first
    correlations.sort(key=lambda x: x["case_count"], reverse=True)

    return {
        "correlations": correlations,
        "total_shared_identifiers": len(correlations),
        "cases_analyzed": len(cases),
    }


# ─── Watchlist & Alerts ───

@router.patch("/{case_id}/watch")
def toggle_watch(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator),
):
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    case.is_watched = not case.is_watched
    db.commit()
    db.refresh(case)
    log_action(db, "case.watch_toggle", investigator_id=current_investigator.id, case_id=case.id,
               detail={"is_watched": case.is_watched})
    return {"case_id": case.id, "is_watched": case.is_watched}


@router.get("/alerts/list", response_model=list[AlertOut])
def list_alerts(
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator),
):
    return (
        db.query(Alert)
        .filter(Alert.investigator_id == current_investigator.id)
        .order_by(Alert.created_at.desc())
        .limit(50)
        .all()
    )


@router.get("/alerts/unread-count")
def unread_alert_count(
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator),
):
    count = db.query(Alert).filter(
        Alert.investigator_id == current_investigator.id,
        Alert.is_read == False,
    ).count()
    return {"unread_count": count}


@router.patch("/alerts/{alert_id}/read")
def mark_alert_read(
    alert_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator),
):
    alert = db.query(Alert).filter(
        Alert.id == alert_id,
        Alert.investigator_id == current_investigator.id,
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = True
    db.commit()
    return {"status": "ok"}


@router.patch("/alerts/read-all")
def mark_all_alerts_read(
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator),
):
    db.query(Alert).filter(
        Alert.investigator_id == current_investigator.id,
        Alert.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"status": "ok"}


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
        dispatch_rag_reindex(case.id, current_investigator.id)

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


class ChatRequest(BaseModel):
    question: str


class RagRetrieveRequest(BaseModel):
    question: str
    top_k: int = 5


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

        from app.worker import dispatch_task
        dispatch_task(case_id, db_id.id, current_investigator.id, 0)

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

    dispatch_rag_reindex(case_id, current_investigator.id)

    return {
        "ok": True,
        "jobId": "pipeline-job-123",
        "ambiguous": is_ambiguous,
        "ambiguousFieldsNeeded": fields_needed
    }


@router.get("/{case_id}/identifiers")
def get_case_identifiers(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    identifiers = db.query(Identifier).filter(
        Identifier.case_id == case_id,
        Identifier.source == "manual_intake"
    ).order_by(Identifier.timestamp.desc()).all()
    
    return [
        {
            "id": i.id,
            "type": i.type.value if hasattr(i.type, "value") else str(i.type),
            "raw_value": i.raw_value,
            "normalized_value": i.normalized_value,
            "confidence": i.confidence,
            "source": i.source,
            "timestamp": i.timestamp.isoformat()
        } for i in identifiers
    ]


@router.delete("/{case_id}/identifiers/{identifier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_case_identifier(
    case_id: str,
    identifier_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    identifier = db.query(Identifier).filter(
        Identifier.id == identifier_id,
        Identifier.case_id == case_id
    ).first()

    if not identifier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Identifier not found")

    # Delete all dependent data
    _delete_photo_files([identifier])
    db.query(Finding).filter(Finding.identifier_id == identifier_id).delete(synchronize_session=False)

    db.delete(identifier)
    db.commit()

    log_action(
        db,
        "identifier.delete",
        investigator_id=current_investigator.id,
        case_id=case_id,
        detail={"identifier_id": identifier_id}
    )

    return None


@router.get("/{case_id}/entities/{entity_id}/graph")
def get_entity_graph(
    case_id: str,
    entity_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    return get_case_graph(case_id, db, current_investigator)


@router.get("/{case_id}/entity/profile")
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


@router.get("/{case_id}/entity/timeline")
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
    dispatch_rag_reindex(case_id, current_investigator.id)

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
    dispatch_rag_reindex(case_id, current_investigator.id)

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


@router.post("/{case_id}/rag/retrieve")
def retrieve_case_chunks(
    case_id: str,
    payload: RagRetrieveRequest,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    evidence_pack = compile_evidence_pack(case_id, db, current_investigator.id)


    from app.rag import ensure_case_indexed, retrieve_case_chunks as retrieve_indexed_chunks

    ensure_case_indexed(evidence_pack)
    chunks = retrieve_indexed_chunks(case_id, payload.question, top_k=payload.top_k)
    return {
        "case_id": case_id,
        "question": payload.question,
        "top_k": payload.top_k,
        "chunks": chunks,
    }


@router.post("/{case_id}/chat")
def chat_with_evidence(
    case_id: str,
    chat_request: ChatRequest,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    """Chat with the evidence pack using local RAG first, then remote fallback."""
    # Validate case access
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    # Compile the evidence pack
    evidence_pack = compile_evidence_pack(case_id, db, current_investigator.id)


    answer = answer_question_about_evidence(evidence_pack, chat_request.question)
    return {
        "answer": answer,
        "question": chat_request.question,
        "case_id": case_id,
    }


@router.get("/{case_id}/evidence", response_model=EvidencePackOut)
def get_case_evidence_pack(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    evidence_pack = compile_evidence_pack(case_id, db, current_investigator.id)
    from app.crypto import sign_payload
    evidence_pack["digital_signature"] = sign_payload(evidence_pack)
    return evidence_pack


@router.get("/{case_id}/export/json", response_model=EvidencePackOut)
def export_case_json(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    evidence_pack = compile_evidence_pack(case_id, db, current_investigator.id)
    from app.crypto import sign_payload
    evidence_pack["digital_signature"] = sign_payload(evidence_pack)
    return evidence_pack


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

    story.append(Spacer(1, 20))
    story.append(Paragraph(f"<b>Digital Signature (e-Rakshak Audit)</b>", styles['Heading2']))
    story.append(Spacer(1, 8))
    
    from app.crypto import sign_payload
    sig = sign_payload(evidence_pack)
    sig_style = ParagraphStyle('SigStyle', parent=styles['Normal'], fontName='Courier', fontSize=7)
    story.append(Paragraph(sig, sig_style))

    doc.build(story)
    buffer.seek(0)
    
    headers = {"Content-Disposition": f"attachment; filename=ERakshak_Dossier_{case_id}.pdf"}
    return StreamingResponse(buffer, headers=headers, media_type="application/pdf")


def _delete_photo_files(identifiers: list[Identifier]):
    """Delete uploaded files associated with photo identifiers."""
    import os
    import shutil
    from app.models import IdentifierType

    uploads_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "resources", "uploads")
    )

    for i in identifiers:
        if i.type == IdentifierType.photo:
            for val in (i.raw_value, i.normalized_value):
                if not val:
                    continue
                
                # Check for upload_id subfolder (like "someuuid/filename.png")
                val_clean = val.replace("\\", "/")
                parts = val_clean.split('/')
                if len(parts) >= 2:
                    upload_id = parts[0]
                    # Verify upload_id is a 32-character hex UUID
                    if len(upload_id) == 32:
                        dir_to_delete = os.path.join(uploads_dir, upload_id)
                        if os.path.exists(dir_to_delete) and os.path.isdir(dir_to_delete):
                            try:
                                shutil.rmtree(dir_to_delete)
                            except Exception:
                                pass
                
                # Also try standard path check for flat files or direct references
                try:
                    resolved_file_path = val
                    if not os.path.isabs(resolved_file_path):
                        resolved_file_path = os.path.join(uploads_dir, val)
                    if os.path.exists(resolved_file_path) and os.path.isfile(resolved_file_path):
                        os.remove(resolved_file_path)
                        # Clean up empty parent folder
                        parent_dir = os.path.dirname(resolved_file_path)
                        if parent_dir != uploads_dir and os.path.exists(parent_dir) and not os.listdir(parent_dir):
                            os.rmdir(parent_dir)
                except Exception:
                    pass


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
    identifiers = db.query(Identifier).filter(Identifier.case_id == case_id).all()
    _delete_photo_files(identifiers)

    identifier_ids = [i.id for i in identifiers]
    if identifier_ids:
        db.query(Finding).filter(Finding.identifier_id.in_(identifier_ids)).delete(synchronize_session=False)

    db.query(Identifier).filter(Identifier.case_id == case_id).delete(synchronize_session=False)
    db.query(CaseNote).filter(CaseNote.case_id == case_id).delete(synchronize_session=False)
    db.query(LinkFeedback).filter(LinkFeedback.case_id == case_id).delete(synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.case_id == case_id).delete(synchronize_session=False)
    
    from app.models import Notification
    db.query(Notification).filter(Notification.case_id == case_id).delete(synchronize_session=False)

    db.delete(case)
    db.commit()

    return None

class RetentionPayload(BaseModel):
    days: int

@router.patch("/{case_id}/retention", response_model=CaseOut)
def set_retention(
    case_id: str,
    payload: RetentionPayload,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
        
    from datetime import datetime, timedelta, timezone
    case.expires_at = datetime.now(timezone.utc) + timedelta(days=payload.days)
    db.commit()
    db.refresh(case)
    
    log_action(db, "case.set_retention", investigator_id=current_investigator.id, case_id=case.id, detail={"days": payload.days, "expires_at": case.expires_at.isoformat()})
    return case


# Define COUNTRY_COORDS mapping for Geo Map
COUNTRY_COORDS = {
    "US": (37.0902, -95.7129),
    "GB": (55.3781, -3.4360),
    "RU": (61.5240, 105.3188),
    "CN": (35.8617, 104.1954),
    "IN": (20.5937, 78.9629),
    "BR": (-14.2350, -51.9253),
    "AU": (-25.2744, 133.7751),
    "JP": (36.2048, 138.2529),
    "DE": (51.1657, 10.4515),
    "FR": (46.2276, 2.2137),
    "CA": (56.1304, -106.3468),
    "SG": (1.3521, 103.8198),
    "IS": (64.9631, -19.0208)
}

@router.get("/{case_id}/geo")
def get_case_geo(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    if case_id == "global":
        findings = db.query(Finding).all()
    else:
        case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == current_investigator.id).first()
        if not case:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
        findings = db.query(Finding).join(Identifier).filter(Identifier.case_id == case_id).all()
    
    nodes = []
    seen_labels = set()
    used_locations = set()
    
    import random

    for f in findings:
        payload = f.raw_payload or {}
        lat, lon, label = None, None, None

        # 1. IP Geolocation (Exact)
        if f.connector_name == "ip_geoloc":
            if "latitude" in payload and "longitude" in payload:
                lat = float(payload["latitude"])
                lon = float(payload["longitude"])
                label = f"IP: {f.identifier.raw_value}"
        
        # 1b. EXIF Photo Geotag (Exact)
        elif f.connector_name == "exif_extractor" and f.result_type == "geolocation":
            if "lat" in payload and "lon" in payload:
                import os
                lat = float(payload["lat"])
                lon = float(payload["lon"])
                filename = os.path.basename(f.identifier.raw_value)
                label = f"Photo Geotag ({filename}): {f.result_value}"
        
        # 2. WHOIS / Registrant Country
        elif f.connector_name == "whois_rdap" and "country" in payload:
            cc = str(payload["country"]).upper()
            if cc in COUNTRY_COORDS:
                lat, lon = COUNTRY_COORDS[cc]
                label = f"Domain Reg: {cc}"
                
        # 2b. Domain TLD heuristics (for domains like google.com)
        elif f.connector_name in ["whois_rdap", "dns_resolver", "wayback_cdx"]:
            domain = f.identifier.raw_value.lower()
            if domain:
                if domain.endswith(".com") or domain.endswith(".net") or domain.endswith(".org"):
                    lat, lon = COUNTRY_COORDS["US"]
                    label = domain
                elif domain.endswith(".uk"):
                    lat, lon = COUNTRY_COORDS["GB"]
                    label = domain
                elif domain.endswith(".in"):
                    lat, lon = COUNTRY_COORDS["IN"]
                    label = domain
                elif domain.endswith(".ru"):
                    lat, lon = COUNTRY_COORDS["RU"]
                    label = domain
                elif domain.endswith(".jp"):
                    lat, lon = COUNTRY_COORDS["JP"]
                    label = domain

        # 3. Phone Number Country
        elif f.connector_name == "phone_lookup" and "country_code" in payload:
            cc = str(payload["country_code"]).upper()
            if cc in COUNTRY_COORDS:
                lat, lon = COUNTRY_COORDS[cc]
                label = f"Phone Origin: {cc}"

        # 4. Leak data country hints
        elif f.connector_name == "breach_lookup" and isinstance(payload, list):
            for leak in payload:
                if "domain" in leak and leak["domain"].endswith(".ru"):
                    lat, lon = COUNTRY_COORDS["RU"]
                    label = "Leak (RU)"
                    break

        if lat is not None and lon is not None:
            node_label = label or f"Asset: {f.id}"
            
            # Avoid duplicate labels
            if node_label in seen_labels:
                continue
            seen_labels.add(node_label)
            
            # Add jitter if location is already occupied
            while True:
                loc_key = f"{round(lat, 1)},{round(lon, 1)}"
                if loc_key not in used_locations:
                    used_locations.add(loc_key)
                    break
                # Increased jitter drastically so large text labels don't overlap
                lat += random.uniform(-12.0, 12.0)
                lon += random.uniform(-12.0, 12.0)

            nodes.append({
                "id": str(f.id),
                "lat": lat,
                "lng": lon,
                "label": node_label,
                "source": f.connector_name
            })

    arcs = []
    
    if len(nodes) > 1:
        # Generate simple daisy-chain arcs between real nodes for visualization
        for i in range(len(nodes) - 1):
            arcs.append({
                "startLat": nodes[i]["lat"],
                "startLng": nodes[i]["lng"],
                "endLat": nodes[i+1]["lat"],
                "endLng": nodes[i+1]["lng"],
                "label": "Correlated Flow"
            })
        # Close the loop
        arcs.append({
            "startLat": nodes[-1]["lat"],
            "startLng": nodes[-1]["lng"],
            "endLat": nodes[0]["lat"],
            "endLng": nodes[0]["lng"],
            "label": "Correlated Flow"
        })

    return {"nodes": nodes, "arcs": arcs}

@router.get("/notifications", response_model=list[dict])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: Investigator = Depends(get_current_investigator)
):
    """
    Get recent background monitor notifications for all cases owned by the investigator.
    """
    from app.models import Notification
    from sqlalchemy import desc
    
    # Get all case IDs for this investigator
    case_ids = [c.id for c in db.query(Case).filter(Case.lead_investigator_id == current_user.id).all()]
    if not case_ids:
        return []
        
    notifications = db.query(Notification).filter(
        Notification.case_id.in_(case_ids)
    ).order_by(desc(Notification.created_at)).limit(50).all()
    
    return [
        {
            "id": n.id,
            "case_id": n.case_id,
            "message": n.message,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat()
        } for n in notifications
    ]

@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: Investigator = Depends(get_current_investigator)
):
    from app.models import Notification
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    # Simple check that it belongs to one of their cases
    if notif:
        case = db.query(Case).filter(Case.id == notif.case_id).first()
        if case and case.lead_investigator_id == current_user.id:
            notif.is_read = True
            db.commit()
    return {"status": "ok"}


# ─── Indian Legal Section Mapping ───

@router.get("/{case_id}/legal-mapping")
def get_legal_mapping(
    case_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator),
):
    """
    Maps all OSINT findings for a case to relevant Indian legal provisions:
    IT Act 2000, Bharatiya Nyaya Sanhita 2023, and PMLA 2002.
    """
    case = db.query(Case).filter(
        Case.id == case_id,
        Case.lead_investigator_id == current_investigator.id,
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    from app.analytics.legal_mapping import run_legal_mapping
    return run_legal_mapping(db, case_id)
