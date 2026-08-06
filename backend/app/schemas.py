from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import IdentifierType


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    badge_id: str
    full_name: str


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


class CaseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None


class CaseOut(CaseBase):
    id: str
    lead_investigator_id: str
    created_at: datetime
    is_watched: bool = False

    model_config = ConfigDict(from_attributes=True)


class IdentifierBase(BaseModel):
    type: IdentifierType | None = None
    raw_value: str
    normalized_value: str
    confidence: float = 1.0
    source: str = "manual_intake"
    case_id: str
    investigator_id: str
    identifier_metadata: dict | None = None


class IdentifierCreate(BaseModel):
    type: IdentifierType | None = None
    raw_value: str
    case_id: str
    confidence: float = 1.0
    source: str = "manual_intake"
    identifier_metadata: dict | None = None


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


class CaseNoteBase(BaseModel):
    case_id: str
    text: str


class CaseNoteCreate(CaseNoteBase):
    pass


class CaseNoteOut(CaseNoteBase):
    id: str
    author_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LinkFeedbackBase(BaseModel):
    case_id: str
    source_id: str
    target_id: str
    status: str


class LinkFeedbackCreate(LinkFeedbackBase):
    pass


class LinkFeedbackOut(LinkFeedbackBase):
    id: str
    investigator_id: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class EvidenceGraphNode(BaseModel):
    id: str
    label: str
    type: str
    confidence: float
    sourceCount: int
    pivot: bool
    expand_investigation: bool


class EvidenceGraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relationType: str
    confidence: float
    sourceProvenance: str
    shapFeatures: dict | None = None


class EvidenceGraph(BaseModel):
    nodes: list[EvidenceGraphNode]
    edges: list[EvidenceGraphEdge]


class EvidenceIdentifierOut(BaseModel):
    id: str
    type: str
    raw_value: str
    normalized_value: str
    confidence: float
    source: str
    findings: list[dict]


class EvidencePackOut(BaseModel):
    case: CaseOut
    identifiers: list[EvidenceIdentifierOut]
    notes: list[CaseNoteOut]
    graph: EvidenceGraph
    digital_signature: str | None = None


class AuditLogOut(BaseModel):
    id: str
    investigator_id: str | None
    case_id: str | None
    action: str
    detail: dict | None
    timestamp: datetime
    signature: str | None

    model_config = ConfigDict(from_attributes=True)


class AlertOut(BaseModel):
    id: str
    case_id: str
    investigator_id: str
    alert_type: str
    title: str
    detail: dict | None = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
