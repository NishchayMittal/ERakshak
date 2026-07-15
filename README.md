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
- **Evidentiary Dossier Reports**: Compiles a single source of truth "Evidence Pack" and generates comprehensive case reports in JSON, CSV, and PDF formats, accompanied by Claude-powered LLM narrative synthesis.

## Project Structure

- [`backend/`](backend/): Contains the core correlation engine, APIs, and connector logic. Please refer to [backend/README.md](backend/README.md) for backend-specific instructions.
- [`frontend/`](frontend/): Contains the React UI, graph visualization components, and dossier dashboards.
- [`architecture_doc.md`](architecture_doc.md): Detailed architectural documentation of the system.
- [`implement.md`](implement.md): A 14-day implementation roadmap and design details.

## Disclaimer

To prevent ToS violations, privacy leaks, and financial costs during the prototype evaluation phase, the breach connector queries a **local seeded demo dataset**. Face similarity also utilizes a pure-Python fallback for ease of use across environments.
