import os
import asyncio
from celery import Celery
import logging

logger = logging.getLogger(__name__)

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "erakshak_worker",
    broker=redis_url,
    backend=redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

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


def dispatch_task(case_id: str, identifier_id: str, investigator_id: str, depth: int):
    """
    Dispatches task to Celery queue, falling back to local thread/asyncio execution if Redis is unavailable.
    """
    if is_redis_available():
        try:
            task_run_connectors_and_pivot.delay(case_id, identifier_id, investigator_id, depth)
            logger.info("Successfully dispatched task to Celery queue.")
            return
        except Exception as e:
            logger.warning(f"Celery dispatch failed despite port check ({e}). Falling back to local background execution.")
    else:
        logger.info("Redis is offline. Bypassing Celery queue, using local background execution.")

    import threading
    from app.connectors.runner import run_connectors_and_pivot_background
    
    coro = run_connectors_and_pivot_background(case_id, identifier_id, investigator_id, depth)
    try:
        loop = asyncio.get_running_loop()
        if loop.is_running():
            loop.create_task(coro)
            return
    except RuntimeError:
        pass
    
    threading.Thread(target=asyncio.run, args=(coro,), daemon=True).start()
