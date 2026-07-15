# e-Rakshak Backend

FastAPI backend scaffold for the e-Rakshak OSINT correlation tool.

## Run With Docker

From the `backend/` directory:

```bash
docker compose up --build
```

The API will be available on `http://localhost:8000`.

## Run Without Docker

1. Create a virtual environment and install dependencies from `requirements.txt`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL=sqlite:///erakshak.db` and `JWT_SECRET`.
3. Run:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Curl Walkthrough

Register an investigator:

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"badge_id":"INV-001","full_name":"Asha Mehta","password":"Password123!","is_active":true}'
```

Log in and capture the token:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=INV-001&password=Password123!" | jq -r .access_token)
```

Create a case:

```bash
CASE_ID=$(curl -s -X POST http://localhost:8000/cases/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Example Fraud Case","description":"Initial intake"}' | jq -r .id)
```

Create a domain identifier:

```bash
IDENTIFIER_ID=$(curl -s -X POST http://localhost:8000/identifiers/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"raw_value\":\"example.com\",\"case_id\":\"$CASE_ID\"}" | jq -r .id)
```

Run connectors:

```bash
curl -X POST http://localhost:8000/identifiers/$IDENTIFIER_ID/run-connectors \
  -H "Authorization: Bearer $TOKEN"
```

List findings:

```bash
curl -X GET http://localhost:8000/identifiers/$IDENTIFIER_ID/findings \
  -H "Authorization: Bearer $TOKEN"
```

## Team Stubs

The following pieces are intentionally left for teammates:

- Indic transliteration for Hindi/Gujarati/Hinglish normalization.
- Additional connectors such as whois, wayback, and username enumeration.
- The NetworkX correlation graph endpoint.
- Export endpoints.