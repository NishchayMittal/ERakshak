# e-Rakshak

**e-Rakshak** is an OSINT link-analysis and suspect correlation engine built to assist investigative teams in mapping cybercrime networks. The system automates ingestion, normalizes raw suspect data, queries external intelligence databases, detects pivots, and generates evidentiary dossier reports.

## Overview

The system is composed of two main parts:

- **Backend**: A modular, registry-based connector framework written in Python. It handles data ingestion, normalization, external database queries (WHOIS, crt.sh, Wayback Machine, etc.), and link correlation using NetworkX, Fellegi-Sunter baseline, and XGBoost refinement layer.
- **Frontend**: A React-based user interface with Cytoscape.js graph visualizations for investigators to explore links, review model confidences (with SHAP feature explanations), and generate dossier exports.

## Key Features

- **Pluggable Connector Architecture**: Concurrent asynchronous registry loop to query various OSINT sources like WHOIS/RDAP, crt.sh, Web Archive CDX, Breach Repositories, and Face Similarity Matcher.
- **Ingestion & Normalization**: Translates native text scripts to normalized Latin form, dynamically categorizes inputs (emails, domains, phones, etc.), and sanitizes data.
- **NetworkX Link Correlation Engine**: Maps case-wide associations, disambiguates suspects using fuzzy string comparison, and detects key hub entities (pivots). It utilizes a Fellegi-Sunter baseline matcher and an XGBoost refinement layer.
- **Evidentiary Dossier Reports**: Compiles a single source of truth "Evidence Pack" and generates comprehensive case reports in JSON, CSV, and PDF formats, accompanied by LLM narrative synthesis using Ollama.

## Project Structure

- [`backend/`](backend/): Contains the core correlation engine, APIs, and connector logic. Please refer to [backend/README.md](backend/README.md) for backend-specific instructions.
- [`frontend/`](frontend/): Contains the React UI, graph visualization components, and dossier dashboards.
- [`architecture_doc.md`](architecture_doc.md): Detailed architectural documentation of the system.
- [`implement.md`](implement.md): A 14-day implementation roadmap and design details.

---

## Installation & Setup Guide

### 1. Prerequisites

- **Python 3.10+** (For the backend)
- **Node.js 18+** (For the frontend)
- **Git**
- **Ollama** (Optional, for generating AI PDF dossiers completely for free)
- **Redis** (If running locally without Docker)
- **Docker & Docker Compose** (Highly Recommended for easiest setup)

### 2. Recommended Setup: Docker Compose

The easiest way to run the entire stack (API, Frontend, Redis, and Celery Worker) is using Docker.

1. Build and start all services from the root directory:
   ```bash
   docker compose up --build
   ```
2. The services will be available at:
   - **Frontend:** http://localhost:5173
   - **Backend API:** http://localhost:8000

### 3. Local Setup (Without Docker)

#### Backend & Worker Setup

1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:

   ```bash
   python -m venv .venv

   # Windows:
   .\.venv\Scripts\activate

   # Mac/Linux:
   source .venv/bin/activate
   ```

3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend/` directory with the following variables:
   ```ini
   DATABASE_URL="sqlite:///./erakshak.db"
   JWT_SECRET="your-super-secret-key-here"
   OLLAMA_BASE_URL="http://localhost:11434"
   REDIS_URL="redis://localhost:6379/0"
   ```
5. Start **Redis** locally on port 6379.
6. Start the Celery worker (in a new terminal, with the virtual environment activated):
   ```bash
   cd backend
   celery -A app.worker.celery_app worker --loglevel=info
   ```
7. Start the backend API (in a new terminal, with the virtual environment activated):
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```
   _The backend API will now be running at http://127.0.0.1:8000_

#### Frontend Setup

1. Open a **new** terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install the Node modules:
   ```bash
   npm install
   ```
3. Start the React development server:
   ```bash
   npm run dev
   ```
   _The frontend UI will automatically open in your browser at http://localhost:5173_

### 4. Setting up the Local AI (Ollama)

e-Rakshak uses a local, 100% free AI model to generate intelligent summaries for your PDF dossiers without requiring paid API keys.

1. Download and install **Ollama** from [ollama.com](https://ollama.com).
2. Open a terminal and run the following command to download the `llama3` model (this takes a few minutes but you only have to do it once):
   ```bash
   ollama run llama3
   ```
3. Once the model is downloaded and running, the e-Rakshak backend will automatically connect to it to generate dossier narratives! If Ollama is not running, the system will gracefully degrade and output a mock placeholder narrative.

---
