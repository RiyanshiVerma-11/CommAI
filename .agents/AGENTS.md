# CommAI Workspace Agent Rules & Architecture Guidelines

Welcome to the CommAI workspace. This repository contains a FastAPI backend and a React Vite frontend integrated with glassmorphism styles and multi-channel outreach interfaces.

---

## 1. Directory Structure & Architecture
- **Backend**: Location: `backend/`. FastAPI application running on port `8001` (exposed via docker-compose on `8001:8000`). Database: SQLite (`comm_platform.db`).
- **Frontend**: Location: `frontend/`. React 18 application built with Vite running on port `5173` (exposed on `5173:5173` in development with Vite hot-reloading).

---

## 2. Role-Based Access Control (RBAC) — CRITICAL

CommAI is a fully role-gated platform. **Every feature, route, and sidebar item is role-restricted.** There are exactly **3 user roles**:

### `admin` — System Administrator
- **Full access** to every feature and page.
- Can create/manage Campaign Managers (Users table, `role=admin`).
- Only role that can access: **Audit Logs**, **Campaign Managers directory**, **Admin-only approvals**.
- Maker-Checker: Reviews and approves/rejects campaigns submitted by managers.
- Backend role dependency: `require_admin`.
- Mobile bottom nav: Home, Campaigns, Emergency (badged), Approvals, Settings.

### `campaign_manager` — Campaign Manager / Operator
- Can create and manage their own campaigns, templates, poster studio, sentiment map.
- Can view and respond to Emergency Inbox, SOS Reports, Support Queries, AI Fact Shield.
- Can access Audience & Segments for targeting, and Operator Staff Chat (internal).
- **Cannot** access: Audit Logs, Campaign Managers directory, admin-only approvals.
- Backend role dependency: `require_manager_or_higher`.
- Mobile bottom nav: Home, Campaigns, Audience, Templates, Settings.

### `audience` — Citizen / End User
- Very restricted access. This is the **public-facing** citizen role.
- Can view: Dashboard (personal portal), Live Bulletins, Campaign Feedback, Citizen RAG Chat, Settings.
- Can submit SOS/emergency alerts via the ChatbotWidget.
- **Cannot** access any operator or admin pages.
- Backend role dependency: `require_any_authenticated` or `require_audience`.
- Mobile bottom nav: Home, Bulletins, Feedback, Chat, Settings.

### Backend Role Enforcement (auth.py)
```python
require_admin                # Only admin
require_manager_or_higher    # admin + campaign_manager
require_any_authenticated    # admin + campaign_manager + audience
require_audience             # Only audience
```

### Frontend Role Gates (App.jsx)
- Every route `case` in `renderContent()` checks `user.role` before rendering.
- The `Sidebar.jsx` `categories` array filters items by `item.roles.includes(user.role)`.
- The `BottomNavBar.jsx` renders different nav items per role.

---

## 3. Sidebar Navigation Structure (Post-Refactor)

| Category              | Items                                          | Roles                       |
|-----------------------|------------------------------------------------|-----------------------------|
| Core Dashboard        | Dashboard, Live Bulletins                      | All roles                   |
| Campaigns & Broadcasts| Campaign Planner, Templates Library, Approvals Queue, Poster Studio | admin, campaign_manager |
| Audience & Insights   | Audience & Segments, Audience Directory, Sentiment Map, Campaign Feedback | admin, campaign_manager; Feedback also for audience |
| Emergency Operations  | SOS Reports, Emergency Inbox, AI Fact Shield   | admin, campaign_manager     |
| Help Desk & Chat      | Citizen RAG Chat, Support Queries, Operator Staff Chat | mixed (see roles per item) |
| System Governance     | Campaign Managers, Audit Logs                  | admin only                  |
| Preferences           | Settings                                       | All roles                   |

---

## 4. Dynamic DB & SQLAlchemy Import Rule
- **DB Initialization**: The backend automatically registers models and runs schema migrations on startup inside `main.py` using `Base.metadata.create_all(bind=engine)`.
- **Model Import Requirement**: When introducing any new database model, you **must** import the model class explicitly inside `backend/app/main.py` (near line 11) to register its schema with SQLAlchemy. Otherwise, the dynamic table creation will be bypassed on startup.

---

## 5. UI Styling & Layout Wrapping Standards
- **Font & Word Wrapping**: Use `overflow-wrap: break-word;` (not `anywhere`) inside container widgets to prevent squished character wrapping in desktop layouts.
- **Table Structure**: For table columns serving metadata tags (such as urgency badges, channels, dates, and action panels), enforce `white-space: nowrap;` for viewport widths above `768px` to maintain aligned grid systems. Allow standard layout wrapping on mobile screens under `768px`.
- **Theme**: Maintain the premium dark-glassmorphic glassmorphism styling utilizing tailwind configurations and CSS styling variables.
- **Mobile Performance**: On `max-width: 768px`, disable the `.app-container` ambient gradient animation. Use `transform: translateX()` (not `margin-left`) for the sidebar slide. The bottom nav renders role-specific SVG icon tabs.

---

## 6. Feature Registries & Patterns
- **Maker-Checker & Proposals Queue**: Campaigns can reside in `draft`, `scheduled`, `active`, `completed`, `cancelled`, `pending_approval` (internal maker-checker queue), or `pending_review` (citizen proposal queue) status.
- **Unified AI Provider Router**: Utilize the sequential LLM router in `app/services/ai_provider.py` which falls back from Gemini to Groq, OpenAI, and Anthropic based on settings key availability.
- **Distress Signals & Incident Triage**: The SOS feature supports coordinates and location-name reporting, anonymous guest alerts, and operator replies using the `reported` -> `acknowledged` -> `resolved` state machine.
- **Export System**: Excel spreadsheets and Word audit reports can be compiled dynamically on-demand from the SQLite database via `export_database_to_excel.py` and `export_database_to_word.py` endpoints.
- **AI Fact Shield**: Operators submit rumor claims, the AI drafts a fact-check counter-campaign, which then enters the maker-checker approval queue.

---

## 7. Development & Docker Workflow
- **Live Reload Compose Setup**: Local file edits are instantly synchronized and live-reloaded inside docker containers.
  - Backend runs with uvicorn `--reload` command override.
  - Frontend runs via `Dockerfile.dev` pointing to Vite dev server HMR.
- **Manual Launchers**: Use the root-level `run.py` script for launching and managing dependencies automatically on host machines outside Docker containers.
