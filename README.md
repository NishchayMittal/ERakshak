<div align="center">
  <h1>🌌 Orion (e-Rakshak)</h1>
  <p><b>An OSINT link-analysis and suspect correlation engine built to assist investigative teams in mapping cybercrime networks.</b></p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black?logo=vercel)](https://orionerakshak.vercel.app/)
  
  **Live Demo:** [orionerakshak.vercel.app](https://orionerakshak.vercel.app/) • **Demo Video:**  [Demo Video Link](https://youtu.be/ozIQ1pxAIW0) 
</div>

---

## 🛑 The Problem
Cybercrime investigations often stall due to highly fragmented data. Evidence scattered across different domains—WHOIS records, certificate logs, data breaches, and social media footprints—is incredibly difficult to piece together manually. Investigative teams lack a unified, automated tool to cross-correlate disparate aliases, crypto wallets, domains, and phone numbers to reveal the hidden networks behind cybercrimes.

## 💡 The Solution
**Orion** is an intelligent, automated OSINT ingestion and correlation engine. It automatically normalizes raw suspect data, queries a wide array of external intelligence databases, detects hidden pivot points, and generates comprehensive evidentiary dossiers. By utilizing an XGBoost refinement layer over a NetworkX correlation engine, Orion empowers analysts to map complex criminal networks in a fraction of the time.

## ✨ Key Features

### 🖥️ Immersive Investigator UI
- **Cyberpunk Desktop Paradigm**: A window-based operating system UI tailored for complex multi-tasking investigations.
- **Interactive Graph Visualizations**: Cytoscape.js powered suspect correlation node map to visually explore entity relationships.
- **Geo-Intelligence Mapping**: 3D interactive globe visualizations for spatial mapping of IP intelligence and suspect locations.
- **Cross-Correlation Window**: Advanced interface to cross-reference attributes across multiple distinct cases simultaneously.

### 🧠 Intelligence Engine & Machine Learning
- **Pluggable OSINT Connector Registry**: Concurrent asynchronous querying of 19 external sources (WHOIS/RDAP, crt.sh, Web Archive CDX, WhatsMyName, HIBP, etc.).
- **Auto-Type Detection & Sanitization**: Regex categorization and standardizing inputs automatically upon ingestion.
- **Link Correlation Engine**: Fellegi-Sunter probabilistic matching with an XGBoost refinement layer to calculate edge confidence scores.
- **Automated Pivot Detection**: Automatically flags critical hub entities (nodes with 3+ connections) to highlight investigative pivot points.

### 🤖 Generative AI & Accessibility
- **Generative AI Case Narrative**: Built-in OSINT AI Assistant powered by Groq (LLaMA-3.3-70B) to synthesize evidence packs into dossier narratives.
- **Multilingual Text-to-Speech (TTS)**: Built-in Edge TTS engine reading out dossier intel in English, Hindi, and Gujarati.
- **Standalone Transliteration & i18n**: Dynamically transliterates native Indic scripts (Hindi, Gujarati) to Latin form for unified searching.
- **Guided AI Assistant & Tour**: Interactive onboarding led by 'LeoAvatar' to guide new investigators.

### ⚖️ Evidentiary & Legal Reporting
- **Evidentiary Dossier Reports**: One-click generation of comprehensive case reports in JSON, CSV, and print-ready PDF formats.
- **Legal Offense Mapping**: Automatically maps findings to 17 Indian law sections based on extracted evidence.
- **Security & Auditing**: Cryptographically signed chain-of-custody logging system tracking all investigator actions.

---

## 📂 Project Folder Structure

The repository is built as a monorepo containing both the React frontend and FastAPI backend.

<details>
<summary><b>Click to expand full directory tree</b></summary>

```text
ERakshak/
├── backend/                  # FastAPI Backend Server
│   ├── app/
│   │   ├── analytics/        # Time-series and mapping logic
│   │   ├── connectors/       # 19+ OSINT Connectors (WHOIS, crtsh, HIBP, OCR)
│   │   ├── correlation/      # XGBoost and NetworkX correlation engine
│   │   ├── middleware/       # Auth, Security, and Rate Limiting
│   │   ├── routers/          # API Route endpoints (Auth, Cases, Websockets)
│   │   ├── resources/        # Trained XGBoost models and RAG knowledge base
│   │   ├── main.py           # Application entrypoint
│   │   ├── models.py         # SQLAlchemy Database Models
│   │   ├── schemas.py        # Pydantic validation schemas
│   │   └── database.py       # PostgreSQL connection config
│   ├── docker-compose.yml
│   └── requirements.txt      # Python dependencies
├── frontend/                 # React (Vite) Frontend UI
│   ├── public/
│   ├── src/
│   │   ├── api/              # Axios endpoints and Mock data
│   │   ├── components/       # Reusable UI components
│   │   │   ├── cases/        # Case management & chat UI
│   │   │   ├── graph/        # Cytoscape visualization logic
│   │   │   ├── tutorial/     # 14-Step LeoAvatar Demo Tour
│   │   │   └── ui/           # Cyberpunk desktop window UI elements
│   │   ├── hooks/            # Custom React hooks (WebSockets, Auth)
│   │   ├── locales/          # i18n Translation files (en, hi, gu)
│   │   ├── pages/            # Main application screens
│   │   ├── state/            # Zustand global stores
│   │   └── types/            # TypeScript interfaces
│   ├── tailwind.config.js
│   ├── package.json          # Node dependencies
│   └── vite.config.ts
└── render.yaml               # Infrastructure as Code (Backend deploy)
```
</details>

---

## 🏗 System Architecture

Orion is built on a highly concurrent, decoupled architecture for maximum scalability and modularity. 

```mermaid
graph TD
    UI[React / Cytoscape Frontend] <--> API[FastAPI Gateway]
    API --> DB[(PostgreSQL on Neon.tech)]
    API --> OSINT[Async Connector Engine \n19 Data Connectors]
    API --> ML[NetworkX / XGBoost Engine]
    ML --> Correlate[Pivot Detection & Correlation]
```

1. **Frontend (React/Vite)**: Operates a cyberpunk-style desktop OS paradigm. Uses `Cytoscape.js` for heavy graph rendering and `react-globe.gl` for 3D geospatial IP mapping.
2. **Backend (FastAPI)**: Serves as the gateway, executing concurrent OSINT requests utilizing `asyncio.gather` for rapid fan-out to 19 external connectors.
3. **Correlation Engine**: Utilizes Fellegi-Sunter probabilistic matching for a baseline score, refined by an XGBoost ML classifier. High-confidence nodes are assembled via NetworkX to detect network pivot points.
4. **AI/LLM Tier**: Leverages Groq APIs (Llama 3.3 70B for narrative reports/chat, Llama 3.2 11B Vision for OCR extraction).

---

## 🗄️ Database Schema

The database utilizes PostgreSQL managed via SQLAlchemy ORM.

<details>
<summary><b>Click to expand Entity-Relationship (ER) Diagram</b></summary>

```mermaid
erDiagram
    INVESTIGATOR ||--o{ CASE : leads
    INVESTIGATOR ||--o{ IDENTIFIER : creates
    INVESTIGATOR ||--o{ AUDIT_LOG : actions
    CASE ||--o{ IDENTIFIER : contains
    CASE ||--o{ AUDIT_LOG : has
    CASE ||--o{ CASE_NOTE : has
    CASE ||--o{ LINK_FEEDBACK : has
    CASE ||--o{ ALERT : has
    CASE ||--o{ NOTIFICATION : has
    IDENTIFIER ||--o{ FINDING : produces

    INVESTIGATOR {
        string id PK
        string badge_id UK
        string full_name
        string hashed_password
    }

    CASE {
        string id PK
        string title
        string status
        string lead_investigator_id FK
    }

    IDENTIFIER {
        string id PK
        enum type
        string raw_value
        string normalized_value
        string case_id FK
        string investigator_id FK
    }

    FINDING {
        string id PK
        string identifier_id FK
        string connector_name
        string result_type
        float confidence
        json raw_payload
    }
```
</details>

**Core Tables:**
- `investigators`: Core investigator profiles with bcrypt hashed passwords.
- `cases`: Container for an investigation.
- `identifiers`: Raw seed inputs (IP, email, domain, photo, etc.).
- `findings`: Extracted intel discovered by the OSINT connectors, linked directly to an identifier.
- `audit_logs`: Append-only, cryptographically signed activity tracking for evidentiary chain-of-custody.
- `link_feedbacks`: Stores investigator corrections to graph edges, which are continuously used to retrain the XGBoost model.

---

## 📡 API Documentation

Orion utilizes a RESTful JSON API via FastAPI. 

<details>
<summary><b>Click to expand Core API Routes</b></summary>

### Auth Routes
- `POST /auth/login`: Authenticates an investigator and returns an HS256 JWT `access_token`.
- `POST /auth/signup`: Registers a new investigator (requires Lead Investigator approval).

### Case Routes
- `POST /cases/`: Creates a new case workspace.
- `GET /cases/{case_id}`: Retrieves case metadata.
- `GET /cases/cross-correlate`: Scans the entire database to find identical identifiers shared across multiple separate cases.
- `GET /cases/{case_id}/graph`: Retrieves the computed NetworkX graph (nodes and edges) for Cytoscape rendering.
- `GET /cases/{case_id}/evidence`: Exports the entire case (identifiers, findings, notes, audit logs) as a signed JSON payload.
- `POST /cases/{case_id}/chat`: Sends a query to the LLM (RAG) to chat with the case evidence.
- `GET /cases/{case_id}/narrative`: Triggers Llama 3.3 70B to auto-generate a comprehensive markdown case report.

### Identifier & OSINT Routes
- `POST /identifiers/`: Manually injects a new seed identifier into a case.
- `POST /identifiers/{identifier_id}/run-connectors`: Triggers the async fan-out of 19 OSINT connectors to pull intel for a specific identifier.

### Utilities
- `POST /api/tts`: Uses Edge TTS to stream generated audio buffers in English, Hindi, and Gujarati.
- `WS /ws/cases/{case_id}`: Live WebSocket feed for case updates.

</details>

---

## 📦 Dependencies & Requirements

**Backend (Python 3.10+):**
- **Core API**: `fastapi`, `uvicorn`, `pydantic`
- **Database**: `sqlalchemy`, `pymysql` (PostgreSQL)
- **Security**: `python-jose` (JWT), `passlib`, `bcrypt`
- **ML / Graphing**: `networkx`, `xgboost`, `rapidfuzz` (string matching)
- **AI Integrations**: `groq`, `edge-tts` (Text-to-Speech)
- **OSINT**: `httpx`, `dnspython`, `anyascii` (transliteration)

**Frontend (Node.js 18+):**
- **Core Framework**: `react` 19, `react-dom`, `typescript`, `vite`
- **Styling**: `tailwindcss`, `framer-motion`, `lucide-react`
- **State & Data**: `zustand`, `axios`, `react-router`
- **Visualizations**: `cytoscape`, `react-globe.gl`, `three`
- **Localization**: `react-i18next`, `@indic-transliteration/sanscript`

---

## 🚀 Setup & Installation (Local Development)

### 1. Database & Environment
1. Clone this repository: 
   ```bash
   git clone https://github.com/YourOrg/Orion.git
   ```
2. Set up a PostgreSQL database (e.g., local install or free tier via [Neon.tech](https://neon.tech)).
3. Create a `.env` file in the `backend/` directory based on `backend/.env.example`:
   ```env
   DATABASE_URL=postgresql://user:password@host/dbname
   GROQ_API_KEY=your_groq_key
   SECRET_KEY=your_jwt_secret
   ```

### 2. Backend (FastAPI)
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate | macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
*The API will be available at http://localhost:8000*

### 3. Frontend (React/Vite)
```bash
# In a new terminal window
cd frontend
npm install
npm run dev
```
*The UI will be available at http://localhost:5173*

---

## ☁️ Deployment Instructions

The project is designed to be deployed entirely on free-tier infrastructure.

### Frontend Deployment (Vercel)
1. Import the project into Vercel and select the `frontend` directory as the Root Directory.
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. Set Environment Variables:
   - `VITE_API_BASE_URL`: The URL of your deployed backend (e.g., `https://orion-backend.onrender.com`)
   - `VITE_WS_BASE_URL`: The websocket URL of your backend (e.g., `wss://orion-backend.onrender.com`)

### Backend Deployment (Render)
1. Connect your repo to Render and create a new **Web Service**.
2. Root Directory: `backend`
3. Environment: `Python 3`
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Add your `.env` variables to Render's Environment section.

### Database (Neon.tech)
- Create a free Neon.tech PostgreSQL instance.
- Copy the Connection String and add it as the `DATABASE_URL` environment variable on your Render backend. The backend uses `Base.metadata.create_all` to automatically initialize the schema on first boot.

---

## 👥 Team & Credits
**Hackathon:** ERakshak (2026)  
**Track:** PS_01: Advanced Multi-Platform OSINT Intelligence Aggregator

- Nishchay Mittal 
- Neel Mhaske 
- Leon Lobo 
- Shreya Ashar 

## 📄 License
This project is licensed under the [MIT License](LICENSE).
