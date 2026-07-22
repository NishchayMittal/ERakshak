import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

resources_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "resources"))

from app.connectors.base import registry
from app.connectors.crtsh import CrtShConnector
from app.connectors.whois import WhoisConnector
from app.connectors.wayback import WaybackConnector
from app.connectors.username_enum import UsernameEnumConnector
from app.connectors.breach_lookup import BreachLookupConnector
from app.connectors.face_matcher import FaceMatcherConnector
from app.connectors.name_search import NameSearchConnector
from app.connectors.phone_lookup import PhoneLookupConnector
from app.connectors.wallet_lookup import WalletLookupConnector
from app.connectors.dns_resolver import DnsResolverConnector
from app.connectors.github_commits import GithubCommitEmailConnector
from app.connectors.ip_geoloc import IpGeolocConnector
from app.connectors.shodan_idb import ShodanIdbConnector
from app.connectors.gravatar_email import GravatarEmailConnector
from app.connectors.pgp_lookup import PgpLookupConnector
from app.connectors.social_profiler import SocialProfilerConnector
from app.database import Base, engine
from app.routers import auth as auth_router
from app.routers import cases as cases_router
from app.routers import identifiers as identifiers_router
from app.routers import model as model_router
from app.routers import ws as ws_router


app = FastAPI(title="e-Rakshak API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=resources_dir), name="static")

app.include_router(auth_router.router)
app.include_router(cases_router.router)
app.include_router(identifiers_router.router)
app.include_router(model_router.router)
app.include_router(ws_router.router)

from app.connectors.ocr_extractor import OcrExtractorConnector
from app.connectors.bucket_enum import BucketEnumConnector

registry.register(CrtShConnector())
registry.register(WhoisConnector())
registry.register(WaybackConnector())
registry.register(UsernameEnumConnector())
registry.register(BreachLookupConnector())
registry.register(FaceMatcherConnector())
registry.register(NameSearchConnector())
registry.register(PhoneLookupConnector())
registry.register(WalletLookupConnector())
registry.register(DnsResolverConnector())
registry.register(GithubCommitEmailConnector())
registry.register(IpGeolocConnector())
registry.register(ShodanIdbConnector())
registry.register(GravatarEmailConnector())
registry.register(PgpLookupConnector())
registry.register(OcrExtractorConnector())
registry.register(BucketEnumConnector())
registry.register(SocialProfilerConnector())


async def retention_cleanup_loop():
    from app.database import SessionLocal
    from app.models import Case, Identifier, Finding, AuditLog, CaseNote, LinkFeedback
    from datetime import datetime, timezone
    import asyncio
    
    while True:
        try:
            db = SessionLocal()
            now = datetime.now(timezone.utc)
            expired_cases = db.query(Case).filter(Case.expires_at != None, Case.expires_at <= now).all()
            for case in expired_cases:
                identifier_ids = [i.id for i in db.query(Identifier).filter(Identifier.case_id == case.id).all()]
                if identifier_ids:
                    db.query(Finding).filter(Finding.identifier_id.in_(identifier_ids)).delete(synchronize_session=False)
                db.query(Identifier).filter(Identifier.case_id == case.id).delete(synchronize_session=False)
                db.query(CaseNote).filter(CaseNote.case_id == case.id).delete(synchronize_session=False)
                db.query(LinkFeedback).filter(LinkFeedback.case_id == case.id).delete(synchronize_session=False)
                db.query(AuditLog).filter(AuditLog.case_id == case.id).delete(synchronize_session=False)
                db.delete(case)
            db.commit()
            db.close()
        except Exception:
            pass
        await asyncio.sleep(3600)


@app.on_event("startup")
def on_startup() -> None:
    from sqlalchemy import text
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE investigators ADD COLUMN is_approved BOOLEAN DEFAULT 0"))
        except Exception:
            pass
        try:
            conn.execute(text("UPDATE investigators SET is_approved = 1 WHERE badge_id = 'INV-001'"))
        except Exception:
            pass
    Base.metadata.create_all(bind=engine)
    import asyncio
    from app.routers.ws import redis_listener
    asyncio.create_task(redis_listener())
    asyncio.create_task(retention_cleanup_loop())


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/connectors")
async def health_connectors() -> dict[str, dict]:
    import asyncio
    connectors = registry.all()

    async def check(conn):
        try:
            is_healthy = await conn.check_health()
        except Exception:
            is_healthy = False
        return conn.name, {"status": "healthy" if is_healthy else "unhealthy"}

    results = await asyncio.gather(*(check(c) for c in connectors))
    return dict(results)