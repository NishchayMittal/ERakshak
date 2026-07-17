from app.narrative import generate_narrative
mock_pack = {
  "case": {"title": "Operation Ghostwriter"},
  "identifiers": [
    {"id": "id-123", "type": "domain", "raw_value": "ghostwriter.ru", "findings": [{"connector": "whois", "type": "registrant", "value": "John Doe"}]}
  ],
  "graph": {},
  "notes": []
}
print(generate_narrative(mock_pack))
