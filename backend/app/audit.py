from sqlalchemy.orm import Session

from app.models import AuditLog


def log_action(
    db: Session,
    action: str,
    investigator_id: str | None = None,
    case_id: str | None = None,
    detail: dict | None = None,
) -> AuditLog:
    entry = AuditLog(
        investigator_id=investigator_id,
        case_id=case_id,
        action=action,
        detail=detail,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry