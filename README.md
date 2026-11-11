# PrintEasy — Digital College Printing Management System

Architecture Proposal v1.0 • Production MVP Implementation

---

## 1. Overview

**PrintEasy** is a modular monolithic web application with role-based access control (RBAC) designed specifically for college printing environments. It eliminates chaotic counter queues, manual USB drive file transfers, and lost print tickets by centralizing document uploads, print configurations, real-time status transitions, and in-app notifications.

### Core Architecture Principles
- **Modular Monolith:** Single unified backend application organized into cohesive domain modules, eliminating microservice complexity while guaranteeing ACID transactions and strict referential integrity.
- **Defense-in-Depth File Security:** Multi-stage PDF validation (`%PDF-` magic bytes, terminal `%%EOF` check, prohibited active scripting rejection), isolated storage paths outside web root, zero direct public URLs, and IDOR prevention.
- **Physical Reality Alignment (Option A):** Staff-controlled printing workflow. Staff download verified documents directly on print-center workstations and print via college printers, preventing discrepancies between software status and physical hardware completion.
- **Deterministic State Machine:** Strict transitions (`PENDING` → `PROCESSING` → `READY` → `COLLECTED`, with `FAILED` and `CANCELLED`), executed atomically with `status_history` logging and in-app student notifications.

---

## 2. Technology Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | React 18 + TypeScript | Single Page Application with separate Student, Staff, and Admin interfaces |
| **Styling** | Tailwind CSS | Responsive, accessible UI with mobile and desktop support |
| **Backend** | Python 3.13 + FastAPI | High-performance asynchronous REST API with automatic OpenAPI validation |
| **Database** | PostgreSQL 16 / SQLAlchemy 2.0 | Relational database with UUIDv4 keys, composite indexes, and ACID transactions |
| **Migrations** | Alembic | Fully versioned database migrations |
| **Authentication** | JWT + Argon2id | Secure bearer tokens with RFC 9106 password hashing parameters |
| **File Storage** | Private Local Filesystem | Isolated POSIX storage (`storage/private/`) with `0600` access controls |
| **Proxy / Gateway**| Nginx | Reverse proxy with 10MB upload ceiling and strict HTTP security headers |
| **Deployment** | Docker & Docker Compose | Containerized multi-service deployment |
| **Testing** | Pytest + Playwright | 100% automated test suite covering all 10 critical security and workflow scenarios |

---

## 3. Project Structure

```
printeasy/
├── frontend/                     # React + TypeScript + Tailwind CSS SPA
│   ├── src/
│   │   ├── components/           # Navbar, StatusBadge, NotificationDropdown, Modal
│   │   ├── context/              # AuthContext (JWT, user state, RBAC guards)
│   │   ├── pages/
│   │   │   ├── auth/             # Login & Register views (with Demo Fast-Fill)
│   │   │   ├── student/          # Student Portal (upload, configure, submit, track)
│   │   │   ├── staff/            # Staff Dashboard (queue, 1-click print, transitions)
│   │   │   └── admin/            # Admin Panel (reports, user management, audit logs)
│   │   ├── services/             # Centralized API fetch client with error handling
│   │   └── types/                # Strict TypeScript domain interfaces
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── backend/                      # FastAPI Modular Monolith
│   ├── app/
│   │   ├── api/v1/               # REST API endpoints (auth, users, documents, print-requests, notifications, admin)
│   │   ├── core/                 # Config (Pydantic Settings), database session, security, exceptions
│   │   ├── middleware/           # Security headers (CSP, HSTS, X-Content-Type-Options)
│   │   ├── models/               # SQLAlchemy 2.0 ORM models (7 core tables)
│   │   ├── schemas/              # Pydantic v2 validation and response schemas
│   │   ├── repositories/         # Database access layer with row-level locks
│   │   ├── services/             # Business domain logic (auth, workflow, documents, notifications, audit)
│   │   ├── utils/                # PDF magic-byte and trailer integrity validator
│   │   └── main.py               # Application entrypoint & lifespan
│   ├── migrations/               # Alembic migration scripts and env configuration
│   ├── tests/                    # Automated Pytest test suite
│   ├── requirements.txt
│   └── Dockerfile
│
├── storage/
│   └── private/                  # Private document storage (never served directly)
├── nginx/
│   ├── nginx.conf                # Main gateway configuration with security headers
│   └── nginx-frontend.conf       # Frontend SPA routing configuration
├── docker-compose.yml            # Multi-container orchestration (PostgreSQL, Backend, Frontend, Gateway)
├── ARCHITECTURE.md               # System Architecture Specification & ADRs
├── DATABASE_SCHEMA.md            # Relational database schema, DDL & ER diagram
├── SECURITY_REVIEW.md            # Threat model (STRIDE), RBAC matrix, IDOR protection
├── TEST_PLAN.md                  # Comprehensive QA test plan & automated execution matrix
├── CODE_REVIEW.md                # Code quality review, convention audits & release sign-off
├── DEVELOPMENT_GUIDE.md          # Local setup, testing, and operational runbooks
├── .env.example                  # Environment variable reference template
└── README.md
```

---

## 4. Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm
- Git

### 1. Backend Setup
```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Run migrations (or let FastAPI initialize SQLite tables on dev startup)
alembic upgrade head

# Run tests
pytest backend/tests/ -v

# Start FastAPI backend
uvicorn app.main:app --app-dir backend --reload --port 8000
```
Interactive API documentation will be accessible at: `http://localhost:8000/api/v1/docs`

### 2. Frontend Setup
```bash
# In another terminal window:
cd frontend
npm install
npm run build
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 5. Docker Compose Deployment

Run the complete production-grade multi-container stack with one command:

```bash
# Copy and configure environment variables
cp .env.example .env

# Build and start all services
docker compose up --build -d
```

Services started:
- `printeasy-gateway`: Nginx reverse proxy on port `80`
- `printeasy-frontend`: React Single Page Application
- `printeasy-backend`: FastAPI application on port `8000`
- `printeasy-postgres`: PostgreSQL 16 database with persisted volume

---

## 6. Demo Accounts (Fast-Fill Available on Login Screen)

| Role | Email | Password | Allowed Capabilities |
|---|---|---|---|
| **Student** | `student@college.edu` | `Password123!` | Upload PDFs, submit jobs, track own status, receive alerts, cancel pending requests |
| **Staff** | `staff@college.edu` | `Password123!` | View FIFO queue, download PDFs to print, update job statuses (Processing, Ready, Collected, Failed) |
| **Admin** | `admin@college.edu` | `Password123!` | Full permissions: view reports, manage user roles & active state, inspect immutable forensic audit logs |

---

## 7. Automated Test Suite

Run the full automated test suite verifying all 10 critical security and workflow scenarios:

```bash
pytest backend/tests/ -v
```

Test coverage includes:
- Authentication & Argon2id password hashing
- Duplicate email rejection & credential verification
- PDF magic bytes (`%PDF-`) validation & trailer verification
- Rejection of corrupted files, non-PDFs, and active scripting payloads
- Insecure Direct Object Reference (IDOR) student isolation
- Staff-authorized document downloads
- Finite State Machine lifecycle: `PENDING` → `PROCESSING` → `READY` → `COLLECTED`
- Rejection of illegal status transitions (e.g., `PENDING` directly to `COLLECTED`)
- Student status update restrictions (students cannot self-advance jobs)
- In-app notification creation, unread counts, and mark-as-read
- Admin reporting, user promotion, and immutable audit logging
