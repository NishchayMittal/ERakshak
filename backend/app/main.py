import os
from datetime import datetime, timezone
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
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.security import SecurityHeadersMiddleware

from app.config import settings
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

app = FastAPI(title="e-Rakshak API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

app.mount("/static", StaticFiles(directory=resources_dir), name="static")

app.include_router(auth_router.router)
app.include_router(cases_router.router)
app.include_router(identifiers_router.router)
app.include_router(model_router.router)
app.include_router(ws_router.router)

register_all()


async def retention_cleanup_loop():
    from app.database import SessionLocal
    from app.models import Case, Identifier, Finding, AuditLog, CaseNote, LinkFeedback, Alert
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
                db.query(Alert).filter(Alert.case_id == case.id).delete(synchronize_session=False)
                db.delete(case)
            db.commit()
            db.close()
        except Exception:
            pass
        await asyncio.sleep(3600)


redis_tasks = []


async def watchlist_monitor_loop():
    """Lightweight in-process monitor that re-scans watched cases periodically."""
    from app.database import SessionLocal
    from app.models import Case, Identifier, Finding, Alert
    import asyncio

    # Wait 60 seconds after startup before first scan
    await asyncio.sleep(60)

    while True:
        try:
            db = SessionLocal()
            now = datetime.now(timezone.utc)

            watched_cases = db.query(Case).filter(
                Case.is_watched == True,
                Case.status == "open",
            ).all()

            for case in watched_cases:
                seed_identifiers = db.query(Identifier).filter(
                    Identifier.case_id == case.id,
                    Identifier.source == "manual_intake"
                ).all()

                for ident in seed_identifiers:
                    # Count findings before rescan
                    before_count = db.query(Finding).filter(
                        Finding.identifier_id == ident.id
                    ).count()

                    # Run connectors in background thread (depth=2 means no pivoting)
                    try:
                        from app.connectors.runner import run_connectors_and_pivot_background
                        await run_connectors_and_pivot_background(
                            case.id, ident.id, case.lead_investigator_id, 2
                        )
                    except Exception as e:
                        logging.getLogger(__name__).error(f"Watchlist rescan error: {e}")
                        continue

                    # Count findings after rescan
                    after_count = db.query(Finding).filter(
                        Finding.identifier_id == ident.id
                    ).count()

                    new_count = after_count - before_count
                    if new_count > 0:
                        alert = Alert(
                            case_id=case.id,
                            investigator_id=case.lead_investigator_id,
                            alert_type="new_findings",
                            title=f"{new_count} new finding(s) discovered for {ident.normalized_value}",
                            detail={
                                "identifier_id": ident.id,
                                "identifier_value": ident.normalized_value,
                                "identifier_type": ident.type.value,
                                "new_findings_count": new_count,
                                "before_count": before_count,
                                "after_count": after_count,
                            }
                        )
                        db.add(alert)
                        db.commit()

                        # Push alert via WebSocket
                        from app.connectors.runner import publish_update
                        await publish_update(
                            case.id,
                            "watchlist_alert",
                            {
                                "alert_id": alert.id,
                                "title": alert.title,
                                "type": alert.alert_type,
                            }
                        )

            db.close()
        except Exception as e:
            logging.getLogger(__name__).error(f"Watchlist monitor error: {e}")

        # Sleep for 4 hours between scans (lightweight on Render free tier)
        await asyncio.sleep(4 * 3600)


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
        try:
            conn.execute(text("ALTER TABLE cases ADD COLUMN is_watched BOOLEAN DEFAULT 0"))
        except Exception:
            pass
    Base.metadata.create_all(bind=engine)
    import asyncio
    from app.routers.ws import redis_listener
    t1 = asyncio.create_task(redis_listener())
    t2 = asyncio.create_task(retention_cleanup_loop())
    t3 = asyncio.create_task(watchlist_monitor_loop())
    redis_tasks.extend([t1, t2, t3])


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