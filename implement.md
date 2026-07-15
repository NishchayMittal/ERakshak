# Implementation Plan — 14-Day Build Plan

This document details the day-by-day roadmap and technical design to complete the e-Rakshak OSINT suspect correlation engine. The plan addresses the architecture re-alignment, including the Fellegi-Sunter baseline matcher, XGBoost + SHAP refinement layer, pivot-back loop, deterministic evidence pack, and LLM narrative synthesis.

---

## User Review Required

> [!WARNING]
> **XGBoost Refinement Risk**: XGBoost requires a synthetic labeled dataset (match/no-match) to be generated on Days 1–2 by P2. The Fellegi-Sunter baseline is our core fallback; if XGBoost doesn't converge or is not ready, we can run on Fellegi-Sunter alone. We must establish this design on Day 1.

> [!IMPORTANT]
> **Single Source of Truth**: The "Evidence Pack" compiled by P4 is the absolute source of truth. Both the React/Cytoscape UI and all export formats (JSON, CSV, PDF) must consume this exact object. P3 and P4 must not create separate data-shaping paths.

---

## Proposed Changes

### Component 1: Connectors & Canonicalization (P1 Lane)

#### [NEW] [canonicalizer.py](file:///c:/Education/SVNIT/Coding/Projects/ERakshak/backend/app/connectors/canonicalizer.py)
- Create a canonicalization utility that processes raw connector findings.
- Performs domain-stripping, casing standardization, phone normalization via `phonenumbers` library, name Romanization via `anyascii`, and duplicate removal from identical source types.

#### [MODIFY] [cases.py](file:///c:/Education/SVNIT/Coding/Projects/ERakshak/backend/app/routers/cases.py) & [identifiers.py](file:///c:/Education/SVNIT/Coding/Projects/ERakshak/backend/app/routers/identifiers.py)
- Implement the **Pivot-Back Loop** in the identifier submission and run-connectors pipeline:
  - If a connector runs and yields a high-confidence finding of an identifier type (e.g. registrant email from WHOIS, username from breach record, or face match finding a name), check if it already exists as an identifier in the case.
  - If it is new, insert it into the `identifiers` table and automatically invoke its connectors asynchronously (up to a recursion depth of 2 to prevent infinite loops).

---

### Component 2: Correlation Engine (P2 Lane)

#### [NEW] [matcher.py](file:///c:/Education/SVNIT/Coding/Projects/ERakshak/backend/app/correlation/matcher.py)
- **Fellegi-Sunter Baseline**:
  - Compares pairs of identifiers within a case across three criteria: string similarity (using `rapidfuzz.fuzz`), exact match (usernames, emails, phones), and domain co-occurrence.
  - Estimates match weight log-likelihood ratios based on m-probabilities and u-probabilities computed using the synthetic dataset.
  - Returns a baseline linkage confidence score.
- **XGBoost Refinement Layer**:
  - Loads a trained XGBoost model using Fellegi-Sunter comparison vectors as features.
  - Refines the baseline score when it exceeds a minimum threshold.
- **SHAP Feature Contribution**:
  - Computes top 3 contributing features per match decision based on model weights/SHAP values and includes them in the edge metadata.

#### [NEW] [generate_synthetic.py](file:///c:/Education/SVNIT/Coding/Projects/ERakshak/backend/app/correlation/generate_synthetic.py)
- Script to generate synthetic matching and non-matching record pairs based on the demo personas (Alpha & Beta) and decoy names, domains, and phone numbers.

---

### Component 3: Frontend & Visualization (P3 Lane - you)

#### [MODIFY] [GraphView.tsx](file:///c:/Education/SVNIT/Coding/Projects/ERakshak/frontend/src/components/graph/GraphView.tsx)
- Render custom styles for confidence-weighted edges.
- Add an interactive side-drawer or popover when clicking on an edge showing:
  - Match confidence (e.g., 92%).
  - Match type (Fellegi-Sunter Baseline vs XGBoost Refined).
  - SHAP explanation (e.g. "Top contributing factors: Name Similarity, Email Domain Matching").
  - A "Confirm Link" and "Reject Link" button action.

#### [MODIFY] [ExportMenu.tsx](file:///c:/Education/SVNIT/Coding/Projects/ERakshak/frontend/src/components/export/ExportMenu.tsx)
- Wire up the JSON, CSV, and PDF buttons to request real endpoints from the backend.

---

### Component 4: Persistence, Evidence & Synthesis (P4 Lane)

#### [MODIFY] [models.py](file:///c:/Education/SVNIT/Coding/Projects/ERakshak/backend/app/models.py)
- Add a schema for investigator feedback:
  ```python
  class LinkFeedback(Base):
      __tablename__ = "link_feedbacks"
      id: Mapped[str] = mapped_column(String, primary_key=True)
      case_id: Mapped[str] = mapped_column(String, ForeignKey("cases.id"))
      source_id: Mapped[str] = mapped_column(String)
      target_id: Mapped[str] = mapped_column(String)
      status: Mapped[str] = mapped_column(String) # "confirmed" / "rejected"
      investigator_id: Mapped[str] = mapped_column(String, ForeignKey("investigators.id"))
      timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
  ```

#### [NEW] [compiler.py](file:///c:/Education/SVNIT/Coding/Projects/ERakshak/backend/app/synthesis/compiler.py)
- **Evidence Compiler**: Reads identifiers, findings, and confirmed links from the database, filters out rejected links, and compiles a single, structured, source-cited JSON "Evidence Pack".

#### [NEW] [narrative.py](file:///c:/Education/SVNIT/Coding/Projects/ERakshak/backend/app/synthesis/narrative.py)
- Call the Claude API passing the Evidence Pack.
- Restrict narrative output to only mention verified facts in the evidence pack, providing citations (e.g., WHOIS, crt.sh) for every statement.

---

## 14-Day Day-by-Day Plan

### Day 1 — Schema Agreements & Setup
- **Shared**: Finalize the graph node/edge schema (confidence scale, source provenance, SHAP features metadata) and stand up PostgreSQL.
- **P1**: Build the initial identifier type router framework and prepare connector mocks.
- **P2**: Generate the synthetic labeled training pairs for XGBoost (`generate_synthetic.py`).
- **P3**: Sync existing `GraphNode` and `GraphEdge` TypeScript interfaces with P2's schema; adjust graph components.
- **P4**: Update PostgreSQL schema to support `link_feedbacks` table and audit log operations.

### Day 2 — Router Skeleton & Pipeline Flow
- **P1**: Complete router and final connector interface contracts.
- **P2**: Initialize NetworkX graph store operations for case loading.
- **P3**: Build static UI mocks for SHAP explanations list and confirm/reject button layout in the frontend edge detail view.
- **P4**: Implement Case persistence CRUD and write audit log events for each pipeline stage.

### Day 3 — WHOIS & crt.sh Connectors
- **P1**: Finalize domain connectors (`whois_rdap` and `crtsh`).
- **P2**: Implement canonicalization and intra-source deduplication pipeline.
- **P3**: Build loading states and error visual fallbacks for graph panels.
- **P4**: Build case status update endpoints and investigator auth refinement.

### Day 4 — Archive & Username Connectors
- **P1**: Implement Wayback Machine CDX and username enumeration connectors.
- **P2**: Implement Fellegi-Sunter comparison vector generator.
- **P3**: Implement CaseNotes and timeline panel components with real mock data.
- **P4**: Build CRUD endpoints for Case Notes and audit timeline logs.

### Day 5 — Face Similarity & Pivot Loop Checkpoint
- **P1**: Implement face matching and the recursive pivot-back loop.
- **P2**: Complete the Fellegi-Sunter baseline matcher and estimate EM weightings.
- **P3**: Test UI visual rendering with complex graph mocks containing pivot points.
- **P4**: Stand up the Postgres endpoint for analyst feedback (confirm/reject link).
- *Milestone Checkpoint*: Pipeline fan-out and Fellegi-Sunter scoring are fully operational end-to-end.

### Day 6 — Scoring Wiring & Graph Store Live
- **P2**: Save Fellegi-Sunter confidence scores to NetworkX edges.
- **P3**: Fetch and render real graph structure (with baseline scores) for the first time.
- **P4**: Connect front-end confirm/reject clicks to PostgreSQL database writes.

### Day 7 — XGBoost Integration
- **P2**: Train and save the XGBoost model using synthetic labels.
- **P4**: Wire the manual XGBoost model retrain API trigger.
- **P3**: Implement model retraining status checks in the dashboard settings page.

### Day 8 — SHAP Explainability & API
- **P2**: Extract SHAP values (top 3 features) and expose them on edges via the backend API.
- **P3**: Add the SHAP list/simple bar to the frontend Edge Panel.
- *Milestone Checkpoint*: E2E scoring, training, and explainability work for primary seed identifier types.

### Day 9 — Feedback Retraining Loop
- **P4**: Implement background retraining job triggered on investigator feedback.
- **P2**: Tune match thresholds using pipeline outputs.
- **P1**: Add error retries and rate-limiting limits to all 4 connector categories.

### Day 10 — Evidence Compiler
- **P4**: Build the deterministic evidence compiler to generate the shared "Evidence Pack".
- **P3**: Update profile card and timeline components to consume the Evidence Pack instead of direct findings.

### Day 11 — LLM Narrative Synthesis
- **P4**: Set up Claude API query inside `narrative.py` using strictly-bounded system prompt context.
- **P3**: Build an LLM report view/panel in the Dossier UI dashboard.

### Day 12 — Export Refinement
- **P4**: Rewrite PDF, CSV, and JSON export endpoints to consume the structured Evidence Pack + Claude narrative.
- **P3**: Connect frontend ExportMenu buttons to download the new compiled dossier formats.

### Day 13 — worked Example & Hardening
- **Shared**: Feed one seed identifier through the system. Verify: Router -> Connectors -> Pivot-back -> Canonicalization -> Fellegi-Sunter & XGBoost -> Graph Store -> Analyst confirms link -> Evidence Compiler -> Claude API -> UI & PDF exports match.

### Day 14 — Packaging & Delivery
- **Shared**: Bug fix, final UI polish (glassmorphism accents, cyber-grid highlights), compile architecture documentation.

---

## Verification Plan

### Automated Tests
- Connectors health: `pytest backend/tests/test_connectors.py`
- Normalizer validation: `pytest backend/tests/test_normalize.py`
- Matcher validation: Run match checks on synthetic pairs using a test script.

### Manual Verification
1. Feed a domain seed (e.g. `suspect-domain.com`) and verify that its subdomains and registrant details are parsed.
2. Confirm a suggested link in the graph and verify that the feedback database stores it.
3. Export the PDF dossier and ensure the compiled evidence and LLM narratives are identical to the screen data.
