import logging

logger = logging.getLogger(__name__)

def compute_temporal_analysis(case_id: str, db) -> dict:
    """
    Stub fallback for temporal analysis since the feature was removed.
    Prevents startup/import crashes in routers and RAG modules.
    """
    return {
        "nodes": [],
        "edges": [],
        "timeline": []
    }
