from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import networkx as nx
from networkx.readwrite import json_graph
from rapidfuzz import fuzz

from app.audit import log_action
from app.auth import get_current_investigator
from app.database import get_db
from app.models import Case, Investigator, Identifier, Finding
from app.schemas import CaseCreate, CaseOut


router = APIRouter(prefix="/cases", tags=["cases"])


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