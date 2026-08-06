from __future__ import annotations

import logging

import re
from typing import Any

def normalize_text(text: Any) -> str:
    if text is None:
        return ""
    return re.sub(r"\s+", " ", str(text)).strip()

logger = logging.getLogger(__name__)


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
    """Generate the dossier narrative."""
    return _local_fallback_narrative(evidence_pack)


def answer_question_about_evidence(evidence_pack: dict, question: str) -> str:
    """Answer a question."""
    return _local_fallback_response(evidence_pack, question)
