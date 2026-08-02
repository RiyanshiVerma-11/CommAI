# CommAI Workspace Agent Rules & Architecture Guidelines

Welcome to the CommAI workspace. This repository contains a FastAPI backend and a React Vite frontend integrated with glassmorphism styles and multi-channel outreach interfaces.

---

## 1. Directory Structure & Architecture
- **Backend**: Location: `backend/`. FastAPI application running on port `8001` (exposed via docker-compose on `8001:8000`). Database: SQLite (`comm_platform.db`).
- **Frontend**: Location: `frontend/`. React 18 application built with Vite running on port `5173` (exposed on `5173:5173` in development with Vite hot-reloading).

---

## 2. Dynamic DB & SQLAlchemy Import Rule
- **DB Initialization**: The backend automatically registers models and runs schema migrations on startup inside `main.py` using `Base.metadata.create_all(bind=engine)`.
- **Model Import Requirement**: When introducing any new database model, you **must** import the model class explicitly inside `backend/app/main.py` (near line 11) to register its schema with SQLAlchemy. Otherwise, the dynamic table creation will be bypassed on startup.

---

## 3. UI Styling & Layout Wrapping Standards
- **Font & Word Wrapping**: Use `overflow-wrap: break-word;` (not `anywhere`) inside container widgets to prevent squished character wrapping in desktop layouts.
- **Table Structure**: For table columns serving metadata tags (such as urgency badges, channels, dates, and action panels), enforce `white-space: nowrap;` for viewport widths above `768px` to maintain aligned grid systems. Allow standard layout wrapping on mobile screens under `768px`.
- **Theme**: Maintain the premium dark-glassmorphic glassmorphism styling utilizing tailwind configurations and CSS styling variables.

---

## 4. Feature Registries & Patterns
- **Maker-Checker & Proposals Queue**: Campaigns can reside in `draft`, `scheduled`, `active`, `completed`, `cancelled`, `pending_approval` (internal maker-checker queue), or `pending_review` (citizen proposal queue) status.
- **Unified AI Provider Router**: Utilize the sequential LLM router in `app/services/ai_provider.py` which falls back from Gemini to Groq, OpenAI, and Anthropic based on settings key availability.
- **Distress Signals & Incident Triage**: The SOS feature supports coordinates and location-name reporting, anonymous guest alerts, and operator replies using the `reported` -> `acknowledged` -> `resolved` state machine.
- **Export System**: Excel spreadsheets and Word audit reports can be compiled dynamically on-demand from the SQLite database via `export_database_to_excel.py` and `export_database_to_word.py` endpoints.

---

## 5. Development & Docker Workflow
- **Live Reload Compose Setup**: Local file edits are instantly synchronized and live-reloaded inside docker containers.
  - Backend runs with uvicorn `--reload` command override.
  - Frontend runs via `Dockerfile.dev` pointing to Vite dev server HMR.
- **Manual Launchers**: Use the root-level `run.py` script for launching and managing dependencies automatically on host machines outside Docker containers.
