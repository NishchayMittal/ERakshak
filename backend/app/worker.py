import os
import asyncio
from dotenv import load_dotenv
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(backend_dir, ".env"))

from celery import Celery
import logging
import threading
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
RAG_REINDEX_LOCK_TTL_SECONDS = int(os.environ.get("RAG_REINDEX_LOCK_TTL_SECONDS", "15"))

_rag_reindex_local_lock = threading.Lock()
_rag_reindex_local_pending: dict[str, float] = {}
from app.connectors import register_all
register_all()
from app.config import settings

redis_url = settings.redis_url

celery_app = Celery(
    "erakshak_worker",
    broker=redis_url,
    backend=redis_url,
)

celery_app.conf.update(
    broker_connection_retry_on_startup=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "monitor-active-cases-every-3-hours": {
            "task": "monitor_active_cases",
            "schedule": 10800.0, # Every 3 hours
        }
    }
)

if os.name == "nt":
    celery_app.conf.update(worker_pool="solo")

@celery_app.task(name="monitor_active_cases")
def monitor_active_cases():
    """
    Periodic task to re-scan manual seeds for all active cases.
    """
    from app.database import SessionLocal
    from app.models import Case, Identifier
    from sqlalchemy.orm import joinedload
    from datetime import datetime, timezone

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        # Find active cases
        active_cases = db.query(Case).filter(
            (Case.expires_at == None) | (Case.expires_at > now)
        ).all()
        
        logger.info(f"Beat Task: Found {len(active_cases)} active cases for monitoring.")
        
        for c in active_cases:
            # Get original seed identifiers for this case
            seed_identifiers = db.query(Identifier).filter(
                Identifier.case_id == c.id,
                Identifier.source == "manual_intake"
            ).all()
            
            for ident in seed_identifiers:
                # Dispatch the runner for depth=1 (re-check)
                logger.info(f"Beat Task: Dispatching background scan for seed {ident.normalized_value} in case {c.id}")
                task_run_connectors_and_pivot.delay(c.id, ident.id, ident.investigator_id, 1)
                
    except Exception as e:
        logger.error(f"Error in monitor_active_cases: {e}")
    finally:
        db.close()


@celery_app.task(name="task_run_connectors_and_pivot")
def task_run_connectors_and_pivot(case_id: str, identifier_id: str, investigator_id: str, depth: int):
    """
    Celery task that wraps the async run_connectors_and_pivot execution.
    """
    from app.connectors.runner import run_connectors_and_pivot_background
    try:
        asyncio.run(run_connectors_and_pivot_background(case_id, identifier_id, investigator_id, depth))
    except Exception as e:
        logger.error(f"Error executing task_run_connectors_and_pivot: {e}")
    finally:
        try:
            dispatch_rag_reindex(case_id, investigator_id)
        except Exception as exc:
            logger.error(f"Error scheduling RAG reindex after connector run for case {case_id}: {exc}")


@celery_app.task(name="reindex_case_rag")
def reindex_case_rag(case_id: str, investigator_id: str):
    """Rebuild the local case RAG index in the background."""
    from app.database import SessionLocal
    from app.rag import reindex_case_from_db

    db = SessionLocal()
    try:
        reindex_case_from_db(case_id, db, investigator_id)
    except Exception as e:
        logger.error(f"Error executing reindex_case_rag for case {case_id}: {e}")
    finally:
        db.close()
        _release_rag_reindex_lock(case_id)


def is_redis_available() -> bool:
    """Checks if the Redis server is listening on port 6379 to avoid Celery blocking retries."""
    import socket
    from urllib.parse import urlparse
    try:
        parsed = urlparse(redis_url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 6379
        s = socket.create_connection((host, port), timeout=0.15)
        s.close()
        return True
    except Exception:
        return False


def _get_redis_client():
    try:
        import redis

        return redis.Redis.from_url(redis_url, decode_responses=True)
    except Exception as exc:
        logger.debug("Unable to create Redis client for RAG dedupe: %s", exc)
        return None


def _rag_lock_key(case_id: str) -> str:
    return f"rag_reindex:lock:{case_id}"


def _acquire_rag_reindex_lock(case_id: str) -> bool:
    client = _get_redis_client()
    lock_key = _rag_lock_key(case_id)

    if client is not None:
        try:
            acquired = bool(client.set(lock_key, datetime.now(timezone.utc).isoformat(), nx=True, ex=RAG_REINDEX_LOCK_TTL_SECONDS))
            if acquired:
                return True
            return False
        except Exception as exc:
            logger.debug("Redis RAG lock acquisition failed for case %s: %s", case_id, exc)

    with _rag_reindex_local_lock:
        now = datetime.now(timezone.utc).timestamp()
        pending_until = _rag_reindex_local_pending.get(case_id)
        if pending_until and pending_until > now:
            return False
        _rag_reindex_local_pending[case_id] = now + RAG_REINDEX_LOCK_TTL_SECONDS
        return True


def _release_rag_reindex_lock(case_id: str) -> None:
    client = _get_redis_client()
    lock_key = _rag_lock_key(case_id)

    if client is not None:
        try:
            client.delete(lock_key)
        except Exception as exc:
            logger.debug("Redis RAG lock release failed for case %s: %s", case_id, exc)

    with _rag_reindex_local_lock:
        _rag_reindex_local_pending.pop(case_id, None)
def is_celery_worker_active() -> bool:
    """Checks if there are active Celery workers listening to the queue."""
    if not is_redis_available():
        return False
    try:
        inspect = celery_app.control.inspect(timeout=0.15)
        if inspect:
            active = inspect.active()
            return active is not None and len(active) > 0
    except Exception:
        pass
    return False


def dispatch_task(case_id: str, identifier_id: str, investigator_id: str, depth: int):
    """
    Dispatches task to Celery queue, falling back to local thread/asyncio execution if no Celery worker is active.
    """
    if is_celery_worker_active():
        try:
            task_run_connectors_and_pivot.delay(case_id, identifier_id, investigator_id, depth)
            logger.info("Successfully dispatched task to Celery queue.")
            return
        except Exception as e:
            logger.warning(f"Celery dispatch failed ({e}). Falling back to local background execution.")
    else:
        logger.info("No active Celery workers found. Bypassing Celery queue, using local background execution.")

    import threading
    from app.connectors.runner import run_connectors_and_pivot_background
    
    coro = run_connectors_and_pivot_background(case_id, identifier_id, investigator_id, depth)
    # Always spawn a separate background thread for local fallback execution to prevent
    # task destruction and SQLite database closure warnings when the parent event loop terminates.
    threading.Thread(target=asyncio.run, args=(coro,), daemon=True).start()


def dispatch_rag_reindex(case_id: str, investigator_id: str):
    """Dispatch a case RAG reindex job using Celery when available, otherwise background thread."""
    if not _acquire_rag_reindex_lock(case_id):
        logger.info("Skipping duplicate RAG reindex for case %s because one is already pending.", case_id)
        return

    if is_redis_available():
        try:
            reindex_case_rag.delay(case_id, investigator_id)
            logger.info("Successfully dispatched RAG reindex job to Celery queue.")
            return
        except Exception as e:
            logger.warning(f"Celery RAG reindex dispatch failed despite port check ({e}). Falling back to local background execution.")
    else:
        logger.info("Redis is offline. Bypassing Celery queue for RAG reindex, using local background execution.")

    import threading
    from app.database import SessionLocal
    from app.rag import reindex_case_from_db

    def _run_reindex() -> None:
        db = SessionLocal()
        try:
            reindex_case_from_db(case_id, db, investigator_id)
        except Exception as exc:
            logger.error(f"Error executing local RAG reindex for case {case_id}: {exc}")
        finally:
            db.close()
            _release_rag_reindex_lock(case_id)

    threading.Thread(target=_run_reindex, daemon=True).start()
