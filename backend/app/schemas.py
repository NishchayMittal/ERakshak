from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import IdentifierType


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class InvestigatorBase(BaseModel):
    badge_id: str
    full_name: str
    is_active: bool = True


class InvestigatorCreate(InvestigatorBase):
    password: str = Field(min_length=8)


class InvestigatorOut(InvestigatorBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CaseBase(BaseModel):
    title: str
    description: str | None = None
    status: str = "open"


class CaseCreate(CaseBase):
    pass


class CaseOut(CaseBase):
    id: str
    lead_investigator_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IdentifierBase(BaseModel):
    type: IdentifierType | None = None
    raw_value: str
    normalized_value: str
    confidence: float = 1.0
    source: str = "manual_intake"
    case_id: str
    investigator_id: str


class IdentifierCreate(BaseModel):
    type: IdentifierType | None = None
    raw_value: str
    case_id: str
    confidence: float = 1.0
    source: str = "manual_intake"


class IdentifierOut(IdentifierBase):
    id: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class FindingBase(BaseModel):
    identifier_id: str
    connector_name: str
    result_type: str
    result_value: str
    confidence: float
    raw_payload: dict | None = None


class FindingCreate(FindingBase):
    pass


class FindingOut(FindingBase):
    id: str
    discovered_at: datetime

    model_config = ConfigDict(from_attributes=True)