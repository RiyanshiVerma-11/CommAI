# CommAI: AI-Based Multilingual Mass Communication & Public Awareness Management Platform

[![Milestone](https://img.shields.io/badge/Milestone-2%20Complete-success?style=for-the-badge&logo=rocket)](#-milestone-2-completed-features)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker)](https://docker.com)

**CommAI** is a full-stack, AI-powered multilingual mass communication and public awareness platform that enables organizations (government departments, healthcare agencies, educational institutions, emergency services, NGOs) to target, compose, translate, broadcast, and monitor public campaigns across multiple channels (Email, SMS, WhatsApp, Push Notifications, Voice Bulletins, and Interactive Web Portals).

---

## 🏆 MILESTONE 2: COMPLETED FEATURES & ADVANCED ENHANCEMENTS

Milestone 2 expands CommAI into a production-grade, multi-modal emergency broadcast and public engagement platform with neural speech synthesis, real-time WebSocket chimes, multi-tiered AI translation failovers, poster graphics generation, and strict governance safety controls.

### 1. 🔊 Neural Indic AI Voice Bulletin Engine (23 Official Languages)
- **Microsoft Edge Neural Speech Integration**: High-fidelity neural voice models for Indic languages (`hi-IN-MadhurNeural`, `hi-IN-SwaraNeural`, `bn`, `ta`, `te`, `mr`, `gu`, `kn`, `ml`, `ur`, `en`).
- **Zero-Downtime Speech Fallback (`gTTS`)**: Automatic failover to Google Text-to-Speech for regional dialects (`pa`, `or`, `as`, `ne`, `sd`, `sa`, etc.).
- **Multi-Tier Translation Service**: Zero-cost fallback pipeline combining primary Groq LLM (`llama-3.3-70b-versatile`), secondary Groq key (`llama-3.1-8b-instant`), and Google GTX Translate API.
- **React Portal Glassmorphism Voice Player**: Floating modal rendered directly via `ReactDOM.createPortal` on `document.body` to prevent CSS clipping/overlap on any dashboard card, high-contrast bold speech scripts, speed controls (`0.75x`, `1x`, `1.25x`), and instant multi-language audio streaming.

### 2. 🎨 AI Visual Poster Studio & Served Binary Image Endpoint
- **Canvas Composite Engine**: Custom composite system overlaying multilingual typography, emergency headers, and official seals on AI-generated background imagery.
- **Served Binary Images**: Dedicated binary image streaming endpoint (`/api/poster/{id}/image`) to prevent CORS issues, enable fast caching, and support direct inline previews.

### 3. 📧 Inline Email Image Attachments (CID & Credentials Helper)
- **Inline MIME Attachments**: Automatically parses and attaches poster media files in emails as inline MIME attachments (`cid:` references).
- **Credentials Normalization**: Automatic credentials normalization helper (Gmail App Password space-stripping and validation) to prevent SMTP authentication failures.

### 4. ⚡ Real-Time WebSocket Alert Engine & Audio Broadcast Chimes
- **Live Broadcast Listeners**: WebSockets attached to citizen and operator dashboards that trigger real-time toast popups and audio chime notifications whenever an emergency flyer or bulletin is published.
- **Zero-Reload Updates**: Dynamically updates active campaign lists and alert feeds without requiring manual page refreshes.

### 5. 🛡️ Maker-Checker Four-Eye Governance System
- **Emergency Safety Guardrails**: Prevents unauthorized or panic-inducing emergency broadcasts. Any campaign targeting $\ge 100$ citizens or marked as `Emergency` requires explicit Administrator approval/rejection before dispatching.
- **Audit Trails**: Full audit logging for every administrative review action.

### 6. 📊 Sentiment Map & Interactive Geographic Analytics
- **Geospatial Intelligence**: District-level citizen sentiment map and interactive feedback heatmap analytics for public feedback tracking.

---

## 🛠️ Technology Stack

- **Backend**: Python 3.11, FastAPI (web services), SQLAlchemy (ORM), SQLite (local database), Pydantic (validation), Passlib & bcrypt (security), Python-Jose (JWT tokens), Pytest (testing), Edge-TTS, gTTS, Requests.
- **Frontend**: React (Vite), JavaScript, custom HTML5/CSS3 (glassmorphic dark theme, custom responsive grid system, micro-animations).
- **Core AI Integration**: Groq API (`llama-3.3-70b-versatile` & `llama-3.1-8b-instant` models) with multi-tier fallback.

---

## 📊 System Architecture & Database Design

### 1. Component Architecture
```mermaid
graph TD
    subgraph client_layer ["Client Layer (Frontend)"]
        ReactApp["Vite + React.js SPA"]
        VanillaCSS["Custom Glassmorphism CSS"]
        VoicePlayer["React Portal Voice Bulletin Player"]
    end

    subgraph api_layer ["API Layer (Backend)"]
        FastAPI["FastAPI Web Framework"]
        AuthMiddleware["JWT & RBAC Middleware"]
        RouterAuth["Auth Router (Simulated OTP)"]
        RouterAudience["Audience & Segment Router"]
        RouterTemplate["Template Library Router"]
        RouterCampaign["Campaign Planner Router"]
        RouterVoice["Voice Bulletin Router"]
        RouterSettings["Settings Router (SMTP / CallMeBot / Groq)"]
        RouterAI["AI Content Engine Router"]
        RouterEmergency["Emergency Contact Router"]
    end

    subgraph services_layer ["Background & AI Services Layer"]
        Scheduler["Campaign scheduler.py"]
        Dispatcher["Message dispatcher.py"]
        EmailService["Email email_service.py (SMTP + CID Attachments)"]
        WAService["WhatsApp whatsapp_service.py (CallMeBot)"]
        VoiceService["Voice Service voice_service.py (Edge-TTS + gTTS)"]
        TranslationService["Translation Service translation_service.py (Groq + GTX)"]
        AIService["AI Engine ai_service.py"]
    end

    subgraph data_layer ["Data Layer"]
        SQLAlchemy["SQLAlchemy ORM Layer"]
        SQLite["SQLite (comm_platform.db)"]
        AudioCache["Static Audio Cache MP3s"]
    end

    ReactApp -->|HTTP requests + JWT Token| AuthMiddleware
    AuthMiddleware --> RouterAuth
    AuthMiddleware --> RouterAudience
    AuthMiddleware --> RouterTemplate
    AuthMiddleware --> RouterCampaign
    AuthMiddleware --> RouterVoice
    AuthMiddleware --> RouterSettings
    AuthMiddleware --> RouterAI
    AuthMiddleware --> RouterEmergency

    RouterCampaign --> Dispatcher
    Scheduler --> Dispatcher
    Dispatcher --> EmailService
    Dispatcher --> WAService

    RouterVoice --> VoiceService
    VoiceService --> TranslationService
    VoiceService --> AudioCache

    RouterAI --> AIService

    RouterAuth --> SQLAlchemy
    RouterAudience --> SQLAlchemy
    RouterTemplate --> SQLAlchemy
    RouterCampaign --> SQLAlchemy
    RouterSettings --> SQLAlchemy
    RouterEmergency --> SQLAlchemy

    SQLAlchemy -->|Reads/Writes SQL| SQLite
```

### 2. Entity-Relationship Diagram (ERD)
```mermaid
erDiagram
    users {
        string id PK
        string email "unique"
        string hashed_password
        string full_name
        string role "admin | campaign_manager | communicator"
        string organization
        string designation
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }
    
    audiences {
        string id PK
        string first_name
        string last_name
        string email
        string phone "unique"
        text preferred_languages "JSON array"
        string occupation
        integer age
        string gender
        string state
        string district
        string city
        string organization
        string department
        string designation
        text preferred_channels "JSON array"
        boolean is_active
        boolean is_deleted
        timestamp created_at
    }
    
    segments {
        string id PK
        string name "unique"
        string description
        text filter_criteria "JSON structure"
        boolean is_dynamic
        integer estimated_size
        timestamp last_refreshed
        timestamp created_at
    }
    
    templates {
        string id PK
        string title
        string description
        string category "emergency | awareness | education | announcement"
        string channel "email | sms | whatsapp | push | website"
        string default_language
        text subject_template
        text body_template
        text translations "JSON Cache: lang -> {subject, body}"
        boolean is_ai_generated
        integer version
        string created_by FK
        boolean is_deleted
        timestamp created_at
    }

    campaigns {
        string id PK
        string title
        string description
        text objective
        string campaign_type
        string status "DRAFT | SCHEDULED | ACTIVE | COMPLETED"
        string segment_id FK "nullable"
        string template_id FK "nullable"
        text custom_subject "nullable"
        text custom_body "nullable"
        text channel_preferences "JSON array"
        integer target_audience_count
        integer estimated_reach
        integer sent_count
        integer failed_count
        string created_by FK
        string updated_by FK
        timestamp scheduled_at "nullable"
        timestamp dispatched_at "nullable"
        timestamp created_at
        timestamp updated_at
    }

    delivery_logs {
        string id PK
        string campaign_id FK
        string audience_id FK
        string channel "email | sms | whatsapp"
        string language
        string status "sent | failed"
        text error_message "nullable"
        timestamp timestamp
    }

    audit_logs {
        string id PK
        string user_id FK
        string campaign_id FK "nullable"
        string action "CREATE | UPDATE | STATUS_CHANGE | DELETE"
        string old_status "nullable"
        string new_status "nullable"
        text changes "JSON representation"
        timestamp timestamp
    }

    blacklist {
        string id PK
        string type "email | phone"
        string value "unique"
        timestamp created_at
    }

    emergency_contacts {
        string id PK
        string user_id FK
        string subject
        text message
        string urgency "normal | urgent | critical"
        string status "open | acknowledged | resolved"
        text admin_reply "nullable"
        timestamp replied_at "nullable"
        timestamp created_at
    }

    users ||--o{ templates : "creates"
    users ||--o{ campaigns : "creates"
    users ||--o{ audit_logs : "performs"
    segments ||--o{ campaigns : "targets"
    templates ||--o{ campaigns : "binds"
    campaigns ||--o{ delivery_logs : "broadcasts"
    campaigns ||--o{ audit_logs : "records"
    users ||--o{ emergency_contacts : "submits"
```

---

## 📅 Week-by-Week Implementation & Feature Screenshots

### 🏆 Milestone 1: Core Platform Foundation

- **Public Landing Page**: Public-facing entry portal welcoming citizens and operators.
  
  ![Public Landing Page](docs/screenshots/milestone%201/landing.png)

- **Authentication & RBAC**: Secure operator sign-in with JWT verification and multi-tiered roles (Admin, Campaign Manager, Communicator).
  
  ![Login Screen](docs/screenshots/milestone%201/login.png)

- **Overview Dashboard**: High-level telemetry for active campaigns, public reach, segment size, and live integration latency.
  
  ![Overview Dashboard](docs/screenshots/milestone%201/dashboard.png)

- **Audience Management & Segmentation**: Dynamic segment builder with demographic progress indicators.
  
  ![Audience Management](docs/screenshots/milestone%201/audiences.png)

- **Template Library**: Central repository managing templates across delivery channels and categories.
  
  ![Template Library](docs/screenshots/milestone%201/templates.png)

- **Campaign Planner**: Consolidated grid for scheduled broadcasts and delivery auditing.
  
  ![Campaign Planner](docs/screenshots/milestone%201/campaigns.png)

- **Maker-Checker Governance (Four-Eye Principle)**: Safety guardrail queue for emergency campaign approval ($\ge 100$ recipients).
  
  ![Approvals Queue](docs/screenshots/milestone%201/approvals.png)

- **Campaign Wizard & AI Assistant**: Groq API integration for drafting campaign subject lines and copy presets.
  
  ![Campaign Wizard & AI Assistant](docs/screenshots/milestone%201/campaign_wizard.png)

- **System Diagnostics Dashboard**: Real-time integration latency checks for Groq, SMTP, and CallMeBot gateways.
  
  ![System Diagnostics Dashboard](docs/screenshots/milestone%201/settings.png)

---

### 🚀 Milestone 2: Advanced Speech, Visual & Governance Engine

- **AI Visual Poster Studio**: Canvas composite engine with multilingual typography overlays and served binary image previews (`/api/poster/{id}/image`).
  
  ![AI Visual Poster Studio](docs/screenshots/milestone%202/poster_studio.png)

- **Neural Indic Voice Bulletin Player**: Edge-TTS & gTTS neural speech synthesis engine across 23 official languages with React Portal modal controls.
  
  ![Neural Voice Bulletin Player](docs/screenshots/milestone%202/live_bulletins.png)

- **Real-Time Operator Staff Chat & WebSocket Alert Engine**: Live WebSocket communication channels with role badges, sound chimes, and instant updates.
  
  ![Real-Time Operator Staff Chat](docs/screenshots/milestone%202/staff_chat.png)

- **Geospatial Sentiment Map & Heatmap Analytics**: District-level citizen sentiment tracking and interactive emergency heatmap.
  
  ![Geospatial Sentiment Map](docs/screenshots/milestone%202/sentiment_map.png)

- **Citizen Emergency Inbox & SOS Request Management**: Dedicated portal monitoring citizen emergency inquiries with automated AI response drafting.
  
  ![Emergency Inbox & SOS Tracking](docs/screenshots/milestone%202/emergency_inbox.png)

- **Support Queries Desk & AI Help Desk**: Citizen support ticketing desk with automated AI response suggestions and escalation tracking.
  
  ![Support Queries & AI Help Desk](docs/screenshots/milestone%202/admin_portal_for_support_queries.png)

---

## ⚙️ Seed & Test Execution

### Seeding Template Collections
To seed default message templates across all channels and categories:
```powershell
$env:PYTHONPATH="backend"; .\venv\Scripts\python -m app.seed_all_templates
```

### Seeding Performance Datasets
To load 5,000 recipient records into the database:
```powershell
$env:PYTHONPATH="backend"; .\venv\Scripts\python backend/app/seed_performance.py
```

### Run Integration Tests
From the root folder:
```powershell
$env:PYTHONPATH="backend"; .\venv\Scripts\pytest backend\tests\
```

---

## 🐳 Docker Deployment (One-Command Setup)

Run the entire platform with one command using Docker Compose:

1. From the project root:
   ```bash
   docker-compose up --build
   ```
2. Access services at:
   - **Frontend UI**: `http://localhost:5173`
   - **Backend OpenAPI Swagger Docs**: `http://localhost:8001/docs`

---

## 🏃 Local Setup & Launch Instructions (Manual)

### 1. Run Backend Services
```powershell
cd backend
.\venv\Scripts\activate
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```
- Swagger documentation: `http://127.0.0.1:8001/docs`

### 2. Run Frontend Services
```powershell
cd frontend
npm install
npm run dev
```
- Frontend UI: `http://localhost:5173`
- **Admin login**: `admin@example.com` / `AdminPassword123!` (OTP code: `123456`)
