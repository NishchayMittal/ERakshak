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
