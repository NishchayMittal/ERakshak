import asyncio
import os
import uuid
import shutil

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session

from app.audit import log_action
from app.auth import get_current_investigator
from app.connectors.base import registry
from app.database import get_db
from app.models import Case, Finding, Identifier, Investigator
from app.normalize import detect_type, normalize
from app.schemas import FindingOut, IdentifierCreate, IdentifierOut


router = APIRouter(prefix="/identifiers", tags=["identifiers"])


@router.post("/upload")
def upload_file(
    file: UploadFile = File(...),
    current_investigator: Investigator = Depends(get_current_investigator),
):
    # Ensure uploads directory exists
    uploads_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "resources", "uploads")
    )
    os.makedirs(uploads_dir, exist_ok=True)
    
    # Create a unique directory under uploads to prevent filename collisions
    upload_id = uuid.uuid4().hex
    unique_dir = os.path.join(uploads_dir, upload_id)
    os.makedirs(unique_dir, exist_ok=True)
    
    # Format original filename (replace spaces with underscores)
    orig_name = (file.filename or "upload.png").replace(" ", "_")
    filepath = os.path.join(unique_dir, orig_name)
    
    # Save the file
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    relative_path = f"{upload_id}/{orig_name}"
    return {"filepath": filepath, "filename": relative_path}


@router.post("/suspects/upload")
def upload_suspect(
    name: str,
    file: UploadFile = File(...),
    current_investigator: Investigator = Depends(get_current_investigator),
):
    import re
    suspects_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "resources", "suspects")
    )
    os.makedirs(suspects_dir, exist_ok=True)
    
    ext = os.path.splitext(file.filename or "")[1]
    if not ext.lower() in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]:
        ext = ".png" # default fallback
        
    sanitized_name = name.strip().lower().replace(" ", "_")
    sanitized_name = "".join(c for c in sanitized_name if c.isalnum() or c == "_")
    sanitized_name = re.sub(r'_+', '_', sanitized_name)
    if not sanitized_name:
        sanitized_name = f"suspect_{uuid.uuid4().hex[:8]}"
        
    if not sanitized_name.startswith("suspect_"):
        sanitized_name = f"suspect_{sanitized_name}"
        
    counter = 1
    filename = f"{sanitized_name}{ext}"
    filepath = os.path.join(suspects_dir, filename)
    while os.path.exists(filepath):
        counter += 1
        filename = f"{sanitized_name}_{counter}{ext}"
        filepath = os.path.join(suspects_dir, filename)
        
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    return {"filename": filename, "label": filename.replace("_", " ").title()}


@router.get("/suspects")
def list_suspects(
    current_investigator: Investigator = Depends(get_current_investigator),
):
    import re
    suspects_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "resources", "suspects")
    )
    os.makedirs(suspects_dir, exist_ok=True)
    
    suspect_map = {}
    for fname in os.listdir(suspects_dir):
        if fname.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp")):
            base, ext = os.path.splitext(fname)
            clean_base = base
            if clean_base.startswith("suspect_"):
                clean_base = clean_base[len("suspect_"):]
            
            clean_base = re.sub(r'_\d+$', '', clean_base)
            suspect_key = clean_base.strip().lower()
            label = suspect_key.replace("_", " ").title()
            
            if suspect_key not in suspect_map:
                suspect_map[suspect_key] = {
                    "name": suspect_key,
                    "label": label,
                    "photos": []
                }
            
            suspect_map[suspect_key]["photos"].append({
                "filename": fname,
                "url": f"/static/suspects/{fname}"
            })
            
    return list(suspect_map.values())


@router.delete("/suspects/{filename}")
def delete_suspect_photo(
    filename: str,
    current_investigator: Investigator = Depends(get_current_investigator),
):
    suspects_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "resources", "suspects")
    )
    if "/" in filename or "\\" in filename or filename == "..":
        raise HTTPException(status_code=400, detail="Invalid filename")
        
    filepath = os.path.join(suspects_dir, filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        return {"status": "success", "message": f"Photo {filename} deleted"}
    else:
        raise HTTPException(status_code=404, detail="File not found")


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


@router.post("/{identifier_id}/run-connectors")
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

    from app.worker import dispatch_task
    dispatch_task(identifier.case_id, identifier.id, current_investigator.id, 0)
    return {"status": "queued", "message": "Connectors are running in the background"}


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