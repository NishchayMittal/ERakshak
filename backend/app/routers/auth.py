from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.audit import log_action
from app.auth import create_access_token, hash_password, verify_password, get_current_investigator
from app.database import get_db
from app.models import Investigator
from app.schemas import InvestigatorCreate, InvestigatorOut, Token

router = APIRouter(prefix="/auth", tags=["auth"])


class InvestigatorUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1)
    password: str | None = Field(default=None, min_length=8)


@router.post("/register", response_model=InvestigatorOut, status_code=status.HTTP_201_CREATED)
def register(payload: InvestigatorCreate, db: Session = Depends(get_db)):
    existing = db.query(Investigator).filter(Investigator.badge_id == payload.badge_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Badge ID already registered")

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
    if not investigator or not verify_password(form_data.password, investigator.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(investigator.badge_id)
    log_action(db, "investigator.login", investigator_id=investigator.id, detail={"badge_id": investigator.badge_id})
    return Token(access_token=token)


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