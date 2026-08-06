from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
import json
import logging
import re
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import HashingVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.config import settings

logger = logging.getLogger(__name__)

try:
    from sentence_transformers import SentenceTransformer
except Exception:  # pragma: no cover - optional dependency fallback
    SentenceTransformer = None


@dataclass(slots=True)
class RAGChunk:
    chunk_id: str
    case_id: str
    chunk_type: str
    text: str
    metadata: dict[str, Any]
    embedding: list[float]


class LocalEmbeddingBackend:
    def __init__(self) -> None:
        self._sentence_model: Any | None = None
        self._hashing_vectorizer = HashingVectorizer(
            n_features=384,
            alternate_sign=False,
            norm="l2",
            lowercase=True,
        )

    def _load_sentence_model(self) -> Any | None:
        if SentenceTransformer is None:
            return None
        if self._sentence_model is None:
            try:
                self._sentence_model = SentenceTransformer(settings.rag_embedding_model)
            except Exception as exc:  # pragma: no cover - runtime fallback path
                logger.warning("Failed to load sentence-transformers model %s: %s", settings.rag_embedding_model, exc)
                self._sentence_model = None
        return self._sentence_model

    def embed_texts(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, 384), dtype=np.float32)

        model = self._load_sentence_model()
        if model is not None:
            embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
            return np.asarray(embeddings, dtype=np.float32)

        matrix = self._hashing_vectorizer.transform(texts)
        return matrix.astype(np.float32).toarray()


_EMBEDDING_BACKEND: LocalEmbeddingBackend | None = None


def get_embedding_backend() -> LocalEmbeddingBackend:
    global _EMBEDDING_BACKEND
    if _EMBEDDING_BACKEND is None:
        _EMBEDDING_BACKEND = LocalEmbeddingBackend()
    return _EMBEDDING_BACKEND


def get_case_store_dir() -> Path:
    store_dir = Path(settings.rag_store_dir)
    if not store_dir.is_absolute():
        store_dir = Path(__file__).resolve().parents[1] / store_dir
    store_dir.mkdir(parents=True, exist_ok=True)
    return store_dir


def get_case_index_path(case_id: str) -> Path:
    return get_case_store_dir() / f"{case_id}.json"


def _safe_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, default=str, ensure_ascii=True)


def compute_evidence_hash(evidence_pack: dict[str, Any]) -> str:
    payload = _safe_json(evidence_pack)
    return sha256(payload.encode("utf-8")).hexdigest()


def normalize_text(text: Any) -> str:
    if text is None:
        return ""
    clean = re.sub(r"\s+", " ", str(text)).strip()
    return clean


def split_text_into_chunks(text: str, max_chars: int | None = None) -> list[str]:
    max_chars = max_chars or settings.rag_chunk_size
    text = normalize_text(text)
    if not text:
        return []

    if len(text) <= max_chars:
        return [text]

    chunks: list[str] = []
    sentences = re.split(r"(?<=[.!?])\s+", text)
    buffer = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        if not buffer:
            buffer = sentence
            continue
        if len(buffer) + 1 + len(sentence) <= max_chars:
            buffer = f"{buffer} {sentence}"
        else:
            chunks.append(buffer)
            buffer = sentence

    if buffer:
        chunks.append(buffer)

    if not chunks:
        chunks = [text[i : i + max_chars] for i in range(0, len(text), max_chars)]

    return chunks


def make_chunk_id(case_id: str, chunk_type: str, index: int, text: str, metadata: dict[str, Any]) -> str:
    raw = f"{case_id}:{chunk_type}:{index}:{text}:{_safe_json(metadata)}"
    return sha256(raw.encode("utf-8")).hexdigest()[:24]


def add_chunk(chunks: list[RAGChunk], case_id: str, chunk_type: str, text: str, metadata: dict[str, Any]) -> None:
    pieces = split_text_into_chunks(text)
    for index, piece in enumerate(pieces):
        if not piece:
            continue
        chunk_metadata = dict(metadata)
        chunk_metadata.setdefault("chunk_type", chunk_type)
        chunk_metadata.setdefault("case_id", case_id)
        chunk = RAGChunk(
            chunk_id=make_chunk_id(case_id, chunk_type, index, piece, chunk_metadata),
            case_id=case_id,
            chunk_type=chunk_type,
            text=piece,
            metadata=chunk_metadata,
            embedding=[],
        )
        chunks.append(chunk)


def format_graph_summary(graph_data: dict[str, Any]) -> str:
    nodes = graph_data.get("nodes", []) or []
    edges = graph_data.get("edges", []) or []

    node_types: dict[str, int] = {}
    pivot_labels: list[str] = []
    for node in nodes:
        node_type = str(node.get("type", "unknown"))
        node_types[node_type] = node_types.get(node_type, 0) + 1
        if node.get("pivot"):
            pivot_labels.append(str(node.get("label") or node.get("id") or "unknown"))

    connector_counts: dict[str, int] = {}
    relation_counts: dict[str, int] = {}
    for edge in edges:
        connector = str(edge.get("sourceProvenance") or edge.get("source") or "unknown")
        relation = str(edge.get("relationType") or edge.get("label") or "connected")
        connector_counts[connector] = connector_counts.get(connector, 0) + 1
        relation_counts[relation] = relation_counts.get(relation, 0) + 1

    top_connectors = ", ".join(f"{key} ({value})" for key, value in sorted(connector_counts.items(), key=lambda item: item[1], reverse=True)[:5]) or "none"
    top_relations = ", ".join(f"{key} ({value})" for key, value in sorted(relation_counts.items(), key=lambda item: item[1], reverse=True)[:5]) or "none"
    pivot_text = ", ".join(pivot_labels[:8]) or "none"
    node_type_text = ", ".join(f"{key}: {value}" for key, value in sorted(node_types.items(), key=lambda item: item[1], reverse=True)) or "none"

    return (
        f"Graph overview: {len(nodes)} nodes and {len(edges)} edges. "
        f"Node types include {node_type_text}. "
        f"Pivot entities: {pivot_text}. "
        f"Most common sources: {top_connectors}. "
        f"Most common relationships: {top_relations}."
    )


def format_temporal_summary(temporal_analysis: dict[str, Any]) -> str:
    if not temporal_analysis:
        return ""

    summary_parts: list[str] = []
    if temporal_analysis.get("tradecraft_summary"):
        summary_parts.append(str(temporal_analysis["tradecraft_summary"]))
    if temporal_analysis.get("inferred_timezone"):
        summary_parts.append(f"Inferred timezone: {temporal_analysis['inferred_timezone']}.")
    if temporal_analysis.get("sleep_window_local"):
        summary_parts.append(f"Observed local sleep window: {temporal_analysis['sleep_window_local']}.")
    if temporal_analysis.get("peak_hours_local"):
        summary_parts.append(f"Peak local hours: {temporal_analysis['peak_hours_local']}.")
    if temporal_analysis.get("night_owl_percentage") is not None:
        summary_parts.append(f"Night owl percentage: {temporal_analysis['night_owl_percentage']}%.")
    if temporal_analysis.get("weekend_ratio") is not None:
        summary_parts.append(f"Weekend ratio: {temporal_analysis['weekend_ratio']}.")

    return " ".join(summary_parts)


def build_chunks_from_evidence_pack(evidence_pack: dict[str, Any]) -> list[RAGChunk]:
    case = evidence_pack.get("case", {}) or {}
    case_id = str(case.get("id") or evidence_pack.get("case_id") or "unknown")
    chunks: list[RAGChunk] = []

    case_title = normalize_text(case.get("title") or "Unknown Case")
    case_description = normalize_text(case.get("description") or "")
    case_status = normalize_text(case.get("status") or "")
    case_meta = {
        "source": "case",
        "connector": "case_metadata",
        "case_id": case_id,
        "identifier_id": None,
        "timestamp": normalize_text(case.get("created_at") or ""),
    }
    add_chunk(
        chunks,
        case_id,
        "case_overview",
        f"Case title: {case_title}. Status: {case_status}. Description: {case_description or 'No case description was provided.'}",
        case_meta,
    )

    identifiers = evidence_pack.get("identifiers", []) or []
    for identifier in identifiers:
        identifier_id = normalize_text(identifier.get("id"))
        identifier_type = normalize_text(identifier.get("type") or "identifier")
        raw_value = normalize_text(identifier.get("raw_value") or "")
        normalized_value = normalize_text(identifier.get("normalized_value") or raw_value)
        confidence = identifier.get("confidence")
        source = normalize_text(identifier.get("source") or "manual_intake")
        findings = identifier.get("findings", []) or []

        finding_lines: list[str] = []
        for finding in findings:
            connector = normalize_text(finding.get("connector") or finding.get("connector_name") or "unknown")
            finding_type = normalize_text(finding.get("type") or finding.get("result_type") or "finding")
            finding_value = normalize_text(finding.get("value") or finding.get("result_value") or "")
            finding_confidence = finding.get("confidence")
            line = f"{connector}: {finding_type} -> {finding_value}"
            if finding_confidence is not None:
                line = f"{line} (confidence {finding_confidence})"
            finding_lines.append(line)

        identifier_text = (
            f"Identifier {identifier_type}: raw value '{raw_value}', normalized value '{normalized_value}', "
            f"confidence {confidence}, source {source}."
        )
        if finding_lines:
            identifier_text += " Findings: " + " | ".join(finding_lines)

        add_chunk(
            chunks,
            case_id,
            "identifier",
            identifier_text,
            {
                "source": "identifier",
                "connector": source,
                "case_id": case_id,
                "identifier_id": identifier_id or None,
                "timestamp": normalize_text(identifier.get("timestamp") or identifier.get("created_at") or ""),
            },
        )

        for finding in findings:
            connector = normalize_text(finding.get("connector") or finding.get("connector_name") or "unknown")
            finding_type = normalize_text(finding.get("type") or finding.get("result_type") or "finding")
            finding_value = normalize_text(finding.get("value") or finding.get("result_value") or "")
            raw_payload = finding.get("raw_payload") or {}
            payload_summary = ""
            if isinstance(raw_payload, dict) and raw_payload:
                compact_items = []
                for key in ["url", "original_url", "domain", "target", "status", "ip_address", "profile_url", "timestamp"]:
                    if key in raw_payload and raw_payload.get(key):
                        compact_items.append(f"{key}={normalize_text(raw_payload.get(key))}")
                payload_summary = f" Raw payload: {'; '.join(compact_items)}." if compact_items else ""

            add_chunk(
                chunks,
                case_id,
                "finding",
                f"Finding from {connector}: {finding_type} -> {finding_value}. Confidence {finding.get('confidence')}.{payload_summary}",
                {
                    "source": "finding",
                    "connector": connector,
                    "case_id": case_id,
                    "identifier_id": identifier_id or None,
                    "timestamp": normalize_text(finding.get("discovered_at") or finding.get("discoveredAt") or ""),
                },
            )

    notes = evidence_pack.get("notes", []) or []
    for note in notes:
        add_chunk(
            chunks,
            case_id,
            "note",
            f"Investigator note by {normalize_text(note.get('author_id') or note.get('authorId') or 'unknown')}: {normalize_text(note.get('text') or note.get('content') or '')}",
            {
                "source": "note",
                "connector": "case_note",
                "case_id": case_id,
                "identifier_id": None,
                "timestamp": normalize_text(note.get("created_at") or note.get("createdAt") or ""),
            },
        )

    graph_data = evidence_pack.get("graph", {}) or {}
    add_chunk(
        chunks,
        case_id,
        "graph_summary",
        format_graph_summary(graph_data),
        {
            "source": "graph",
            "connector": "correlation_graph",
            "case_id": case_id,
            "identifier_id": None,
            "timestamp": normalize_text(case.get("created_at") or ""),
        },
    )

    temporal_analysis = evidence_pack.get("temporal_analysis") or {}
    temporal_text = format_temporal_summary(temporal_analysis)
    if temporal_text:
        add_chunk(
            chunks,
            case_id,
            "temporal_analysis",
            temporal_text,
            {
                "source": "temporal",
                "connector": "temporal_analysis",
                "case_id": case_id,
                "identifier_id": None,
                "timestamp": normalize_text(case.get("created_at") or ""),
            },
        )

    return chunks


def chunk_to_payload(chunk: RAGChunk, score: float | None = None) -> dict[str, Any]:
    payload = {
        "chunk_id": chunk.chunk_id,
        "case_id": chunk.case_id,
        "chunk_type": chunk.chunk_type,
        "text": chunk.text,
        "metadata": chunk.metadata,
    }
    if score is not None:
        payload["score"] = round(float(score), 4)
    return payload


def index_evidence_pack(evidence_pack: dict[str, Any]) -> dict[str, Any]:
    case = evidence_pack.get("case", {}) or {}
    case_id = str(case.get("id") or evidence_pack.get("case_id") or "unknown")
    chunks = build_chunks_from_evidence_pack(evidence_pack)
    encoder = get_embedding_backend()
    chunk_texts = [chunk.text for chunk in chunks]
    embeddings = encoder.embed_texts(chunk_texts)

    indexed_chunks: list[dict[str, Any]] = []
    for chunk, embedding in zip(chunks, embeddings):
        chunk.embedding = np.asarray(embedding, dtype=np.float32).tolist()
        indexed_chunks.append(
            {
                "chunk_id": chunk.chunk_id,
                "case_id": chunk.case_id,
                "chunk_type": chunk.chunk_type,
                "text": chunk.text,
                "metadata": chunk.metadata,
                "embedding": chunk.embedding,
            }
        )

    payload = {
        "case_id": case_id,
        "indexed_at": datetime.now(timezone.utc).isoformat(),
        "evidence_hash": compute_evidence_hash(evidence_pack),
        "embedding_backend": settings.rag_embedding_backend,
        "embedding_model": settings.rag_embedding_model,
        "chunk_count": len(indexed_chunks),
        "chunks": indexed_chunks,
    }

    index_path = get_case_index_path(case_id)
    index_path.write_text(json.dumps(payload, ensure_ascii=True, indent=2, default=str), encoding="utf-8")
    return payload


def load_case_index(case_id: str) -> dict[str, Any] | None:
    index_path = get_case_index_path(case_id)
    if not index_path.exists():
        return None
    try:
        return json.loads(index_path.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover - defensive load path
        logger.warning("Failed to read RAG index for case %s: %s", case_id, exc)
        return None


def ensure_case_indexed(evidence_pack: dict[str, Any]) -> dict[str, Any]:
    case = evidence_pack.get("case", {}) or {}
    case_id = str(case.get("id") or evidence_pack.get("case_id") or "unknown")
    evidence_hash = compute_evidence_hash(evidence_pack)
    existing = load_case_index(case_id)
    if existing and existing.get("evidence_hash") == evidence_hash:
        return existing
    return index_evidence_pack(evidence_pack)


def retrieve_case_chunks(case_id: str, question: str, top_k: int | None = None) -> list[dict[str, Any]]:
    top_k = top_k or settings.rag_top_k
    index_data = load_case_index(case_id)
    if not index_data:
        return []

    chunks = index_data.get("chunks", []) or []
    if not chunks:
        return []

    chunk_texts = [str(chunk.get("text") or "") for chunk in chunks]
    embeddings = [chunk.get("embedding") or [] for chunk in chunks]
    if not any(embeddings):
        return []

    encoder = get_embedding_backend()
    query_embedding = encoder.embed_texts([question or case_id])[0].reshape(1, -1)
    embedding_matrix = np.asarray(embeddings, dtype=np.float32)
    if embedding_matrix.ndim == 1:
        embedding_matrix = embedding_matrix.reshape(1, -1)

    scores = cosine_similarity(query_embedding, embedding_matrix)[0]
    ranked_indices = list(np.argsort(scores)[::-1][:top_k])

    ranked_chunks: list[dict[str, Any]] = []
    for index in ranked_indices:
        chunk = chunks[int(index)]
        ranked_chunks.append(
            {
                "chunk_id": chunk.get("chunk_id"),
                "case_id": chunk.get("case_id", case_id),
                "chunk_type": chunk.get("chunk_type"),
                "text": chunk.get("text", ""),
                "metadata": chunk.get("metadata", {}),
                "score": round(float(scores[int(index)]), 4),
            }
        )
    return ranked_chunks


def _format_citation(chunk: dict[str, Any]) -> str:
    metadata = chunk.get("metadata") or {}
    connector = normalize_text(metadata.get("connector") or metadata.get("source") or chunk.get("chunk_type") or "source")
    identifier_id = normalize_text(metadata.get("identifier_id") or "")
    if identifier_id:
        return f"{connector} / Identifier {identifier_id}"
    return connector


def _extract_key_sentences(text: str, max_sentences: int = 2, max_chars: int = 260) -> str:
    text = normalize_text(text)
    if not text:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chosen = " ".join(sentence for sentence in sentences[:max_sentences] if sentence)
    if not chosen:
        chosen = text
    if len(chosen) > max_chars:
        chosen = chosen[: max_chars - 3].rstrip() + "..."
    return chosen


def build_local_answer(evidence_pack: dict[str, Any], question: str, top_k: int | None = None) -> str:
    case = evidence_pack.get("case", {}) or {}
    case_id = str(case.get("id") or evidence_pack.get("case_id") or "unknown")
    case_title = normalize_text(case.get("title") or "Unknown Case")
    ensure_case_indexed(evidence_pack)
    chunks = retrieve_case_chunks(case_id, question, top_k=top_k)

    if not chunks:
        return (
            f"**e-Rakshak AI Analyst (Local RAG)**\n\n"
            f"> Case: {case_title}\n\n"
            f"I could not find indexed evidence for this question yet."
        )

    answer_lines = [
        "**e-Rakshak AI Analyst (Local RAG)**",
        "",
        f"> **Case**: {case_title}",
        f"> **Question**: {normalize_text(question)}",
        "",
        "Relevant local evidence:",
    ]

    for chunk in chunks:
        snippet = _extract_key_sentences(chunk.get("text", ""))
        if not snippet:
            continue
        answer_lines.append(f"- {snippet} [Source: {_format_citation(chunk)}]")

    answer_lines.extend([
        "",
        "This response was generated from the local case index without sending data to an external API.",
    ])
    return "\n".join(answer_lines)


def build_local_narrative(evidence_pack: dict[str, Any], top_k: int | None = None) -> str:
    case = evidence_pack.get("case", {}) or {}
    case_id = str(case.get("id") or evidence_pack.get("case_id") or "unknown")
    case_title = normalize_text(case.get("title") or "Unknown Case")
    case_status = normalize_text(case.get("status") or "unknown")
    case_description = normalize_text(case.get("description") or "")
    ensure_case_indexed(evidence_pack)

    section_queries = [
        ("Target Summary", "primary subject aliases seed identifiers case title description core identity"),
        ("Digital Footprint Analysis", "domains social profiles email addresses phone numbers wallet identifiers usernames linked accounts"),
        ("Breach & Security Risks", "breach exposed credentials compromised records security risks leaked data exposure"),
        ("Infrastructure Map", "ip addresses dns infrastructure certificates hosting registry registrar subdomain network graph"),
    ]

    if evidence_pack.get("temporal_analysis"):
        section_queries.append(("Temporal Analysis", "activity timing timezone peak hours circadian pattern temporal behavior"))

    narrative_lines = [
        "### e-Rakshak Suspect Dossier Intelligence Report",
        "",
        f"**Case**: {case_title}",
        f"**Status**: {case_status}",
    ]
    if case_description:
        narrative_lines.append(f"**Description**: {case_description}")
    narrative_lines.append("")

    used_chunk_ids: set[str] = set()
    for section_name, query in section_queries:
        chunks = retrieve_case_chunks(case_id, query, top_k=top_k or settings.rag_top_k)
        narrative_lines.append(f"### {section_name}")
        if not chunks:
            narrative_lines.append("No strong local evidence was retrieved for this section.")
            narrative_lines.append("")
            continue

        for chunk in chunks:
            chunk_id = str(chunk.get("chunk_id") or "")
            if chunk_id and chunk_id in used_chunk_ids:
                continue
            if chunk_id:
                used_chunk_ids.add(chunk_id)
            snippet = _extract_key_sentences(chunk.get("text", ""), max_sentences=3, max_chars=360)
            if not snippet:
                continue
            narrative_lines.append(f"- {snippet} [Source: {_format_citation(chunk)}]")
        narrative_lines.append("")

    narrative_lines.append(
        "This report was assembled from the local evidence index and does not require an external model call."
    )
    return "\n".join(narrative_lines)


def reindex_case_from_evidence_pack(evidence_pack: dict[str, Any]) -> dict[str, Any]:
    return ensure_case_indexed(evidence_pack)


def reindex_case_from_db(case_id: str, db: Any, investigator_id: str) -> dict[str, Any]:
    from app.analytics.temporal import compute_temporal_analysis
    from app.compiler import compile_evidence_pack

    evidence_pack = compile_evidence_pack(case_id, db, investigator_id)
    try:
        evidence_pack["temporal_analysis"] = compute_temporal_analysis(case_id, db)
    except Exception as exc:  # pragma: no cover - best effort enrichment
        logger.warning("Failed to compute temporal analysis for case %s: %s", case_id, exc)
    return reindex_case_from_evidence_pack(evidence_pack)