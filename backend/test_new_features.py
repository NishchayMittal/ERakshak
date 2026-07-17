import asyncio
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Investigator, Case
from app.audit import log_action
from app.crypto import sign_payload

def test_crypto():
    print("Testing crypto...")
    payload = {"hello": "world"}
    sig = sign_payload(payload)
    print("Signature generated:", len(sig) > 0)
    assert len(sig) > 0

def test_audit_log_and_models():
    print("Testing models and DB...")
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    inv = Investigator(badge_id="123", full_name="Test", hashed_password="pw")
    db.add(inv)
    db.commit()
    
    # Test log_action
    log = log_action(db, "test.action", investigator_id=inv.id, detail={"key": "val"})
    print("Log Signature:", log.signature is not None)
    assert log.signature is not None
    
    # Test case expires_at
    from datetime import datetime, timezone
    case = Case(title="Test", lead_investigator_id=inv.id, expires_at=datetime.now(timezone.utc))
    db.add(case)
    db.commit()
    print("Case expires_at:", case.expires_at is not None)
    assert case.expires_at is not None

def test_connectors_import():
    from app.connectors.bucket_enum import BucketEnumConnector
    from app.connectors.ocr_extractor import OcrExtractorConnector
    
    b = BucketEnumConnector()
    print("Bucket Connector Name:", b.name)
    o = OcrExtractorConnector()
    print("OCR Connector Name:", o.name)

if __name__ == "__main__":
    test_crypto()
    test_audit_log_and_models()
    test_connectors_import()
    print("All tests passed!")
