from sqlalchemy.orm import Session

from app.models import AuditLog
from app.crypto import sign_payload

def log_action(
    db: Session,
    action: str,
    investigator_id: str | None = None,
    case_id: str | None = None,
    detail: dict | None = None,
) -> AuditLog:
    payload = {
        "action": action,
        "investigator_id": investigator_id,
        "case_id": case_id,
        "detail": detail
    }
    signature = sign_payload(payload)

    entry = AuditLog(
        investigator_id=investigator_id,
        case_id=case_id,
        action=action,
        detail=detail,
        signature=signature,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry