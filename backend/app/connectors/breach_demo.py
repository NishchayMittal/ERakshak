import json
import os
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

class BreachDemoConnector(BaseConnector):
    name = "breach_repository_demo"
    applies_to = (IdentifierType.email, IdentifierType.phone, IdentifierType.username)

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        # Construct path to mock breaches JSON file
        resources_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "resources"))
        json_path = os.path.join(resources_dir, "mock_breaches.json")

        if not os.path.exists(json_path):
            return []

        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            return []

        findings = []
        for record in data:
            if record.get("identifier") == identifier_value:
                findings.append(
                    Finding(
                        connector_name=self.name,
                        result_type="leak_record",
                        result_value=f"{record.get('breach_name')} (Hint: {record.get('leaked_password_hint')})",
                        confidence=1.0,
                        raw_payload=record
                    )
                )

        return findings
