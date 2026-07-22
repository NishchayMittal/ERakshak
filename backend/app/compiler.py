from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import networkx as nx
from rapidfuzz import fuzz

from app.models import Case, Investigator, Identifier, Finding, CaseNote
from app.schemas import EvidencePackOut

def serialize_graph(G: nx.MultiDiGraph) -> dict:
    nodes_list = []
    for node_id, data in G.nodes(data=True):
        sources = set()
        for u, v, k, edge_data in G.edges(keys=True, data=True):
            if u == node_id or v == node_id:
                prov = edge_data.get("source") or edge_data.get("sourceProvenance")
                if prov:
                    sources.add(prov)
        source_count = max(len(sources), 1)

        is_pivot = data.get("pivot", False) or G.degree(node_id) >= 3

        raw_type = data.get("type", "username")
        if raw_type in ("name", "photo"):
            node_type = "person"
        elif raw_type == "other":
            node_type = "username"
        else:
            node_type = raw_type

        nodes_list.append({
            "id": node_id,
            "label": data.get("label", node_id),
            "type": node_type,
            "confidence": float(data.get("confidence", 1.0)),
            "sourceCount": source_count,
            "pivot": is_pivot,
            "expand_investigation": is_pivot,
            "timestamp": data.get("timestamp", ""),
            "profile_url": data.get("profile_url", "")
        })

    edges_list = []
    edge_idx = 1
    for u, v, k, data in G.edges(keys=True, data=True):
        edge_id = data.get("id") or f"e_{edge_idx}"
        edge_idx += 1
        
        relation_type = data.get("relationType") or data.get("label", "connected")
        source_prov = data.get("sourceProvenance")
        if not source_prov:
            raw_source = data.get("source")
            if raw_source and raw_source != u and raw_source != v:
                source_prov = raw_source
            else:
                source_prov = "unknown"

        # Map backend connector names to front-end filter keys
        source_prov_map = {
            "whois_rdap": "whois",
            "crtsh": "crt.sh",
            "wayback_cdx": "wayback",
            "username_enumeration": "sherlock",
            "breach_lookup": "breach_lookup",
            "dns_resolver": "dns_resolver",
            "github_commit_email": "github_commit_email",
            "phone_lookup": "phone_lookup",
            "wallet_lookup": "wallet_lookup",
            "face_matcher": "face_matcher",
            "breach_repository_demo": "breach_lookup",
            "wikipedia_lookup": "wikipedia",
        }
        source_prov = source_prov_map.get(source_prov, source_prov)

        edges_list.append({
            "id": edge_id,
            "source": u,
            "target": v,
            "relationType": relation_type,
            "confidence": float(data.get("confidence", 1.0)),
            "sourceProvenance": source_prov,
            "shapFeatures": data.get("shapFeatures") or data.get("shap_features", {}),
            "timestamp": data.get("timestamp", "")
        })

    return {
        "nodes": nodes_list,
        "edges": edges_list
    }


def generate_case_graph(case_id: str, db: Session, investigator_id: str) -> dict:
    case = (
        db.query(Case)
        .filter(Case.id == case_id, Case.lead_investigator_id == investigator_id)
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
    id_metadata = {}
    for identifier in identifiers:
        node_id = identifier.normalized_value
        id_map[identifier.id] = node_id
        id_metadata[identifier.id] = identifier.identifier_metadata or {}
        if not G.has_node(node_id):
            G.add_node(
                node_id,
                label=node_id,
                type=identifier.type.value,
                node_class="identifier",
                id=identifier.id,
                confidence=identifier.confidence,
                timestamp=identifier.timestamp.isoformat(),
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
        timestamp_str = finding.discovered_at.isoformat()

        # Boost confidence based on name disambiguation anchors if present
        metadata = id_metadata.get(finding.identifier_id) or {}
        if metadata:
            city_anchor = metadata.get("city")
            employer_anchor = metadata.get("employer")
            search_str = (result_val + " " + str(finding.raw_payload or "")).lower()
            
            if city_anchor and city_anchor.lower() in search_str:
                confidence = min(1.0, confidence * 1.25)
            if employer_anchor and employer_anchor.lower() in search_str:
                confidence = min(1.0, confidence * 1.25)

        target_node_id = None
        target_type = "other"
        edge_label = result_type

        # Parse specific findings
        if result_type == "subdomain":
            target_node_id = result_val.strip().lower()
            target_type = "domain"
        elif result_type == "registrant_email":
            target_node_id = result_val.strip().lower()
            target_type = "email"
        elif result_type == "registrant_phone":
            target_node_id = result_val.strip()
            target_type = "phone"
        elif result_type == "registrant_name":
            target_node_id = result_val.split(" (")[0].strip()
            target_type = "person" # map to person in frontend types
            if seed_names:
                match_score = max(fuzz.token_set_ratio(n, target_node_id) / 100.0 for n in seed_names)
                confidence = max(confidence * match_score, 0.1)
        elif result_type == "registrant_org":
            target_node_id = result_val.split(" (")[0].strip()
            target_type = "domain"
        elif result_type == "social_profile":
            if "Profile: " in result_val:
                target_node_id = result_val.split("Profile: ")[1].strip()
            else:
                target_node_id = result_val.strip()
            target_type = "username" # map to username or person
        elif result_type == "face_similarity":
            lower_val = result_val.lower()
            if "match: " in lower_val:
                target_node_id = lower_val.split("match: ")[1].split(" (similarity:")[0].strip().title()
            else:
                target_node_id = result_val.strip().title()
            target_type = "person"
        elif result_type == "leak_record":
            payload = finding.raw_payload or {}
            breach_name = payload.get("breach")
            if not breach_name:
                if "Compromised in " in result_val:
                    breach_name = result_val.split("Compromised in ")[1].split(" (")[0].strip()
                else:
                    breach_name = result_val.split(" (")[0].strip()
            
            target_node_id = breach_name
            target_type = "username"
            
            payload = finding.raw_payload or {}
            ip = payload.get("ip_address")
            if ip:
                ip_node_id = ip.strip()
                if not G.has_node(ip_node_id):
                    G.add_node(
                        ip_node_id,
                        label=ip_node_id,
                        type="domain", # map to domain or other in frontend
                        node_class="finding",
                        id=finding.id,
                        confidence=1.0,
                        timestamp=timestamp_str,
                    )
                G.add_edge(
                    parent_node_id,
                    ip_node_id,
                    label="leak_ip",
                    source=source_connector,
                    confidence=1.0,
                    timestamp=timestamp_str,
                )
        elif result_type == "archived_page":
            payload = finding.raw_payload or {}
            orig_url = payload.get("original_url")
            if orig_url:
                target_node_id = orig_url.strip()
                target_type = "domain"
        elif result_type in ("dns_a_record", "dns_aaaa_record", "nameservers"):
            vals = [v.strip() for v in result_val.split(",") if v.strip()]
            for val in vals:
                if not G.has_node(val):
                    G.add_node(
                        val,
                        label=val,
                        type="domain",
                        node_class="finding",
                        id=f"{finding.id}_{val}",
                        confidence=float(confidence),
                        timestamp=timestamp_str,
                    )
                G.add_edge(
                    parent_node_id,
                    val,
                    label=result_type,
                    source=source_connector,
                    confidence=float(confidence),
                    timestamp=timestamp_str,
                )
        elif result_type == "dns_mx_record":
            target_node_id = result_val.split(" - ")[-1].split(" (")[0].strip()
            target_type = "domain"
        elif result_type == "registrar":
            target_node_id = result_val.strip()
            target_type = "domain"
        elif result_type == "discovered_path":
            target_node_id = result_val.replace("Active Path: ", "").strip()
            target_type = "domain"
        elif result_type in ("reddit_profile", "instagram_profile", "linkedin_profile"):
            target_node_id = result_val
            target_type = "username"

        elif result_type == "wikipedia_entry":
            payload = finding.raw_payload or {}
            page_title = payload.get("page_title", "")
            page_url = payload.get("page_url", "")
            target_node_id = page_title or result_val
            target_type = "person"
            # Store profile_url for frontend linking (use page_url in addition to profile_url)
            if page_url and not payload.get("profile_url"):
                payload["profile_url"] = page_url

        if target_node_id:
            if not G.has_node(target_node_id):
                G.add_node(
                    target_node_id,
                    label=target_node_id,
                    type=target_type,
                    node_class="finding",
                    id=finding.id,
                    confidence=float(confidence),
                    timestamp=timestamp_str,
                    profile_url=(finding.raw_payload or {}).get("profile_url", "")
                )
            G.add_edge(
                parent_node_id,
                target_node_id,
                label=edge_label,
                source=source_connector,
                confidence=float(confidence),
                timestamp=timestamp_str,
            )

    # 3. Add correlated edges from correlation engine
    from app.correlation.matcher import compute_correlations
    correlations = compute_correlations(case_id, db)
    for link in correlations:
        if G.has_node(link["source"]) and G.has_node(link["target"]):
            G.add_edge(
                link["source"],
                link["target"],
                id=link["id"],
                relationType=link["relationType"],
                sourceProvenance=link["sourceProvenance"],
                confidence=link["confidence"],
                shap_features=link.get("shapFeatures") or link.get("shap_features", {}),
                timestamp=link.get("timestamp") or __import__('datetime').datetime.utcnow().isoformat()
            )

    # 4. Pivot detection (high degree)
    for node, degree in dict(G.degree()).items():
        if degree >= 3:
            G.nodes[node]["pivot"] = True
            G.nodes[node]["expand_investigation"] = True

    return serialize_graph(G)


def compile_evidence_pack(case_id: str, db: Session, investigator_id: str) -> dict:
    """
    Compiles all raw evidence, notes, and the correlated graph into a single JSON response
    (The 'Evidence Pack') for the front-end and the LLM reporting tool to consume.
    """
    case = db.query(Case).filter(Case.id == case_id, Case.lead_investigator_id == investigator_id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    identifiers = db.query(Identifier).filter(Identifier.case_id == case_id).all()
    notes = db.query(CaseNote).filter(CaseNote.case_id == case_id).all()
    
    # 1. Build Identifiers with nested findings
    identifiers_data = []
    for i in identifiers:
        findings_query = db.query(Finding).filter(Finding.identifier_id == i.id).all()
        findings_data = [{
            "id": f.id,
            "connector": f.connector_name,
            "type": f.result_type,
            "value": f.result_value,
            "confidence": f.confidence,
            "raw_payload": f.raw_payload,
            "discoveredAt": f.discovered_at.isoformat() if f.discovered_at else None,
            "discovered_at": f.discovered_at.isoformat() if f.discovered_at else None
        } for f in findings_query]
        
        identifiers_data.append({
            "id": i.id,
            "type": i.type.value,
            "raw_value": i.raw_value,
            "normalized_value": i.normalized_value,
            "confidence": i.confidence,
            "source": i.source,
            "findings": findings_data
        })

    # 2. Build Case Notes
    notes_data = [{
        "id": n.id,
        "case_id": n.case_id,
        "author_id": n.author_id,
        "text": n.text,
        "created_at": n.created_at
    } for n in notes]

    # 3. Generate the Graph (Nodes + Edges)
    graph_data = generate_case_graph(case_id, db, investigator_id)

    # Assemble Evidence Pack
    evidence_pack = {
        "case": {
            "title": case.title,
            "description": case.description,
            "status": case.status,
            "id": case.id,
            "lead_investigator_id": case.lead_investigator_id,
            "created_at": case.created_at
        },
        "identifiers": identifiers_data,
        "notes": notes_data,
        "graph": graph_data
    }
    
    return evidence_pack
