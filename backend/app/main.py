import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

resources_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "resources"))

from app.connectors import register_all
from app.connectors.base import registry
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

register_all()


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


redis_tasks = []

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
    t1 = asyncio.create_task(redis_listener())
    t2 = asyncio.create_task(retention_cleanup_loop())
    redis_tasks.extend([t1, t2])


@app.on_event("shutdown")
async def on_shutdown() -> None:
    import asyncio
    for t in redis_tasks:
        if not t.done():
            t.cancel()
            try:
                await t
            except asyncio.CancelledError:
                pass


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