# Orion

**Live Demo:** [https://orionerakshak.vercel.app/](https://orionerakshak.vercel.app/)

**Orion** is an OSINT link-analysis and suspect correlation engine built to assist investigative teams in mapping cybercrime networks. The system automates ingestion, normalizes raw suspect data, queries external intelligence databases, detects pivots, and generates evidentiary dossier reports.

## Overview

The system is composed of two main parts:

- **Backend**: A modular, registry-based connector framework written in Python. It handles data ingestion, normalization, external database queries (WHOIS, crt.sh, Wayback Machine, etc.), and link correlation using NetworkX, Fellegi-Sunter baseline, and XGBoost refinement layer.
- **Frontend**: A React-based user interface with Cytoscape.js graph visualizations for investigators to explore links, review model confidences (with SHAP feature explanations), and generate dossier exports.

## Key Features

- **Pluggable Connector Architecture**: Concurrent asynchronous registry loop to query various OSINT sources like WHOIS/RDAP, crt.sh, Web Archive CDX, Breach Repositories, and Face Similarity Matcher.
- **Ingestion & Normalization**: Translates native text scripts to normalized Latin form using a standalone phonetic transliteration engine, dynamically categorizes inputs (emails, domains, phones, etc.), and sanitizes data.
- **NetworkX Link Correlation Engine**: Maps case-wide associations, disambiguates suspects using fuzzy string comparison, and detects key hub entities (pivots). It utilizes a Fellegi-Sunter baseline matcher and an XGBoost refinement layer.
- **Evidentiary Dossier Reports**: Compiles a single source of truth "Evidence Pack" and generates comprehensive case reports in JSON, CSV, and PDF formats, accompanied by local RAG narrative synthesis with optional remote fallback.

## Project Structure

- [`backend/`](backend/): Contains the core correlation engine, APIs, and connector logic. Please refer to [backend/README.md](backend/README.md) for backend-specific instructions.
- [`frontend/`](frontend/): Contains the React UI, graph visualization components, and dossier dashboards.
- [`architecture_doc.md`](architecture_doc.md): Detailed architectural documentation of the system.
- [`implement.md`](implement.md): A 14-day implementation roadmap and design details.

---

## Recommended Deployment: 100% Free Cloud Architecture

Orion is engineered to be deployed entirely for free using a combination of **Vercel** (Frontend), **Render** (Backend), and **Neon** (PostgreSQL).

- **Python 3.10+** (For the backend)
- **Node.js 18+** (For the frontend)
- **Git**
- **sentence-transformers** is installed through the backend Python dependencies for local embeddings
- **Redis** (If running locally without Docker)
- **Docker & Docker Compose** (Highly Recommended for easiest setup)

### Step 1: Database Setup (Neon)
1. Create a free PostgreSQL database on [Neon.tech](https://neon.tech).
2. Copy your Connection String (e.g., `postgresql://...`).

### Step 2: Backend Deployment (Render)
1. Fork or push this repository to your GitHub account.
2. Go to [Render](https://render.com) and create a new **Web Service**.
3. Connect your repository and select the `backend` folder as the Root Directory (or use the provided `render.yaml` blueprint).
4. Render will automatically detect the Python environment and run `./start.sh`.
5. Add the following Environment Variables in the Render dashboard:
   - `DATABASE_URL`: Your Neon connection string.
   - `JWT_SECRET`: A secure random string (generate with `openssl rand -hex 32`).
   - `GROQ_API_KEY`: Your free API key from [console.groq.com](https://console.groq.com).
   - `USE_CELERY`: `false` (forces synchronous execution to fit within free-tier limits).
6. Deploy the service and copy your new backend URL (e.g., `https://orion-api.onrender.com`).

### Step 3: Frontend Deployment (Vercel)
1. Go to [Vercel](https://vercel.com) and create a new Project from your repository.
2. Set the Root Directory to `frontend`.
3. Add the following Environment Variables in Vercel:
   - `VITE_API_URL`: Your Render backend URL (e.g., `https://orion-api.onrender.com/api/v1`).
   - `VITE_API_BASE_URL`: Your Render backend URL.
4. Deploy the frontend! Vercel handles SPA routing automatically via the provided `vercel.json`.

---

## Local Development Setup (Without Docker)

If you prefer to run the application directly on your machine without Docker, follow these steps:

### 1. Backend Setup
1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend/` directory with the following variables:
   ```ini
   DATABASE_URL="sqlite:///./erakshak.db"
   JWT_SECRET="your-super-secret-key-here"
   LOCAL_RAG_ENABLED=true
   RAG_STORE_DIR="app/resources/rag_store"
   RAG_TOP_K=5
   RAG_CHUNK_SIZE=900
   REDIS_URL="redis://localhost:6379/0"
   # Optional fallback only if you want remote synthesis
   # GROQ_API_KEY="your-groq-key"
   ```
10. Start **Redis** locally on port 6379 (only required if `USE_CELERY=true`).
11. Start the Backend API (in the virtual environment):
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   *The API will be available at http://localhost:8000*
12. (Optional) If `USE_CELERY=true`, start the Celery worker in a new terminal:
   ```bash
   celery -A app.core.celery_app worker --loglevel=info
   ```

### 2. Frontend Setup
1. Open a new terminal window and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install the Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   _The frontend UI will automatically open in your browser at http://localhost:5173_

### 4. Setting up the Local RAG Layer

Orion now uses a local retrieval-augmented generation path for chat and report synthesis. Case evidence is indexed locally, embeddings are generated with `sentence-transformers/all-MiniLM-L6-v2`, and chat/report responses are built from the local case index first.

1. Make sure the backend dependencies are installed, including `sentence-transformers`.
2. Keep the backend API and worker running so the local index can be refreshed when cases change.
3. If you want a remote fallback for rare edge cases, set `GROQ_API_KEY` in `backend/.env`; otherwise the system stays local-first.
4. The persisted case index lives under `backend/app/resources/rag_store/` by default, so keep that directory available in your deployment volume or container.

Deployment note: for the already-live website, the UI can stay on the same host, but the backend worker and persistent RAG store must stay available or the system will rebuild indexes on demand and chat/report quality will degrade during restarts.

---

## Alternative Setup: Local & Heavy Production (Docker Compose)

If you have dedicated server hardware and wish to utilize asynchronous task queues (Celery/Redis) and strictly isolated local AI (Ollama) for maximum data sovereignty, use the Docker-based deployment.

### 1. Prerequisites
- **Docker & Docker Compose**
- **Ollama** (Running locally on port 11434 for local AI processing)

### 2. Quick Local Start
Run the entire stack (API, Frontend, Redis, and Celery Worker) using Docker:
```bash
docker compose up --build
```
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000

### 3. Dedicated Production Deployment
For heavy-duty production environments, Orion provides a separate configuration utilizing a persistent PostgreSQL database, Gunicorn, and Nginx.

1. Copy the production template:
   ```bash
   cp .env.prod.example .env.prod
   ```
2. Edit `.env.prod` and supply your secrets, domain CORS rules, and API URLs.
3. Build and run in detached mode:
   ```bash
   docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
   ```
