from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, Enum as SAEnum, Float, ForeignKey, String, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class IdentifierType(str, Enum):
    email = "email"
    phone = "phone"
    domain = "domain"
    username = "username"
    wallet = "wallet"
    name = "name"
    photo = "photo"
    other = "other"
    ip = "ip"


class Investigator(Base):
    __tablename__ = "investigators"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    badge_id: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    led_cases = relationship("Case", back_populates="lead_investigator")
    identifiers = relationship("Identifier", back_populates="investigator")
    audit_logs = relationship("AuditLog", back_populates="investigator")


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, default="open", nullable=False)
    lead_investigator_id: Mapped[str] = mapped_column(String, ForeignKey("investigators.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    lead_investigator = relationship("Investigator", back_populates="led_cases")
    identifiers = relationship("Identifier", back_populates="case")
    audit_logs = relationship("AuditLog", back_populates="case")


class Identifier(Base):
    __tablename__ = "identifiers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    type: Mapped[IdentifierType] = mapped_column(SAEnum(IdentifierType, name="identifier_type"), nullable=False)
    raw_value: Mapped[str] = mapped_column(String, nullable=False)
    normalized_value: Mapped[str] = mapped_column(String, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    source: Mapped[str] = mapped_column(String, default="manual_intake", nullable=False)
    case_id: Mapped[str] = mapped_column(String, ForeignKey("cases.id"), nullable=False)
    investigator_id: Mapped[str] = mapped_column(String, ForeignKey("investigators.id"), nullable=False)
    identifier_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    case = relationship("Case", back_populates="identifiers")
    investigator = relationship("Investigator", back_populates="identifiers")
    findings = relationship("Finding", back_populates="identifier")


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    identifier_id: Mapped[str] = mapped_column(String, ForeignKey("identifiers.id"), index=True, nullable=False)
    connector_name: Mapped[str] = mapped_column(String, nullable=False)
    result_type: Mapped[str] = mapped_column(String, nullable=False)
    result_value: Mapped[str] = mapped_column(String, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    raw_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    discovered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    identifier = relationship("Identifier", back_populates="findings")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    investigator_id: Mapped[str | None] = mapped_column(String, ForeignKey("investigators.id"), nullable=True)
    case_id: Mapped[str | None] = mapped_column(String, ForeignKey("cases.id"), nullable=True)
    action: Mapped[str] = mapped_column(String, nullable=False)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    signature: Mapped[str | None] = mapped_column(String, nullable=True)

    investigator = relationship("Investigator", back_populates="audit_logs")
    case = relationship("Case", back_populates="audit_logs")


class CaseNote(Base):
    __tablename__ = "case_notes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    case_id: Mapped[str] = mapped_column(String, ForeignKey("cases.id"), nullable=False)
    author_id: Mapped[str] = mapped_column(String, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class LinkFeedback(Base):
    __tablename__ = "link_feedbacks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    case_id: Mapped[str] = mapped_column(String, ForeignKey("cases.id"), nullable=False)
    source_id: Mapped[str] = mapped_column(String, nullable=False)
    target_id: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)  # "confirmed" / "rejected"
    investigator_id: Mapped[str] = mapped_column(String, ForeignKey("investigators.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    case = relationship("Case")
    investigator = relationship("Investigator")


class SystemQuota(Base):
    """
    Persistent monthly counter for external API quotas (e.g., Google Cloud Vision).
    Key format: "{service}_{YYYY}_{MM}"  e.g. "google_vision_2026_08"
    """
    __tablename__ = "system_quotas"

    key: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)