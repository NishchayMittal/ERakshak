from __future__ import annotations

import logging

from app.rag import build_local_answer, build_local_narrative, normalize_text

logger = logging.getLogger(__name__)

=======
def sanitize_evidence(data):
    if isinstance(data, dict):
        # Strip out raw_payload completely to save massive amounts of tokens
        return {k: sanitize_evidence(v) for k, v in data.items() if k != "raw_payload"}
    elif isinstance(data, list):
        # Cap lists at 15 items to prevent hundreds of findings from overloading the prompt
        if len(data) > 15:
            return [sanitize_evidence(item) for item in data[:15]] + [f"... [TRUNCATED {len(data)-15} MORE ITEMS]"]
        return [sanitize_evidence(item) for item in data]
    elif isinstance(data, str) and len(data) > 300:
        return data[:300] + "... [TRUNCATED]"
    return data
def generate_narrative(evidence_pack: dict) -> str:
    """
    Generates an intelligence dossier narrative using the Groq API.
    If the API key is missing or invalid, it returns a graceful fallback mock string.
    """
    case_title = evidence_pack.get("case", {}).get("title", "Unknown Case")
>>>>>>> 1bdc795ee4aed650bad8e1853750d410cf8986ae

def _local_fallback_narrative(evidence_pack: dict) -> str:
    case = evidence_pack.get("case", {}) or {}
    case_title = normalize_text(case.get("title") or "Unknown Case")
    case_status = normalize_text(case.get("status") or "unknown")
    return (
        f"### e-Rakshak Suspect Dossier Intelligence Report\n\n"
        f"**Case**: {case_title}\n"
        f"**Status**: {case_status}\n\n"
        "> [!WARNING]\n"
        "> Local RAG could not assemble a full narrative for this case. The response below stays entirely in-app and does not use any external API.\n\n"
        "No indexed evidence was available yet to synthesize a grounded dossier. Re-run ingestion or refresh the case index after adding identifiers, findings, notes, or temporal analysis."
    )


def _local_fallback_response(evidence_pack: dict, question: str) -> str:
    case = evidence_pack.get("case", {}) or {}
    case_title = normalize_text(case.get("title") or "Unknown Case")
    temporal = evidence_pack.get("temporal_analysis", {}) or {}
    temporal_summary = normalize_text(temporal.get("tradecraft_summary") or "")

<<<<<<< HEAD
    response = (
        f"**e-Rakshak AI Assistant**\n\n"
        f"> [!NOTE]\n"
        f"> **Case Context**: {case_title}\n\n"
        f"Regarding your query: \"{normalize_text(question)}\"\n\n"
    )
    if temporal_summary:
        response += f"**Temporal Behavioral Footprint**:\n{temporal_summary}\n\n"
    response += (
        "Local retrieval could not surface enough grounded evidence for a richer answer. Try a more specific question or ingest more case evidence."
    )
    return response


def generate_narrative(evidence_pack: dict) -> str:
    """Generate the dossier narrative using local RAG only."""
    try:
        return build_local_narrative(evidence_pack)
    except Exception as exc:
        logger.warning("Local RAG narrative generation failed: %s", exc)
        return _local_fallback_narrative(evidence_pack)


def answer_question_about_evidence(evidence_pack: dict, question: str) -> str:
    """Answer a question using local retrieval only."""
    try:
        return build_local_answer(evidence_pack, question)
    except Exception as exc:
        logger.warning("Local RAG chat generation failed: %s", exc)
        return _local_fallback_response(evidence_pack, question)
