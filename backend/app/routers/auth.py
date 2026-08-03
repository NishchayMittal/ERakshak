from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.audit import log_action
from app.auth import create_access_token, hash_password, verify_password, get_current_investigator, is_strong_password
from app.database import get_db
from app.models import Investigator, AuditLog
from app.schemas import InvestigatorCreate, InvestigatorOut, Token, AuditLogOut

router = APIRouter(prefix="/auth", tags=["auth"])


class InvestigatorUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1)
    password: str | None = Field(default=None, min_length=8)


@router.post("/register", response_model=InvestigatorOut, status_code=status.HTTP_201_CREATED)
def register(payload: InvestigatorCreate, db: Session = Depends(get_db)):
    existing = db.query(Investigator).filter(Investigator.badge_id == payload.badge_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Badge ID already registered")

    if not is_strong_password(payload.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password too weak. Must be 8+ chars with uppercase, lowercase, digit, and special character."
        )

    investigator = Investigator(
        badge_id=payload.badge_id,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        is_active=payload.is_active,
    )
    db.add(investigator)
    db.commit()
    db.refresh(investigator)
    log_action(db, "investigator.register", investigator_id=investigator.id, detail={"badge_id": investigator.badge_id})
    return investigator


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    investigator = db.query(Investigator).filter(Investigator.badge_id == form_data.username).first()
    
    if not investigator:
        # Check if the database is completely empty; if so, create the default user
        if db.query(Investigator).count() == 0 and form_data.username == "INV-001":
            investigator = Investigator(
                badge_id="INV-001",
                full_name="Leon Lobo",
                hashed_password=hash_password("Password123!"),
                is_active=True,
                is_approved=True
            )
            db.add(investigator)
            db.commit()
            db.refresh(investigator)
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Badge ID is not registered.")

    if not verify_password(form_data.password, investigator.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid security passphrase.")

    # Lead Investigator (INV-001) is automatically approved
    if investigator.badge_id == "INV-001" and not investigator.is_approved:
        investigator.is_approved = True
        db.commit()

    if not investigator.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account pending approval by Lead Investigator."
        )

    token = create_access_token(investigator.badge_id)
    log_action(db, "investigator.login", investigator_id=investigator.id, detail={"badge_id": investigator.badge_id})
    return Token(
        access_token=token,
        badge_id=investigator.badge_id,
        full_name=investigator.full_name
    )


@router.post("/signup", response_model=InvestigatorOut, status_code=status.HTTP_201_CREATED)
def signup(payload: InvestigatorCreate, db: Session = Depends(get_db)):
    existing = db.query(Investigator).filter(Investigator.badge_id == payload.badge_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Badge ID already registered")

    if not is_strong_password(payload.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passphrase too weak. Must be 8+ chars with uppercase, lowercase, digit, and special character (!@#$%^&*()_+-=)."
        )

    investigator = Investigator(
        badge_id=payload.badge_id,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        is_active=True,
        is_approved=False
    )
    db.add(investigator)
    db.commit()
    db.refresh(investigator)
    log_action(db, "investigator.signup", investigator_id=investigator.id, detail={"badge_id": investigator.badge_id})
    return investigator


@router.get("/pending-approvals", response_model=list[InvestigatorOut])
def get_pending_approvals(
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    if current_investigator.badge_id != "INV-001":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the Lead Investigator can view pending approvals.")
    pending = db.query(Investigator).filter(Investigator.is_approved == False).all()
    return pending


@router.post("/approve/{investigator_id}")
def approve_investigator(
    investigator_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    if current_investigator.badge_id != "INV-001":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the Lead Investigator can approve signups.")
    target = db.query(Investigator).filter(Investigator.id == investigator_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investigator not found")
    target.is_approved = True
    db.commit()
    log_action(db, "investigator.approve", investigator_id=target.id, detail={"badge_id": target.badge_id})
    return {"status": "approved"}


@router.post("/reject/{investigator_id}")
def reject_investigator(
    investigator_id: str,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    if current_investigator.badge_id != "INV-001":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the Lead Investigator can reject signups.")
    target = db.query(Investigator).filter(Investigator.id == investigator_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investigator not found")
    db.delete(target)
    db.commit()
    log_action(db, "investigator.reject", investigator_id=investigator_id, detail={"badge_id": target.badge_id})
    return {"status": "rejected"}


@router.patch("/profile", response_model=InvestigatorOut)
def update_profile(
    payload: InvestigatorUpdate,
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    """
    Updates the authenticated investigator's profile (name and/or security passphrase).
    """
    if payload.full_name is not None:
        current_investigator.full_name = payload.full_name
    if payload.password is not None:
        if not is_strong_password(payload.password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New passphrase too weak. Must be 8+ chars with uppercase, lowercase, digit, and special character."
            )
        current_investigator.hashed_password = hash_password(payload.password)
    db.commit()
    db.refresh(current_investigator)
    log_action(
        db, 
        "investigator.update_profile", 
        investigator_id=current_investigator.id, 
        detail={"name_updated": payload.full_name is not None, "password_updated": payload.password is not None}
    )
    return current_investigator


@router.get("/audit-logs", response_model=list[AuditLogOut])
def get_audit_logs(
    db: Session = Depends(get_db),
    current_investigator: Investigator = Depends(get_current_investigator)
):
    return db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(30).all()