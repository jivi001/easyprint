# PrintEasy - Architecture Specification & System Blueprint
**Digital College Printing Management System**
**Document Version:** 1.0.0  
**Status:** Approved / Core Baseline  
**System Architecture Lead:** SUBAGENT 01 — System Architect  

---

## Table of Contents
1. [Executive Architecture Summary](#1-executive-architecture-summary)
2. [High-Level Architecture & 4-Tier Topology](#2-high-level-architecture--4-tier-topology)
3. [Module Boundaries & Dependency Graph](#3-module-boundaries--dependency-graph)
4. [API Integration Guidelines & REST Contracts](#4-api-integration-guidelines--rest-contracts)
5. [Database Interaction Patterns & Transaction Boundaries](#5-database-interaction-patterns--transaction-boundaries)
6. [Architecture Decision Records (ADRs)](#6-architecture-decision-records-adrs)
   - [ADR-001: Modular Monolith vs Microservices](#adr-001-modular-monolith-vs-microservices)
   - [ADR-002: Manual Staff-Controlled Printing (Option A) vs Automated CUPS (Option B)](#adr-002-manual-staff-controlled-printing-option-a-vs-automated-cups-option-b)
   - [ADR-003: Private Local File Storage with Authorized Proxy Downloads](#adr-003-private-local-file-storage-with-authorized-proxy-downloads)
   - [ADR-004: JWT Access Token with HTTP-Only Cookies and Secure Headers](#adr-004-jwt-access-token-with-http-only-cookies-and-secure-headers)
   - [ADR-005: Separation of Print Settings & Request Lifecycle](#adr-005-separation-of-print-settings--request-lifecycle)
7. [Architectural Risks and Mitigations](#7-architectural-risks-and-mitigations)
8. [Single Print Center Scope vs Multi-Department Expansion Readiness](#8-single-print-center-scope-vs-multi-department-expansion-readiness)

---

## 1. Executive Architecture Summary

### 1.1 Context & Problem Statement
Campus printing in academic institutions is traditionally characterized by chaotic walk-in counter queues, paper wastage, unaccounted costs, unmanaged printer jams, and severe data privacy violations caused by students leaving sensitive assignments, exams, or personal identity documents on public flash drives or shared computer desktops. 

**PrintEasy** is a centralized, digital college printing management platform designed to streamline print job submissions, manage automated pricing and quotas, protect student and institutional document confidentiality, and coordinate print fulfillment through staff-operated production workflows.

### 1.2 Core Architectural Principles
PrintEasy is designed under six fundamental engineering principles:
1. **Strict Defense-in-Depth for File Assets:** Uploaded documents are untrusted binary blobs. They are never placed under a public web directory, never executed, and never accessible via guessable URLs.
2. **Deterministic State Machine:** A print job must transition through strictly enforced, unidirectional lifecycle phases. Concurrent state changes are prevented via pessimistic locking.
3. **Low Operational Overhead (Modular Monolith):** Rather than fragmenting the domain across microservices with high network and operational tax, PrintEasy is built as a single, strongly encapsulated modular backend codebase that deploys as a cohesive unit.
4. **Physical Reality Alignment (Human-in-the-Loop Fulfillment):** Commercial college print rooms rely on varied paper stocks, manual binding, and physical inspection. The system models the digital-to-physical handoff accurately by supporting staff-controlled fulfillment before hardware-automated triggers.
5. **Auditable Accountability:** Every financial charge (quota or balance deduction), document access attempt, and job status change is recorded in an immutable audit log.
6. **Stateless API Services with Managed DB Sessions:** FastAPI instances remain stateless, delegating persistence, concurrency guarantees, and transactions strictly to PostgreSQL with explicit transaction boundaries.

### 1.3 Target Technology Matrix
| Layer | Technology | Version | Rationale |
| :--- | :--- | :--- | :--- |
| **Frontend** | React, TypeScript, Tailwind CSS | React 18+, TS 5+, Tailwind 3.4+ | Type safety, component reuse, fast responsive UI for desktop and mobile |
| **Backend Framework** | Python / FastAPI | Python 3.11+, FastAPI 0.110+ | High-performance async I/O, Pydantic v2 validation, native OpenAPI docs |
| **ORM & Migrations** | SQLAlchemy 2.0 (Async) + Alembic | SQLAlchemy 2.0.x, Alembic 1.13+ | Modern 2.0 typed select syntax, robust connection pooling, automated schema migrations |
| **Relational Database** | PostgreSQL | 16+ | ACID compliance, JSONB support, row-level locking (`FOR UPDATE`), strong indexing |
| **Cryptography / Auth** | Argon2id + PyJWT | argon2-cffi, pyjwt | Memory-hard password hashing (OWASP standard), tamper-proof signed claims |
| **Document Processing**| pypdf / pdfminer.six / python-magic | Latest stable | Metadata extraction, strict page counting, MIME verification |
| **Storage Engine** | Local POSIX Filesystem | Linux ext4 / XFS | Local private mount (`/storage/private`), zero public ingress, portable to S3/MinIO |

---

## 2. High-Level Architecture & 4-Tier Topology

The system is organized into four distinct horizontal layers with strict unidirectional dependency flow from top to bottom.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                              │
│   React 18 SPA (TypeScript + Tailwind CSS + Vite)                     │
│   ├── Student Portal: Upload, Configure Settings, Track Status        │
│   ├── Faculty Portal: Quota Tracking, Batch Submissions                │
│   ├── Staff/Operator Terminal: Live Queue, PDF Preview/Proxy, Dispatch │
│   └── Admin Console: Quotas, Pricing Rules, System Audit, Analytics    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / REST (JSON) / Multipart Uploads
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                              │
│   FastAPI Modular Backend (Python 3.11+)                               │
│   ├── Routing & Security: CORS, Rate Limiter, HTTP-only Cookie/Bearer  │
│   ├── Role-Based Access Control (RBAC): Student, Faculty, Staff, Admin  │
│   ├── Module Services:                                                 │
│   │   ├── Auth & User Service                                          │
│   │   ├── Document & Validation Service (Magic Bytes, Page Counting)   │
│   │   ├── Print Job Lifecycle State Engine                             │
│   │   ├── Cost Calculation & Quota Billing Service                     │
│   │   └── Audit Logging & Event Dispatch                               │
│   └── Background Processing: File Cleanup, Async Notifications         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Async Sessions (SQLAlchemy 2.0)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                  │
│   PostgreSQL 16 Relational Engine                                      │
│   ├── Core Tables: users, roles, documents, print_settings, print_jobs │
│   ├── Financial Tables: user_quotas, billing_transactions, pricing_grid│
│   ├── Audit & Telemetry: audit_logs, job_status_history                │
│   └── Concurrency Controls: Row-level locks, Foreign Key constraints   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ POSIX I/O / Security Subsystem
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       INFRASTRUCTURE LAYER                             │
│   ├── Private File Store: `/storage/private/{year}/{month}/{uuid}.dat` │
│   ├── Password Hashing Engine: Argon2id (cffi)                         │
│   ├── Token Subsystem: Asymmetric/Symmetric Signed JWT Claims          │
│   └── Host Security: Non-root process execution, strict umask (0077)  │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Presentation Layer (Frontend)
- **Framework & Tooling:** Single Page Application (SPA) built with React 18, TypeScript, Tailwind CSS, and Vite.
- **State & Data Fetching:** TanStack Query (React Query) for server-state caching, optimistic UI updates, and queue polling; Zustand or Context API for client auth state.
- **Role-Based Portals:**
  - *Student Portal:* Drag-and-drop PDF upload, instant page calculation display, real-time cost estimator, dynamic print configuration, and live job status badge.
  - *Staff/Operator Console:* Optimized for fast keyboard navigation, high-contrast queue monitoring, instant PDF download/view triggers, and one-click status transitions (Print $\rightarrow$ Ready $\rightarrow$ Collected).
  - *Admin Dashboard:* Institution-wide printing analytics, page cost matrix configuration (grayscale, color, duplex, binding), quota allocation tools, and system audit logs.

### 2.2 Application Layer (FastAPI)
- **Stateless Web Services:** Handles HTTP/HTTPS termination, JSON serialization/deserialization with Pydantic v2, multipart streaming for file uploads, and RFC 7807 compliant error responses.
- **Dependency Injection (DI):** Uses FastAPI's `Depends` system for database session lifecycle (`get_db`), authenticated user context (`get_current_user`), and role assertion (`require_roles([Role.STAFF, Role.ADMIN])`).
- **Domain Service Layer:** Pure Python service classes enforcing business rules, quota checks, and job transitions independent of HTTP controllers.

### 2.3 Data Layer (PostgreSQL)
- **Engine:** PostgreSQL 16 managed via SQLAlchemy 2.0 Async Engine and Alembic for declarative database migrations.
- **Relational Integrity:** Cascading rules, unique indexes, and foreign key constraints enforce domain rules at the schema level.
- **Pessimistic Locking:** Critical sections (deducting quota points, claiming a print job from the queue) leverage `SELECT ... FOR UPDATE` to guarantee serializable consistency under concurrent load.

### 2.4 Infrastructure Layer
- **Private Storage Directory:** Dedicated directory tree mounted at `/storage/private`, with directory permissions restricted to the backend application service account (`chmod 700`, `umask 077`).
- **Direct File Streaming:** Files are streamed directly through FastAPI via chunked streaming response (`FileResponse` / generator) to prevent loading large PDFs into RAM.

---

## 3. Module Boundaries & Dependency Graph

### 3.1 Module Descriptions & Boundaries

The modular monolith is partitioned into distinct internal packages within the FastAPI application. Each module has its own schemas, domain models, services, and API endpoints.

```
backend/app/
├── core/                  # Shared configurations, DB engines, base security
│   ├── config.py
│   ├── database.py
│   └── security.py
├── modules/
│   ├── auth/              # Authentication, tokens, password hashing, sessions
│   ├── users/             # User profiles, role management, department links
│   ├── documents/         # Upload intake, magic-number inspection, storage I/O
│   ├── print_settings/    # Print configuration models and pricing rules
│   ├── print_jobs/        # Lifecycle state machine, operator queue management
│   ├── billing/           # Quotas, balances, ledger transactions, cost calculation
│   └── audit/             # Immutable audit logging for security and operations
```

#### 1. Auth Module (`app.modules.auth`)
- **Responsibilities:** User credential verification, Argon2id hashing, issuing access/refresh tokens, managing token invalidation, and establishing the security context.
- **Exports:** `get_current_user`, `require_roles`, `create_access_token`.

#### 2. Users Module (`app.modules.users`)
- **Responsibilities:** User record management (Student ID, Department ID, email, role), profile lookup, and account activation/deactivation.
- **Exports:** `UserService`, `UserRead`, `UserUpdate`.

#### 3. Documents Module (`app.modules.documents`)
- **Responsibilities:** Secure ingestion of files, validation against malicious signatures (magic bytes), page count calculation, unique UUID filename generation, writing to `/storage/private`, and streaming authorized file downloads.
- **Exports:** `DocumentService`, `DocumentMetadata`, `stream_document_file`.

#### 4. Print Settings Module (`app.modules.print_settings`)
- **Responsibilities:** Encapsulating print options (Paper size: A4/A3, Color mode: Grayscale/Color, Duplex: Single/Double, Copies, Page Ranges), pricing rules matrix, and generating immutable configuration snapshots.
- **Exports:** `PrintSettingsService`, `CalculateCostRequest`, `CostBreakdown`.

#### 5. Print Jobs Module (`app.modules.print_jobs`)
- **Responsibilities:** Coordinating the print job lifecycle from draft submission to physical pickup. Orchestrates document binding, settings snapshotting, operator queue claiming, and status changes.
- **Exports:** `PrintJobService`, `JobStatusEnum`, `PrintJobQueue`.

#### 6. Billing & Quota Module (`app.modules.billing`)
- **Responsibilities:** Managing student semester allowances, faculty department allocations, debiting accounts upon job confirmation, and maintaining an immutable ledger of all print charges.
- **Exports:** `BillingService`, `QuotaCheckResult`, `DebitTransaction`.

#### 7. Audit Module (`app.modules.audit`)
- **Responsibilities:** Recording security-relevant events (file access, permission violations, staff actions, status overrides) in an append-only database table.
- **Exports:** `AuditLogger`, `AuditEventType`.

---

### 3.2 Module Dependency Graph

Dependencies between modules are strictly unidirectional. Lower-level domain modules never import higher-level orchestration modules.

```
       ┌────────────────┐
       │   API / Web    │  (FastAPI Routers)
       └───────┬────────┘
               │
               ▼
       ┌────────────────┐
       │   Print Jobs   │  (Orchestrator Module)
       └───┬────┬────┬──┘
           │    │    │
           │    │    └──────────────────────┐
           │    ▼                           ▼
           │  ┌──────────────┐      ┌──────────────┐
           │  │  Documents   │      │Print Settings│
           │  └──────┬───────┘      └───────┬──────┘
           ▼         │                      │
       ┌─────────────┴──┐                   │
       │    Billing     │◄──────────────────┘
       └───────┬────────┘
               │
               ▼
       ┌────────────────┐
       │  Users & Auth  │
       └───────┬────────┘
               │
               ▼
       ┌────────────────┐
       │  Audit Logging │  (Subscribed / Invoked by all modules)
       └────────────────┘
```

#### Architectural Invariants:
1. `Documents` has zero knowledge of `Print Jobs` or `Billing`. A document is simply a stored, validated file asset.
2. `Print Settings` is pure domain logic regarding print specifications and pricing formula; it does not access file streams or modify user records.
3. `Print Jobs` acts as the domain coordinator: it references a `Document`, snapshots a `PrintSetting`, requests a debit from `Billing`, and notifies `Audit`.
4. `Billing` interacts with `Users` to verify quotas and ledger balances.
5. All critical mutations across all modules write through `AuditLogger`.

---

## 4. API Integration Guidelines & REST Contracts

All external communication adheres strictly to RESTful conventions over HTTPS under the path prefix `/api/v1`.

### 4.1 Global Standards
- **Content Types:** `application/json` for request/response payloads; `multipart/form-data` for file uploads.
- **Authentication:** `Authorization: Bearer <JWT_ACCESS_TOKEN>` header or secure HTTP-only cookie.
- **Date/Time Standard:** ISO-8601 with UTC timezone (`YYYY-MM-DDTHH:MM:SS.ffffffZ`).
- **Standard Error Envelope (RFC 7807):**
```json
{
  "type": "https://printeasy.college.edu/errors/INSUFFICIENT_QUOTA",
  "title": "Insufficient Printing Quota",
  "status": 402,
  "detail": "User has 12 pages remaining; job requires 45 pages.",
  "instance": "/api/v1/print-jobs",
  "code": "INSUFFICIENT_QUOTA",
  "timestamp": "2026-11-11T14:32:01.120Z"
}
```

---

### 4.2 Endpoint Contracts Matrix

#### 1. Authentication & Identity (`/api/v1/auth`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Public | Authenticate with Student/Staff ID & Password; sets tokens. |
| `POST` | `/api/v1/auth/refresh`| Public | Exchange valid Refresh Token for new Access Token. |
| `POST` | `/api/v1/auth/logout` | Authenticated | Invalidate refresh session and clear cookies. |
| `GET` | `/api/v1/auth/me` | Authenticated | Get current user profile, roles, and current quota balance. |

#### 2. Documents Management (`/api/v1/documents`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/documents/upload` | Student, Faculty | Upload PDF. Validates magic bytes, extracts page count. |
| `GET` | `/api/v1/documents/{id}` | Owner, Staff, Admin | Get document metadata (original filename, size, pages). |
| `GET` | `/api/v1/documents/{id}/download` | Owner, Staff, Admin | Authorized streaming proxy download of raw file asset. |
| `DELETE`| `/api/v1/documents/{id}` | Owner, Admin | Soft-delete/mark document for cleanup if no active job. |

#### 3. Print Jobs & Lifecycle (`/api/v1/print-jobs`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/print-jobs/estimate`| Authenticated | Calculate cost preview given page count and settings. |
| `POST` | `/api/v1/print-jobs` | Student, Faculty | Create and submit a print job (locks quota, enqueues). |
| `GET` | `/api/v1/print-jobs` | Authenticated | List jobs for current user (supports `?status=&page=`). |
| `GET` | `/api/v1/print-jobs/{id}` | Owner, Staff, Admin | Detailed view of job status, settings, and timestamps. |
| `POST` | `/api/v1/print-jobs/{id}/cancel`| Owner, Admin | Cancel job if still in `PENDING` state; refunds quota. |

#### 4. Staff Queue Operations (`/api/v1/staff`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/staff/queue` | Staff, Admin | Live queue of pending/approved jobs ordered by priority. |
| `POST` | `/api/v1/staff/jobs/{id}/claim` | Staff | Operator assigns job to themselves (`status: PROCESSING`).|
| `POST` | `/api/v1/staff/jobs/{id}/ready` | Staff | Operator marks physical print done (`status: READY_FOR_PICKUP`). |
| `POST` | `/api/v1/staff/jobs/{id}/complete`| Staff | Student picks up job; operator closes (`status: COMPLETED`). |
| `POST` | `/api/v1/staff/jobs/{id}/reject` | Staff | Reject job due to physical/file defect (`status: REJECTED`). |

#### 5. Administration & Reporting (`/api/v1/admin`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/pricing-grid` | Admin | Retrieve current per-page pricing matrix. |
| `PUT` | `/api/v1/admin/pricing-grid` | Admin | Update pricing rules (A4, A3, Color, Duplex). |
| `POST` | `/api/v1/admin/quotas/adjust`| Admin | Bulk/Single user quota top-up or reset. |
| `GET` | `/api/v1/admin/audit-logs` | Admin | Query immutable audit logs with filter params. |

---

### 4.3 Detailed Payload Samples

#### `POST /api/v1/documents/upload`
- **Request:** `multipart/form-data` with field `file` (binary PDF).
- **Response (`201 Created`):**
```json
{
  "id": "e4b02d73-2559-4d87-9bb3-5b8cb404c012",
  "original_filename": "CS401_Final_Thesis.pdf",
  "mime_type": "application/pdf",
  "file_size_bytes": 4829104,
  "total_pages": 38,
  "sha256_hash": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
  "created_at": "2026-11-11T14:40:00.000Z"
}
```

#### `POST /api/v1/print-jobs`
- **Request Body (`application/json`):**
```json
{
  "document_id": "e4b02d73-2559-4d87-9bb3-5b8cb404c012",
  "settings": {
    "paper_size": "A4",
    "color_mode": "GRAYSCALE",
    "duplex_mode": "DOUBLE_SIDED",
    "copies": 2,
    "page_range": "1-38",
    "binding": "STAPLE_CORNER"
  },
  "special_instructions": "Please staple on the top-left corner."
}
```
- **Response (`201 Created`):**
```json
{
  "job_id": "8f3b610c-9824-4f01-8e8e-8a9d1234a567",
  "status": "PENDING",
  "calculated_cost_cents": 190,
  "billable_pages": 76,
  "created_at": "2026-11-11T14:41:15.512Z",
  "document": {
    "id": "e4b02d73-2559-4d87-9bb3-5b8cb404c012",
    "filename": "CS401_Final_Thesis.pdf",
    "total_pages": 38
  },
  "settings_summary": "A4, Grayscale, Double-sided, 2 copies, Staple Corner"
}
```

---

## 5. Database Interaction Patterns & Transaction Boundaries

### 5.1 Relational Schema Blueprint (ERD)

```
┌────────────────────────┐         1:N         ┌────────────────────────┐
│         users          ├────────────────────►│       user_quotas      │
├────────────────────────┤                     ├────────────────────────┤
│ id (UUID, PK)          │                     │ id (UUID, PK)          │
│ university_id (VARCHAR)│                     │ user_id (UUID, FK)     │
│ email (VARCHAR, UNIQUE)│                     │ balance_cents (INT)    │
│ hashed_password (TEXT) │                     │ free_pages_quota (INT) │
│ role (ENUM)            │                     │ updated_at (TIMESTAMP) │
│ department_id (UUID,FK)│                     └────────────────────────┘
└───────────┬────────────┘
            │ 1:N
            ├─────────────────────────────────┐
            ▼ 1:N                             ▼ 1:N
┌────────────────────────┐         ┌────────────────────────┐
│       documents        │         │       print_jobs       │
├────────────────────────┤         ├────────────────────────┤
│ id (UUID, PK)          │         │ id (UUID, PK)          │
│ owner_id (UUID, FK)    │         │ user_id (UUID, FK)     │
│ original_filename(TEXT)│         │ document_id (UUID, FK) ◄───┐
│ storage_path (TEXT)    │         │ settings_id (UUID, FK) ◄─┐ │
│ sha256_checksum(CHAR64)│         │ status (ENUM)          │ │ │
│ file_size (BIGINT)     │         │ total_cost_cents (INT) │ │ │
│ total_pages (INT)      │         │ operator_id (UUID, FK) │ │ │
│ created_at (TIMESTAMP) │         │ created_at (TIMESTAMP) │ │ │
│ deleted_at (TIMESTAMP) │         │ updated_at (TIMESTAMP) │ │ │
└────────────────────────┘         └────────────┬───────────┘ │ │
                                                │             │ │
                                                │ 1:1         │ │
                                   ┌────────────▼───────────┐ │ │
                                   │     print_settings     │ │ │
                                   ├────────────────────────┤ │ │
                                   │ id (UUID, PK)          │─┘ │
                                   │ paper_size (ENUM)      │   │
                                   │ color_mode (ENUM)      │   │
                                   │ duplex_mode (ENUM)     │   │
                                   │ copies (INT)           │   │
                                   │ page_range (VARCHAR)   │   │
                                   │ binding_type (ENUM)    │   │
                                   └────────────────────────┘   │
                                                                │
                                   ┌────────────────────────┐   │
                                   │       audit_logs       │   │
                                   ├────────────────────────┤   │
                                   │ id (BIGSERIAL, PK)     │   │
                                   │ event_type (VARCHAR)   │   │
                                   │ actor_id (UUID, FK)    │   │
                                   │ target_id (VARCHAR)    │   │
                                   │ payload (JSONB)        │   │
                                   │ created_at (TIMESTAMP) │   │
                                   └────────────────────────┘   │
                                                                │
                                   ┌────────────────────────┐   │
                                   │  billing_transactions  │   │
                                   ├────────────────────────┤   │
                                   │ id (UUID, PK)          │   │
                                   │ job_id (UUID, FK)──────┼───┘
                                   │ user_id (UUID, FK)     │
                                   │ amount_cents (INT)     │
                                   │ balance_type (ENUM)    │
                                   │ status (ENUM)          │
                                   │ created_at (TIMESTAMP) │
                                   └────────────────────────┘
```

---

### 5.2 Unit of Work & Transaction Boundaries

1. **Async Context Session Pattern:** Database sessions are scoped strictly to the lifecycle of an HTTP request using FastAPI's dependency injection:
   ```python
   async def get_db() -> AsyncGenerator[AsyncSession, None]:
       async with AsyncSessionLocal() as session:
           try:
               yield session
               await session.commit()
           except Exception:
               await session.rollback()
               raise
           finally:
               await session.close()
   ```

2. **Atomic Submission Boundary (Job Creation + Quota Lock):**
   When a user clicks "Submit Print Job", the operation must be completely atomic. It spans:
   - Verifying active user status.
   - Verifying document existence and ownership.
   - Inserting the immutable `print_settings` record.
   - Acquiring a pessimistic row lock on `user_quotas` (`SELECT ... FOR UPDATE`).
   - Verifying balance $\ge$ calculated cost.
   - Deducting the quota/balance.
   - Inserting the `billing_transactions` ledger entry (`status: HELD` or `DEBITED`).
   - Inserting the `print_jobs` record (`status: PENDING`).
   - Inserting the `audit_logs` entry.
   
   *If any step fails, the entire transaction is automatically rolled back; no orphaned files, phantom charges, or unbacked jobs can exist.*

3. **Atomic Operator Claim Boundary:**
   When an operator claims a pending job from the shared print queue:
   ```sql
   SELECT id, status 
   FROM print_jobs 
   WHERE id = :job_id AND status = 'PENDING'
   FOR UPDATE;
   ```
   If the job is already claimed or updated by another staff operator, the update is rejected with HTTP `409 Conflict`.

---

## 6. Architecture Decision Records (ADRs)

### ADR-001: Modular Monolith vs Microservices
- **Status:** Accepted
- **Context:** The college print management system requires rapid delivery, strict relational consistency between users, documents, quotas, and print queues, and will be operated by an institutional IT team with limited DevOps and orchestration bandwidth.
- **Decision:** Build PrintEasy as a Modular Monolith in FastAPI rather than distributed microservices (e.g., separate Auth, Billing, Document, and Job services).
- **Consequences:**
  - *Positive:* Direct ACID transactions across billing, quota, and job queues; zero network latency between components; zero distributed tracing/saga transaction complexity; single binary/container deployment model.
  - *Negative:* All modules share the same process memory space; bad code in one module could crash the worker process (mitigated by worker process supervisors like Gunicorn/Uvicorn workers).
  - *Mitigation:* Strict internal boundary discipline. Cross-module operations must go through service interfaces, never by querying or mutating foreign module tables directly.

---

### ADR-002: Manual Staff-Controlled Printing (Option A) vs Automated CUPS (Option B)
- **Status:** Accepted (Option A Baseline with Option B Extension Interface)
- **Context:** Academic printing facilities feature complex physical realities: different high-speed multi-function printers (MFPs), heavy-duty plotters, special cardstocks, binding machines, frequent paper jams, toner depletion, and student errors (e.g., submitting 500 blank pages). Direct autonomous printing via Common UNIX Printing System (CUPS) drivers risks extensive paper waste, physical jams, and ruined hardware without human oversight.
- **Decision:** Implement **Option A: Manual Staff-Controlled Printing** as the primary operating model, while architecting an asynchronous abstraction layer (`PrinterDriverAdapter`) to allow zero-downtime activation of **Option B (Automated CUPS submission)** in the future.
  - In Option A, the staff member monitors the digital queue, clicks "Claim / Process", inspects the job parameters, uses the secure proxy link to preview/send to physical printer, inspects the physical printout, and marks it "Ready for Pickup".
- **Consequences:**
  - *Positive:* Virtually eliminates paper waste, prevents hardware destruction, accommodates physical finishing (stapling, spiral binding, lamination), works seamlessly with any legacy network or USB printer without Linux driver dependency hell.
  - *Negative:* Introduces human labor dependency in the queue lifecycle.
  - *Upgrade Path:* An interface `IPrintExecutionEngine` is defined with two implementations: `ManualStaffQueueEngine` and `CupsAutomatedEngine`. Transitioning to automated printing requires only a configuration toggle.

---

### ADR-003: Private Local File Storage with Authorized Proxy Downloads
- **Status:** Accepted
- **Context:** Student coursework, dissertations, faculty research papers, and administrative documents are subject to strict privacy mandates (FERPA, GDPR, institutional data governance). Storing files in a publicly accessible web root (`/var/www/html/uploads`) or exposing direct unauthenticated URLs invites data leaks and IDOR vulnerabilities.
- **Decision:** All uploaded files are stored in a non-executable, private directory (`/storage/private/{year}/{month}/{file_uuid}.dat`). Document files are never directly reachable via web server URLs (e.g., Nginx static aliases). Retrieval is conducted strictly through an authenticated FastAPI streaming endpoint (`/api/v1/documents/{id}/download`) that validates the requester's identity, ownership, or staff role before proxy-streaming the file bytes.
- **Consequences:**
  - *Positive:* 100% authorization check on every single byte served; original filenames are obscured on disk; impossible to browse files via directory traversal; full audit trail of who downloaded or viewed which file and when.
  - *Negative:* Increases backend CPU and socket overhead during file streaming compared to raw Nginx static delivery.
  - *Mitigation:* FastAPI utilizes chunked async file streaming (`aiofiles` or standard starlette `FileResponse` with internal buffer tuning), keeping memory usage constant regardless of file size.

---

### ADR-004: JWT Access Token with HTTP-Only Cookies and Secure Headers
- **Status:** Accepted
- **Context:** Single Page Applications (React) storing authentication tokens in `localStorage` or `sessionStorage` are fundamentally vulnerable to credential theft via Cross-Site Scripting (XSS).
- **Decision:** Implement dual-token authentication utilizing **HTTP-only, SameSite=Strict, Secure cookies** for web browser clients, while maintaining support for the standard `Authorization: Bearer <token>` header for headless API consumers and integration testing.
  - **Access Token:** Short lifespan (15 minutes), containing user ID, role, and department claims.
  - **Refresh Token:** Long lifespan (7 days), stored as a secure HTTP-only cookie, persisted as an opaque hash in PostgreSQL to enable instant session revocation by administrators.
- **Consequences:**
  - *Positive:* Immune to JavaScript token extraction via XSS; transparent token renewal via background refresh endpoints; granular revocation capability.
  - *Negative:* Requires CSRF protection for state-changing browser requests (implemented via Double-Submit Cookie pattern or standard custom header `X-Requested-With` / `X-CSRF-Token`).

---

### ADR-005: Separation of Print Settings & Request Lifecycle
- **Status:** Accepted
- **Context:** An initial design temptation is to flatten print settings (paper size, color mode, duplex, copies, page range) directly as columns on the `print_jobs` table. However, print configuration defines the immutable contract of what was ordered and how cost was computed, whereas the print job represents an active operational state machine that mutates over time.
- **Decision:** Explicitly decouple print configuration and pricing snapshots into an immutable `print_settings` entity referenced by a 1-to-1 relationship from the mutable `print_jobs` entity.
- **Consequences:**
  - *Positive:* Historical auditability is preserved forever. Even if pricing rules or defaults change tomorrow, historical jobs reflect the exact settings and rates applied at the moment of submission; state machine transitions operate cleanly without side-effect mutations on printing parameters.
  - *Negative:* Requires an extra join/lookup during detailed job queries (trivially resolved via SQLAlchemy eager loading).

---

## 7. Architectural Risks and Mitigations

| Threat / Risk Vector | Severity | Vulnerability Description | Architectural Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Insecure Direct Object Reference (IDOR)** | **Critical** | Attacker increments or guesses a document/job ID in the URL to view or download another student's confidential files or exam papers. | 1. **UUIDv4 Identifiers:** All primary keys for documents, jobs, and transactions are cryptographically random 128-bit UUIDs, preventing sequential enumeration.<br>2. **Mandatory Service Ownership Guard:** Every endpoint executes an authorization check: `if job.user_id != current_user.id and current_user.role not in [STAFF, ADMIN]: raise HTTPException(403)`. |
| **Malicious File Uploads & Polyglots** | **Critical** | Attacker uploads an executable binary, PHP script, HTML/JS XSS vector, or corrupted PDF payload disguised as an assignment. | 1. **MIME Magic Byte Inspection:** The server inspects file headers using `python-magic` (verifying `%PDF-` signature), ignoring client-supplied `Content-Type`.<br>2. **PDF Structural Validation:** The file is parsed with a PDF parser (`pypdf`); files with corrupt page trees or embedded executables fail validation.<br>3. **Opaque Disk Storage:** Files are written to disk as `{uuid}.dat` without original extensions and with non-executable permissions (`chmod 0600`). Files are never executed on the host. |
| **State Machine Race Conditions** | **High** | Two staff members attempt to claim the same job simultaneously, or a student attempts to cancel a job while an operator is printing it. | 1. **Pessimistic Locking:** State transitions execute inside transactions using `SELECT ... FOR UPDATE`.<br>2. **Deterministic State Matrix:** The `PrintJobService` enforces a strict transition dictionary: `ALLOWED_TRANSITIONS = { PENDING: [PROCESSING, CANCELLED, REJECTED], PROCESSING: [READY_FOR_PICKUP, REJECTED], ... }`. Invalid transitions throw `409 Conflict`. |
| **Quota Deduction & Double-Spend** | **High** | Rapid concurrent submissions exploit race conditions to print more pages than permitted by the student's quota. | 1. **Row-level Balance Locking:** The `user_quotas` row is locked during the debit calculation transaction.<br>2. **Database Check Constraint:** PostgreSQL schema includes `CONSTRAINT positive_balance CHECK (free_pages_quota >= 0 OR balance_cents >= 0)`. |
| **Large File Resource Exhaustion (DoS)** | **Medium** | Attacker uploads 2GB files to exhaust server RAM and disk capacity. | 1. **Streaming Size Limit:** Nginx reverse proxy and FastAPI limit request body size (`MAX_CONTENT_LENGTH = 50 * 1024 * 1024` / 50MB).<br>2. **Chunked Disk Streaming:** Uploads stream directly to disk in 64KB chunks; memory footprint stays under 10MB per upload.<br>3. **Automated Storage Purge:** Cron job hard-deletes unlinked draft uploads after 24 hours. |

---

## 8. Single Print Center Scope vs Multi-Department Expansion Readiness

### 8.1 Baseline Scope: Central College Print Room
In Phase 1, PrintEasy is configured for a **Single Centralized College Print Center**:
- One central facility staffed by operators.
- Single unified queue for all student and faculty submissions.
- Universal pricing matrix and single institutional quota reset schedule.
- Physical pickup point: Central Library Print Center.

### 8.2 Expansion Readiness: Multi-Department / Multi-Campus Federation
To ensure zero structural refactoring when expanding to satellite campus libraries, engineering labs, or departmental print rooms, the domain model includes native multi-tenancy extension hooks:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TENANT / SCOPE EXTENSIONS                       │
│                                                                        │
│   institutions (id, name, domain)                                      │
│        │                                                               │
│        ▼ 1:N                                                           │
│   campuses (id, institution_id, name)                                  │
│        │                                                               │
│        ▼ 1:N                                                           │
│   print_centers (id, campus_id, name, location, is_active)             │
│        │                                                               │
│        ├─────────────────────────────┬─────────────────────────────┐   │
│        ▼ 1:N                         ▼ 1:N                         ▼   │
│   printers (hardware)           staff_assignments             queues   │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Pre-Engineered Foreign Keys:**
   - The `users` table includes an optional `department_id` foreign key.
   - The `print_jobs` entity is engineered with an optional `destination_center_id` (defaults to `DEFAULT_CENTRAL_PRINT_CENTER`).
2. **Queue Segregation Capability:**
   - The queue query currently defaults to `WHERE destination_center_id = DEFAULT_ID`. Multi-center expansion simply binds this parameter to the staff operator's assigned facility.
3. **Department Cost Allocation:**
   - The `billing_transactions` entity supports charging against either personal student quotas or a departmental billing grant (`billing_type: [STUDENT_QUOTA, FACULTY_DEPARTMENT_GRANT, CASH_CREDIT]`).
4. **Partitionable Storage:**
   - The storage path convention `/storage/private/{center_id}/{year}/{month}/{uuid}.dat` isolates file assets cleanly for future migration to distributed object storage (e.g., S3 buckets per campus).

---

## 9. Architectural Sign-off
This document represents the baseline technical architecture for PrintEasy. All subsequent engineering tasks (database schema implementations, FastAPI route definitions, frontend state management) must conform strictly to the boundaries and contracts defined herein.
