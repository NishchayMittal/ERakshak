from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
import os

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_rag.db")
os.environ.setdefault("JWT_SECRET", "test-secret")

from app.config import settings
from app.rag import (
    build_local_answer,
    build_local_narrative,
    ensure_case_indexed,
    index_evidence_pack,
    load_case_index,
    retrieve_case_chunks,
)


class LocalRagTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._original_store_dir = settings.rag_store_dir
        self._tmpdir = tempfile.TemporaryDirectory()
        settings.rag_store_dir = self._tmpdir.name

    def tearDown(self) -> None:
        settings.rag_store_dir = self._original_store_dir
        self._tmpdir.cleanup()

    def make_pack(self, case_id: str = "case-1") -> dict:
        return {
            "case": {
                "id": case_id,
                "title": "Sample Case",
                "description": "Test description for local RAG",
                "status": "open",
                "created_at": "2026-08-06T00:00:00Z",
            },
            "identifiers": [
                {
                    "id": "id-1",
                    "type": "email",
                    "raw_value": "alpha@example.com",
                    "normalized_value": "alpha@example.com",
                    "confidence": 1.0,
                    "source": "manual_intake",
                    "findings": [
                        {
                            "connector": "whois_rdap",
                            "type": "registrant_email",
                            "value": "alpha@example.com",
                            "confidence": 0.95,
                            "raw_payload": {"url": "example.com"},
                            "discovered_at": "2026-08-06T00:00:00Z",
                        },
                        {
                            "connector": "crtsh",
                            "type": "subdomain",
                            "value": "mail.example.com",
                            "confidence": 0.72,
                            "raw_payload": {"domain": "example.com"},
                            "discovered_at": "2026-08-06T01:00:00Z",
                        },
                    ],
                }
            ],
            "notes": [
                {
                    "id": "note-1",
                    "author_id": "inv-1",
                    "text": "Follow the email and domain linkage.",
                    "created_at": "2026-08-06T00:00:00Z",
                }
            ],
            "graph": {
                "nodes": [
                    {"id": "n1", "label": "alpha@example.com", "type": "email", "pivot": True},
                    {"id": "n2", "label": "mail.example.com", "type": "domain", "pivot": False},
                ],
                "edges": [
                    {"source": "n1", "target": "n2", "relationType": "linked", "sourceProvenance": "whois_rdap"},
                ],
            },
            "temporal_analysis": {
                "tradecraft_summary": "Activity peaks at night.",
                "inferred_timezone": "UTC+05:30 (Asia/Kolkata)",
                "sleep_window_local": "02:00 - 08:00 Local",
                "peak_hours_local": "02:00, 03:00, 04:00",
                "night_owl_percentage": 44.2,
                "weekend_ratio": 0.3,
            },
        }

    def test_index_builds_and_persists_case_chunks(self) -> None:
        payload = index_evidence_pack(self.make_pack())
        self.assertEqual(payload["case_id"], "case-1")
        self.assertGreater(payload["chunk_count"], 0)

        stored = load_case_index("case-1")
        self.assertIsNotNone(stored)
        self.assertEqual(stored["case_id"], "case-1")
        self.assertGreaterEqual(len(stored["chunks"]), 4)

    def test_retrieval_returns_relevant_email_chunks(self) -> None:
        ensure_case_indexed(self.make_pack())
        chunks = retrieve_case_chunks("case-1", "Which email and domain are linked?", top_k=3)
        self.assertGreaterEqual(len(chunks), 1)
        combined_text = " ".join(chunk["text"] for chunk in chunks)
        self.assertIn("alpha@example.com", combined_text)
        self.assertTrue(any(chunk["chunk_type"] in {"identifier", "finding", "graph_summary"} for chunk in chunks))

    def test_local_answer_mentions_sources(self) -> None:
        ensure_case_indexed(self.make_pack())
        answer = build_local_answer(self.make_pack(), "What email is linked to the case?")
        self.assertIn("Local RAG", answer)
        self.assertIn("alpha@example.com", answer)
        self.assertIn("whois_rdap", answer)

    def test_local_narrative_has_report_sections(self) -> None:
        ensure_case_indexed(self.make_pack())
        narrative = build_local_narrative(self.make_pack())
        self.assertIn("Target Summary", narrative)
        self.assertIn("Digital Footprint Analysis", narrative)
        self.assertIn("Infrastructure Map", narrative)
        self.assertIn("temporal", narrative.lower())
        self.assertIn("local evidence index", narrative.lower())

    def test_indexing_is_idempotent_for_same_pack(self) -> None:
        first = index_evidence_pack(self.make_pack())
        second = ensure_case_indexed(self.make_pack())
        self.assertEqual(first["evidence_hash"], second["evidence_hash"])
        self.assertEqual(first["chunk_count"], second["chunk_count"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
