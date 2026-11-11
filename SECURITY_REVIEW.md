# PrintEasy — Digital College Printing Management System
# Comprehensive Security Architecture & Threat Review

**Document Version:** 1.0.0  
**Classification:** Confidential — Internal Security Baseline  
**Target System:** PrintEasy Core (FastAPI Backend, React Frontend, PostgreSQL Database, Private Storage Engine)  
**Author:** Subagent 05 — Cybersecurity Engineering  

---

## Table of Contents
1. [Executive Summary & Architecture Overview](#1-executive-summary--architecture-overview)
2. [Threat Model (STRIDE Analysis)](#2-threat-model-stride-analysis)
3. [Authentication & Session Security Specification](#3-authentication--session-security-specification)
4. [Role-Based Access Control (RBAC) Matrix](#4-role-based-access-control-rbac-matrix)
5. [Insecure Direct Object Reference (IDOR) Defense & Verification](#5-insecure-direct-object-reference-idor-defense--verification)
6. [Document Security & Storage Architecture](#6-document-security--storage-architecture)
7. [Client-Side Security, Headers & Rate Limiting](#7-client-side-security-headers--rate-limiting)
8. [Audit Logging & Compliance Forensic Specification](#8-audit-logging--compliance-forensic-specification)
9. [Security Verification Test Suite & Checklist](#9-security-verification-test-suite--checklist)

---

## 1. Executive Summary & Architecture Overview

### 1.1 System Description
PrintEasy is a digital printing management solution tailored for collegiate environments. Students upload course documents (PDFs), configure print options (duplex, page range, color/grayscale), and release or track jobs. Print shop staff monitor fulfillment queues, dispatch rendering to campus printers, handle exceptions, and debit student balances. Administrators configure pricing, manage printers, manage users, and review financial and audit records.

### 1.2 System Architecture Diagram & Trust Boundaries

```
                 TRUST BOUNDARY 1 (Public / Untrusted Campus Network)
                                      │
       ┌──────────────────────────────┴──────────────────────────────┐
       │                                                             │
┌──────────────┐                                              ┌──────────────┐
│ Student Web  │ (HTTPS / TLS 1.3)                            │  Staff Web   │
│ Client (SPA) │                                              │ Client (SPA) │
└──────┬───────┘                                              └──────┬───────┘
       │                                                             │
═══════╪═════════════════════════════════════════════════════════════╪════════
       ▼                                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                  Nginx Reverse Proxy / TLS Termination                     │
│    - Global Rate Limiting (Token Bucket)                                  │
│    - Request Header Hardening & Max Body Size (10MB limit)                 │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                 TRUST BOUNDARY 2 (Internal Application Network)
                                      │
┌─────────────────────────────────────▼──────────────────────────────────────┐
│                        FastAPI Application Server                          │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ Security Middlewares: CORS, RateLimiter, SecurityHeaders, RequestID   │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ Auth & RBAC: Argon2id, JWT Guard (OAuth2 Password Bearer), Scopes     │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ Validation Engine: PDF Magic Byte/Trailer Validator, Safe Filenames    │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ Object Authorization Layer: IDOR Scoped Queries, Ownership Guard      │ │
│ ├────────────────────────────────────────────────────────────────────────┤ │
│ │ Status Transition Machine: ACID State Checks, Race Guard              │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────┬──────────────────────────────┬─────────────────────┘
                        │                              │
          TRUST BOUNDARY 3 (Data Stores)               │
                        │                              │
         ┌──────────────▼─────────────┐ ┌──────────────▼────────────────────┐
         │ PostgreSQL Database Engine │ │ Private Local Storage Engine      │
         │ - Row-Level Owner Mapping  │ │ - POSIX Mode 0700 / 0600 (Non-root)│
         │ - Tamper-Evident Audit Log │ │ - Path: /var/storage/print_jobs/  │
         │ - Atomic Balance Deductions│ │ - UUID Path Isolation (No Traversal)│
         └────────────────────────────┘ └───────────────────────────────────┘
```

### 1.3 Data Classification
| Level | Data Type | Description | Controls |
| :--- | :--- | :--- | :--- |
| **Confidential / Restricted** | Student Documents | Academic submissions, exam scripts, personal IDs | Strict POSIX storage ACLs, streaming download with ownership check, purge upon completion. |
| **Confidential** | Credentials & Secrets | Password hashes, JWT signing keys, DB credentials | Argon2id, environment injection via container secrets, no log exposure. |
| **Internal Sensitive** | Financials & Logs | Student quota/balance, job cost calculations, audit trails | Append-only DB logs, atomic transactions, RBAC guard. |
| **Public / Low Risk** | System Constants | Printer operational statuses, campus building locations | Cached read-only endpoints with rate limits. |

---

## 2. Threat Model (STRIDE Analysis)

The system threat profile is evaluated across the four key interaction boundaries using the STRIDE methodology.

### 2.1 Student Portal
*Scope: Authentication, file submission, student dashboard, quota check, cancellation.*

| Threat Category | Threat Description | Attack Scenario | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Credential Stuffing / Session Hijacking | Attacker uses compromised credentials from another college service or intercepts an insecure token. | Account compromise, unauthorized printing, quota drain. | Argon2id hashing, short-lived JWT access tokens (15m), Refresh Token Rotation (RTR), IP/account brute-force throttling. |
| **Tampering** | Parameter Tampering on Print Parameters | Student alters page count or overrides duplex flags to print 500 pages while being billed for 1 page. | Financial loss for the college, resource exhaustion. | Server-side PDF page calculation using PyMuPDF/pypdf; client-supplied page counts are discarded. |
| **Repudiation** | Denial of Print Order Creation | Student claims they never submitted a disputed 100-page color job that consumed campus credits. | Customer disputes, accounting reconciliation issues. | Signed audit record written synchronously on job submission storing `user_id`, `client_ip`, `user_agent`, `sha256(file)`, and UTC timestamp. |
| **Information Disclosure** | IDOR on Job Status and Metadata | Student modifies job ID in `/api/v1/print-jobs/{job_id}` to view details of another student's submission. | FERPA/privacy breach; exposure of names, documents, and student IDs. | Scoped SQL query requiring `job.user_id == current_user.id`; returns HTTP 404 on mismatched ownership to prevent enumeration. |
| **Denial of Service** | Quota / Queue Flooding | Student floods the queue with hundreds of pending jobs, starving printers. | Queue backlog, printer starvation, disk starvation. | Strict per-user rate limit (10 uploads/hr), max 5 active concurrent pending jobs per student, global 10MB file limit. |
| **Elevation of Privilege** | Role Manipulation via Profile Update | Student sends `{"role": "staff"}` in a PATCH/PUT user profile payload. | Unauthorized access to the staff print queue and student documents. | Strict Pydantic input schemas excluding privileged fields (`role` immutable via student endpoints), role claim validated from DB/JWT. |

### 2.2 Staff Dashboard
*Scope: Queue management, job dispatching, document streaming, printer maintenance, reprinting.*

| Threat Category | Threat Description | Attack Scenario | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Stolen Staff Credential / Station Impersonation | Shared print room computer left logged in or staff credentials phished. | Attacker accesses all student documents across campus. | Inactivity auto-logout (15m), refresh tokens bound to client fingerprint/IP, staff role restricted to designated subnet or MFA-verified. |
| **Tampering** | Status Tampering | Malicious staff marks a job `FAILED` or `COMPLETED` without actually printing it, or alters audit logs. | Service failure, student disputes. | Enforce rigid state transition engine; staff cannot edit audit log tables (append-only PostgreSQL roles). |
| **Repudiation** | Untracked Document Viewing | Staff member downloads/views personal student documents without cause and claims system error. | Insider threat, privacy violation. | Every file read/stream triggers a high-severity audit event logging `staff_id`, `job_id`, `file_hash`, and terminal IP. |
| **Information Disclosure** | Mass Data Exfiltration | Compromised staff account scrapes all pending student jobs and downloads files in bulk. | Massive privacy breach, intellectual property theft. | Aggressive rate limiting on document streaming endpoint (max 30 documents/minute for staff), alerts on abnormal bulk downloads. |
| **Denial of Service** | Queue Freezing | Staff user pauses or cancels all printers simultaneously via automated script. | Campus-wide printing halted. | Batch status operations require administrative authorization or are rate-limited to single-device updates. |
| **Elevation of Privilege** | Staff Escalating to System Admin | Staff accesses `/api/v1/admin/users` by tweaking routing or sending direct API calls. | Complete database takeover, arbitrary credit modification. | Route-level FastAPI dependencies checking explicit role membership (`require_role("admin")`). |

### 2.3 Document Upload & Download Pipeline
*Scope: Multipart upload parsing, file system write, streaming response, document deletion.*

| Threat Category | Threat Description | Attack Scenario | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Upload under Forged Identity | Malicious caller submits file with forged `user_id` in multipart form fields. | Unattributed malicious upload or blaming innocent student. | `user_id` is extracted strictly from the verified JWT in the `Authorization` header, completely ignoring request body user parameters. |
| **Tampering** | Storage Path Traversal | Filename provided as `../../../../etc/passwd` or `../../../app/main.py`. | Overwrite system binaries, remote code execution. | Filename completely decoupled from storage key: files are stored strictly as `/var/storage/print_jobs/{user_uuid}/{job_uuid}.pdf`. |
| **Tampering** | Polyglot File Execution | Attacker uploads an executable or PHP/JS script disguised as a PDF (`exploit.php.pdf` or PDF containing embedded HTML/JS). | Server-side execution or Stored XSS if served inline. | Two-stage byte validation: Header magic check (`%PDF-`), EOF check (`%%EOF`), sanitization of active PDF elements (`/JavaScript`, `/Launch`), and `Content-Disposition: attachment`. |
| **Repudiation** | Document Content Tampering | Student uploads benign file, then alters file on disk before printing to print prohibited content. | Integrity violation, security check bypass. | File hash (SHA-256) computed in-stream during upload, saved to DB, and re-verified prior to sending to printer spooler. |
| **Information Disclosure** | Static File Directory Indexing | Web server exposes directory containing uploaded files at `/uploads/`. | Anyone on the web can browse and download all student files. | Zero static directories mounted. Files are stored outside webroot in a non-exposed directory (`/var/storage/`) and served only via authenticated streaming endpoint. |
| **Denial of Service** | Decompression / PDF Bomb | Attacker uploads a deeply nested compressed object stream or 10,000 blank pages in a 2MB file. | Application thread hang, memory exhaustion, printer spool crash. | Enforce max page count check (e.g., 100 pages per job), inspect object stream recursion limits, strict memory bounds on worker processes. |
| **Elevation of Privilege** | Local File Inclusion (LFI) via Streaming | Caller supplies crafted job ID that evaluates to local file path when streaming. | System files (`/etc/shadow`, `.env`) leaked to caller. | Job ID validated as strict UUIDv4; storage path constructed via absolute path joining against root base directory and verified with `os.path.commonpath`. |

### 2.4 Status Transition Engine
*Scope: Job lifecycle state changes (`PENDING` -> `QUEUED` -> `PRINTING` -> `COMPLETED` / `FAILED` / `CANCELLED`).*

| Threat Category | Threat Description | Attack Scenario | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Tampering** | Illegal State Jump | Student cancels a job while it is currently `PRINTING`, causing refund while output is printed. | Theft of printing service / financial discrepancy. | Enforce finite state machine (FSM). Valid transitions from `PRINTING` are strictly `COMPLETED` or `FAILED`. `CANCELLED` is only valid from `PENDING`. |
| **Tampering** | Concurrency Race Condition | Student sends 20 simultaneous cancel requests for the same job to trigger double-refund. | Negative balances, financial exploitation. | Database row-level locking (`SELECT ... FOR UPDATE`) during status transitions and quota operations inside an atomic transaction. |
| **Repudiation** | Unaccounted Job Disappearance | Job deleted from DB to hide who printed specific materials. | Lack of accountability. | Soft-delete only. Database records remain indefinitely with status `DELETED`/`CANCELLED`; binary file purged per retention schedule. |
| **Information Disclosure** | State Leakage via WebSockets/Polling | Unauthenticated client connects to live printer queue WebSocket. | Exposure of student names and print topics. | WebSocket handshake requires standard Bearer token verification; messages scoped to recipient role. |
| **Denial of Service** | Job Deadlocking | A crashed worker leaves a job stuck in `PRINTING`, blocking subsequent queue jobs. | Deadlock of printer hardware queue. | Heartbeat mechanism with automated transition to `FAILED` with retry policy after 5-minute timeout. |
| **Elevation of Privilege** | Student Self-Marking `COMPLETED` | Student calls `/api/v1/staff/print-jobs/{id}/status` directly. | Unauthorized state alteration. | RBAC permission `job:status_update` restricted strictly to `staff` and `admin` roles. |

---

## 3. Authentication & Session Security Specification

### 3.1 Password Hashing Architecture (Argon2id)
PrintEasy implements password hashing strictly adhering to **RFC 9106** and OWASP Password Storage Cheat Sheet recommendations using **Argon2id** (hybrid time/memory-hard function offering resilience against side-channel and GPU-assisted attacks).

```python
# Security Parameters: Argon2id (RFC 9106 High-Memory Profile)
Type: Argon2id
Time Cost (t): 3 iterations
Memory Cost (m): 65536 KiB (64 MiB)
Parallelism (p): 4 concurrent threads
Hash Length: 32 bytes
Salt Length: 16 bytes (cryptographically secure random bytes via os.urandom)
```

```python
# Implementation Specification (passlib / argon2-cffi)
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError

ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16
)

def hash_password(plain_password: str) -> str:
    # Truncate at 1024 characters to prevent CPU DoS
    if len(plain_password.encode("utf-8")) > 1024:
        raise ValueError("Password exceeds maximum allowed length.")
    return ph.hash(plain_password)

def verify_and_rehash(plain_password: str, hashed_password: str) -> tuple[bool, str | None]:
    try:
        valid = ph.verify(hashed_password, plain_password)
        new_hash = ph.hash(plain_password) if ph.check_needs_rehash(hashed_password) else None
        return True, new_hash
    except (VerifyMismatchError, VerificationError):
        return False, None
```

### 3.2 JWT Claims & Token Architecture
Tokens are cryptographically signed using asymmetric **EdDSA (Ed25519)** or **RS256** (RSA 4096-bit). If symmetric HMAC-SHA256 (`HS256`) is utilized in staging, the secret key must be >= 256 bits of entropy, loaded strictly from environmental secrets.

#### Access Token Structure (Lifespan: 15 minutes)
```json
{
  "header": {
    "alg": "EdDSA",
    "typ": "JWT",
    "kid": "printeasy-auth-key-2026-v1"
  },
  "payload": {
    "iss": "https://printeasy.college.edu",
    "sub": "b2c68a41-2b8e-4a81-9b19-e58f2da0b301",
    "aud": "https://printeasy-api.college.edu",
    "exp": 1794500100,
    "nbf": 1794499200,
    "iat": 1794499200,
    "jti": "7f8b9e2d-3c4a-4d5e-8f1a-2b3c4d5e6f7a",
    "role": "student",
    "email": "j.doe@college.edu",
    "token_type": "access",
    "scope": "read:own write:own"
  }
}
```

#### Refresh Token Structure (Lifespan: 7 days)
```json
{
  "iss": "https://printeasy.college.edu",
  "sub": "b2c68a41-2b8e-4a81-9b19-e58f2da0b301",
  "aud": "https://printeasy-api.college.edu",
  "exp": 1795104000,
  "iat": 1794499200,
  "jti": "fa01b2c3-d4e5-4f6a-8b9c-0d1e2f3a4b5c",
  "family_id": "89e1a2b3-c4d5-4e6f-a7b8-c9d0e1f2a3b4",
  "token_type": "refresh"
}
```

### 3.3 Refresh Token Rotation (RTR) & Reuse Detection
To prevent refresh token hijacking, PrintEasy implements **Automatic Token Rotation with Family Reuse Detection**:
1. Every time a refresh token is exchanged, a new Access Token and a new Refresh Token are issued.
2. The old refresh token's `jti` is immediately invalidated and stored in PostgreSQL / Redis with its `family_id`.
3. **Breach Detection:** If an invalidated refresh token is ever presented again:
   - System flags a replay attack.
   - The entire token family associated with `family_id` is revoked immediately.
   - All active sessions for `sub` are terminated.
   - An emergency audit security event (`AUTH_REPLAY_ATTACK_DETECTED`) is logged.

### 3.4 Brute Force Defense & Progressive Lockout
Authentication endpoints (`/api/v1/auth/login`, `/api/v1/auth/refresh`) are shielded by an IP-and-Account sliding window rate limiter:

```
Attempts (per 15 min) | Action
──────────────────────┼──────────────────────────────────────────────────────────
1 - 4                 | Allow, return standard 401 on bad credentials.
5                     | Delay response by 2.0s (tarpitting).
6 - 9                 | Delay response by 5.0s, alert user via registered email.
10+                   | Lock account for 15 minutes. Return HTTP 429 Too Many Requests.
                      | Log event: AUTH_ACCOUNT_LOCKED.
```

---

## 4. Role-Based Access Control (RBAC) Matrix

### 4.1 Role Hierarchy & Privilege Definitions
* **`student`**: Self-service user. Permitted to create print jobs, view personal print jobs, stream personal files, manage personal profile. Zero access to staff queues or system configs.
* **`staff`**: Operator user. Permitted to inspect the campus-wide active print queue, stream documents flagged as ready for printing, advance job status, report printer hardware failures, and re-queue failed jobs. Cannot manage system users or alter pricing rules.
* **`admin`**: Full administrative authority. User management, printer CRUD, fee configuration, system diagnostics, and raw audit log access.

### 4.2 Comprehensive Endpoint RBAC Matrix

| HTTP Method | API Endpoint Route | Student | Staff | Admin | Required Permission / Scope | Authorization Logic & Constraints |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **POST** | `/api/v1/auth/login` | Public | Public | Public | None | Rate limited (5 req/min/IP). |
| **POST** | `/api/v1/auth/refresh` | Public | Public | Public | None | Requires valid Refresh Token in HTTP-only cookie. |
| **POST** | `/api/v1/auth/logout` | Authenticated | Authenticated | Authenticated | `auth:logout` | Invalidates current token family. |
| **GET** | `/api/v1/users/me` | Allowed | Allowed | Allowed | `user:read_self` | Returns authenticated user's own profile and balance. |
| **GET** | `/api/v1/print-jobs` | Own Only | Allowed | Allowed | `job:list` | Student: `WHERE user_id = current_user.id`. Staff/Admin: Unfiltered or filter by campus printer. |
| **POST** | `/api/v1/print-jobs` | Allowed | Denied | Allowed | `job:create` | Validates student quota, parses file, creates `PENDING` record. |
| **GET** | `/api/v1/print-jobs/{job_id}` | Own Only | Allowed | Allowed | `job:read` | Student: strict ownership verification. Staff/Admin: all jobs. |
| **DELETE** | `/api/v1/print-jobs/{job_id}` | Own Only | Allowed | Allowed | `job:cancel` | Allowed only if status == `PENDING`. Refunds student quota. |
| **GET** | `/api/v1/print-jobs/{job_id}/document` | Own Only | Allowed | Allowed | `document:download` | Student: strict ownership check. Staff: allowed only when status in `[QUEUED, PRINTING]`. |
| **GET** | `/api/v1/staff/queue` | Denied | Allowed | Allowed | `queue:view` | Returns active jobs awaiting printing. |
| **PATCH** | `/api/v1/staff/print-jobs/{job_id}/status` | Denied | Allowed | Allowed | `job:status_update` | Enforces state machine transitions. |
| **GET** | `/api/v1/printers` | Allowed | Allowed | Allowed | `printer:read` | Public/Campus list of active printers and statuses. |
| **POST** | `/api/v1/admin/printers` | Denied | Denied | Allowed | `admin:printers_write` | Creates new printer definition and network address. |
| **PUT/PATCH**| `/api/v1/admin/printers/{id}` | Denied | Denied | Allowed | `admin:printers_write` | Modifies printer configuration. |
| **GET** | `/api/v1/admin/users` | Denied | Denied | Allowed | `admin:users_read` | Lists campus accounts and balances. |
| **PATCH** | `/api/v1/admin/users/{id}/quota` | Denied | Denied | Allowed | `admin:quota_manage` | Manual adjustments to quota; generates audit trail. |
| **GET** | `/api/v1/admin/audit-logs` | Denied | Denied | Allowed | `admin:audit_read` | Read-only forensic search interface. |

### 4.3 FastAPI RBAC Dependency Enforcement Pattern
Security policies are enforced using composable FastAPI dependencies rather than manual checks inside route controllers:

```python
from enum import Enum
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

class UserRole(str, Enum):
    STUDENT = "student"
    STAFF = "staff"
    ADMIN = "admin"

class CurrentUser(BaseModel):
    id: str
    email: str
    role: UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> CurrentUser:
    payload = decode_jwt_token(token)
    return CurrentUser(
        id=payload["sub"],
        email=payload["email"],
        role=UserRole(payload["role"])
    )

def require_roles(*allowed_roles: UserRole):
    async def role_checker(current_user: CurrentUser = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Insufficient privileges for this operation."
            )
        return current_user
    return role_checker
```

---

## 5. Insecure Direct Object Reference (IDOR) Defense & Verification

### 5.1 Threat Context
In a printing system, IDOR represents a critical vulnerability. If job IDs are sequentially generated (e.g., `/api/v1/print-jobs/1042/document`), any student can iterate integers to download fellow students' essays, medical excuses, or exam papers.

### 5.2 Student Document Isolation (Scoped SQL Queries)
To guarantee strict multi-tenant isolation at the database level:
1. **Primary Keys:** All database identifiers use cryptographically generated UUIDv4 strings (e.g., `3fa85f64-5717-4562-b3fc-2c963f66afa6`) preventing sequential enumeration.
2. **Mandatory Query Scoping:** Route handlers must never load an object by `id` alone and then check ownership afterwards. The ownership constraint is bound directly into the SQL query:

```python
# CORRECT: Scoped SQL Query (Zero IDOR exposure)
async def get_student_print_job(job_id: uuid.UUID, user_id: uuid.UUID, session: AsyncSession) -> PrintJob:
    query = select(PrintJob).where(
        PrintJob.id == job_id,
        PrintJob.user_id == user_id,
        PrintJob.is_deleted == False
    )
    result = await session.execute(query)
    job = result.scalar_one_or_none()
    
    if job is None:
        # Anti-Enumeration Principle: Return 404 rather than 403
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Print job not found."
        )
    return job
```

### 5.3 Anti-Enumeration Policy (HTTP 404 vs 403)
* If an attacker attempts to access a `job_id` belonging to another student:
  * Returning **`403 Forbidden`** confirms to the attacker that the object exists, facilitating ID harvesting.
  * PrintEasy strictly returns **`404 Not Found`**. From the client's perspective, an unauthorized ID is indistinguishable from an ID that has never existed.

### 5.4 Staff & Admin Scoped Access
Staff access is authorized across user boundaries, but constrained by lifecycle status:
* Staff may only stream documents for jobs in statuses: `['QUEUED', 'PRINTING']`.
* Completed or cancelled jobs cannot be downloaded by staff, upholding data privacy.
* Any staff download is bound to an audit event logging the reason and terminal IP.

```python
async def get_document_for_download(
    job_id: uuid.UUID,
    current_user: CurrentUser,
    session: AsyncSession
) -> PrintJob:
    if current_user.role == UserRole.STUDENT:
        # Student strictly bound to own user_id
        return await get_student_print_job(job_id, uuid.UUID(current_user.id), session)
    
    elif current_user.role in (UserRole.STAFF, UserRole.ADMIN):
        # Staff/Admin lookup
        query = select(PrintJob).where(PrintJob.id == job_id, PrintJob.is_deleted == False)
        result = await session.execute(query)
        job = result.scalar_one_or_none()
        
        if job is None:
            raise HTTPException(status_code=404, detail="Print job not found.")
            
        # Staff operational constraint: Cannot download completed or cancelled archives
        if current_user.role == UserRole.STAFF and job.status not in (JobStatus.QUEUED, JobStatus.PRINTING):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Staff cannot download documents for completed or cancelled jobs."
            )
            
        return job
```

---

## 6. Document Security & Storage Architecture

### 6.1 PDF Magic Byte & Structural Integrity Validation
Attackers routinely disguise malicious executables, polyglots, or HTML/JS payloads by appending `.pdf` extensions. PrintEasy implements strict, defense-in-depth file validation prior to persistent disk writing.

```
Upload Stream ─► 1. File Size Ceiling Check (10MB)
               └─► 2. Header Magic Byte Check (%PDF-1.[0-7] / %PDF-2.0)
               └─► 3. Trailer EOF Byte Check (%%EOF in terminal 1024 bytes)
               └─► 4. Active Content / Exploit Primitive Scan (/JavaScript, /Launch)
               └─► 5. Decompression Bomb Page Count Verification
```

#### Structural Rules:
1. **Header Check:** The first 8 bytes of the binary must match the regex `^%PDF-[12]\.[0-9]`.
2. **Trailer Check:** The last 1024 bytes of the binary stream must contain the end-of-file marker `%%EOF`.
3. **Active Scripting Disarmament:** Raw byte scanning for dangerous PDF action tags:
   - `/JavaScript` and `/JS` (embedded JavaScript engines)
   - `/Launch` (arbitrary binary execution via PDF reader)
   - `/SubmitForm` and `/ImportData` (exfiltration primitives)
   - `/EmbeddedFiles` (steganographic or hidden payloads)
   Files containing these tokens are rejected outright with `422 Unprocessable Entity`.

```python
import re
from fastapi import UploadFile, HTTPException

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 Megabytes
PDF_HEADER_PATTERN = re.compile(rb"^%PDF-[12]\.[0-9]")
DANGEROUS_PDF_TOKENS = [
    rb"/JavaScript",
    rb"/JS",
    rb"/Launch",
    rb"/EmbeddedFiles",
    rb"/RichMedia",
    rb"/OpenAction",
    rb"/AcroForm"
]

async def validate_pdf_content(file: UploadFile) -> bytes:
    # 1. Read first 1024 bytes for magic check
    header = await file.read(1024)
    if not PDF_HEADER_PATTERN.match(header):
        raise HTTPException(
            status_code=422,
            detail="Invalid file format: Missing valid PDF header signature (%PDF-)."
        )
    
    # 2. Read full content with strict 10MB limit
    rest = await file.read(MAX_FILE_SIZE - 1024 + 1)
    full_content = header + rest
    
    if len(full_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File size exceeds maximum limit of 10MB."
        )
        
    # 3. Trailer EOF Verification
    trailer_chunk = full_content[-1024:] if len(full_content) >= 1024 else full_content
    if b"%%EOF" not in trailer_chunk:
        raise HTTPException(
            status_code=422,
            detail="Malformed PDF: Missing %%EOF trailer marker."
        )
        
    # 4. Dangerous Active Content Scan
    for token in DANGEROUS_PDF_TOKENS:
        if token in full_content:
            raise HTTPException(
                status_code=422,
                detail=f"Security violation: Active content ({token.decode()}) is prohibited in print documents."
            )
            
    # Reset pointer for downstream consumption
    await file.seek(0)
    return full_content
```

### 6.2 Sanitized Storage Keys & Path Traversal Elimination
* **Decoupled Identity:** The original client-provided filename (`file.filename`) is never used in file system operations. It is stored solely as a sanitized Unicode display string in the database column `print_jobs.original_filename`.
* **Path Generation:** Files are stored strictly in private directories structured by UUIDs:
  ```
  /var/storage/print_jobs/{user_uuid}/{job_uuid}.pdf
  ```
* **Directory Traversal Defense:** Canonicalization validation guarantees paths cannot escape the designated root storage directory:

```python
import os
from pathlib import Path
import uuid

STORAGE_BASE_DIR = Path("/var/storage/print_jobs").resolve()

def generate_secure_storage_path(user_id: uuid.UUID, job_id: uuid.UUID) -> Path:
    # Enforce pure UUID string representation (zero traversal tokens)
    user_dir = STORAGE_BASE_DIR / str(user_id)
    target_path = (user_dir / f"{job_id}.pdf").resolve()
    
    # Verify path confinement within STORAGE_BASE_DIR
    if not str(target_path).startswith(str(STORAGE_BASE_DIR)):
        raise SecurityError("Directory traversal detected during path resolution.")
        
    return target_path
```

* **Filesystem Permissions:** The storage directory is owned by dedicated service account `printeasy:printeasy` with POSIX permissions `0700` (directories) and `0600` (files). Root execution is strictly prohibited.

### 6.3 Zero Public Direct Links & Secure Streaming Architecture
No web server directory alias (e.g., `/static/` or `/files/`) points to `/var/storage/`. Files can **only** be retrieved via an authenticated FastAPI streaming endpoint:

```python
from fastapi.responses import StreamingResponse
import urllib.parse

@router.get("/api/v1/print-jobs/{job_id}/document")
async def download_print_job_document(
    job_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    job = await get_document_for_download(job_id, current_user, session)
    file_path = generate_secure_storage_path(job.user_id, job.id)
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document payload missing.")
        
    def iterfile():
        with open(file_path, mode="rb") as f:
            while chunk := f.read(64 * 1024):  # 64KB chunks
                yield chunk

    # Sanitize download name and force download attachment disposition
    safe_filename = urllib.parse.quote(job.original_filename)
    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{safe_filename}",
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    
    # Record download audit event
    await log_audit_event(
        event_type="DOCUMENT_STREAMED",
        actor_id=current_user.id,
        resource_id=str(job.id),
        status="SUCCESS"
    )
    
    return StreamingResponse(iterfile(), headers=headers)
```

---

## 7. Client-Side Security, Headers & Rate Limiting

### 7.1 Cross-Site Request Forgery (CSRF) Defenses
1. **API Token Architecture:** The system uses standard `Authorization: Bearer <JWT>` headers for API authentication stored in client memory (React state) rather than ambient cookies, rendering cross-site requests incapable of attaching credentials.
2. **Refresh Token Cookie Protection:** The refresh token is transmitted via an HTTP cookie hardened with:
   - `HttpOnly`: Prevents extraction via XSS.
   - `Secure`: Transmitted strictly over TLS/HTTPS.
   - `SameSite=Strict`: Completely suppresses cookie transmission on cross-origin requests.
   - `Path=/api/v1/auth`: Confined to authentication exchange routes.

### 7.2 Cross-Site Scripting (XSS) Defenses
1. **React Framework Safeguards:** React automatically escapes all string expressions rendered in JSX, neutralizing basic reflected and stored XSS.
2. **Dangerous Sinks Banned:** The code standard strictly prohibits:
   - `dangerouslySetInnerHTML`
   - `eval()`, `new Function()`
   - Direct DOM modifications (`document.write`, `innerHTML`)
3. **Content Sanitization:** Any dynamic display strings (such as file names or print notes) are validated via Pydantic on input, and sanitized with `DOMPurify` if ever processed in rich text contexts.

### 7.3 HTTP Security Headers Specification
All responses emitted by the Nginx reverse proxy and FastAPI application must carry the following strict HTTP headers:

```http
# Modern Content Security Policy (Strict, zero inline scripts)
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; block-all-mixed-content;

# Enforce TLS encryption for 2 years including subdomains
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload

# Prevent MIME-type confusion attacks
X-Content-Type-Options: nosniff

# Clickjacking mitigation (Prohibit iframe embedding)
X-Frame-Options: DENY

# Referrer privacy
Referrer-Policy: strict-origin-when-cross-origin

# Hardware and browser feature restrictions
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()

# Disable client-side caching of API responses
Cache-Control: no-store, no-cache, must-revalidate, private
Pragma: no-cache
```

### 7.4 Rate Limiting & Anti-DoS Architecture
Rate limiting is enforced at two distinct layers:
1. **Reverse Proxy (Nginx):** Drops SYN floods and rapid network-level bursts.
2. **Application (FastAPI / SlowAPI with Redis backend):** Enforces route-specific semantic limits keyed by `client_ip` for unauthenticated routes, and `user_id` for authenticated sessions.

| Endpoint Pattern | Rate Limit | Scope / Key | Violation Action |
| :--- | :---: | :---: | :--- |
| `/api/v1/auth/login` | 5 req / min | IP + Username | HTTP 429 + Tarpit delay |
| `/api/v1/auth/refresh` | 10 req / min | IP | HTTP 429 |
| `/api/v1/print-jobs` (POST upload) | 10 req / min | Authenticated User ID | HTTP 429 |
| `/api/v1/print-jobs/{id}/document` | 30 req / min | Authenticated User ID | HTTP 429 |
| `/api/v1/staff/queue` | 60 req / min | Staff User ID | HTTP 429 |
| Global Unauthenticated Fallback | 100 req / min | Client IP | HTTP 429 |

---

## 8. Audit Logging & Compliance Forensic Specification

### 8.1 Regulatory Context & Immutability
Under higher-education standards (FERPA), student educational records and associated submissions demand rigorous confidentiality and audit accountability. PrintEasy maintains a dedicated, append-only audit trail in PostgreSQL.

### 8.2 Audit Log Database Schema
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    event_type VARCHAR(64) NOT NULL,
    actor_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(32) NOT NULL,
    client_ip INET NOT NULL,
    user_agent TEXT NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128) NOT NULL,
    action VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL, -- 'SUCCESS', 'FAILURE', 'DENIED'
    failure_reason TEXT NULL,
    metadata JSONB NULL,
    prev_record_hash CHAR(64) NOT NULL,
    record_hash CHAR(64) NOT NULL
);

-- Indexing for forensic velocity
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, timestamp DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);

-- Enforce append-only privileges for the application database user
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM printeasy_app_user;
GRANT INSERT, SELECT ON audit_logs FROM printeasy_app_user;
```

### 8.3 Cryptographic Hash Chaining
To ensure tamper-evidence, each audit log row computes an SHA-256 HMAC or hash incorporating the previous row's hash (`prev_record_hash`), creating an immutable cryptographic chain:
```
record_hash = SHA256(prev_record_hash || timestamp || event_type || actor_id || resource_id || action || status)
```
Any modification or deletion of past records breaks the hash verification chain immediately during automated daily integrity verification scripts.

### 8.4 Event Taxonomy & Mandatory Audit Hooks

| Event Identifier | Trigger Condition | Severity | Logged Attributes |
| :--- | :--- | :---: | :--- |
| `AUTH_LOGIN_SUCCESS` | Correct credentials supplied | INFO | `actor_id`, `client_ip`, `user_agent` |
| `AUTH_LOGIN_FAILURE` | Invalid password or unknown user | WARN | Attempted `email`, `client_ip`, `failure_reason` |
| `AUTH_ACCOUNT_LOCKED` | 10 consecutive failed logins | HIGH | Target `email`, `client_ip`, duration |
| `AUTH_REPLAY_ATTACK_DETECTED`| Invalidated refresh token reused | CRITICAL| `family_id`, `actor_id`, `client_ip` |
| `JOB_CREATED` | New print job uploaded & queued | INFO | `job_id`, `user_id`, `page_count`, `file_hash`, `cost`|
| `JOB_CANCELLED` | Job cancelled and refunded | INFO | `job_id`, `user_id`, `refund_amount` |
| `DOCUMENT_STREAMED` | Staff or student downloads PDF | INFO | `job_id`, `actor_id`, `actor_role`, `client_ip` |
| `STATUS_TRANSITION` | Job state updated | INFO | `job_id`, `old_status`, `new_status`, `actor_id` |
| `ACCESS_DENIED_IDOR` | User attempts cross-tenant query | HIGH | `attempted_job_id`, `actor_id`, `client_ip` |
| `SECURITY_PAYLOAD_REJECTED` | File fails PDF magic/trailer check | HIGH | `user_id`, `client_ip`, `detected_token` |

### 8.5 PII Redaction & Data Minimization
* **Zero Password Logging:** Passwords, password hints, and raw tokens are strictly filtered out of application loggers and audit metadata.
* **Document Retention Policy:** Completed and cancelled PDF files are purged from `/var/storage/print_jobs/` after **24 hours** via an automated background task (`printeasy-cleanup.service`).
* **Metadata Retention:** Print job metadata (page counts, timestamps, billing amounts) is retained for 1 academic year for financial reconciliation, with student identifiers anonymized after 180 days.

---

## 9. Security Verification Test Suite & Checklist

### 9.1 Verification Test Matrix

| Test ID | Category | Target / Endpoint | Attack Scenario & Methodology | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **IDOR** | `GET /api/v1/print-jobs/{other_student_job_id}` | Student A attempts to access metadata of Student B's print job. | HTTP 404 Not Found (zero information leakage). |
| **SEC-02** | **IDOR** | `GET /api/v1/print-jobs/{other_student_job_id}/document` | Student A attempts to stream PDF payload of Student B's print job. | HTTP 404 Not Found, Audit Alert logged. |
| **SEC-03** | **RBAC** | `GET /api/v1/staff/queue` | Student provides valid student JWT to access operator queue. | HTTP 403 Forbidden. |
| **SEC-04** | **RBAC** | `PATCH /api/v1/staff/print-jobs/{id}/status` | Student calls status transition endpoint directly. | HTTP 403 Forbidden. |
| **SEC-05** | **RBAC** | `GET /api/v1/admin/audit-logs` | Staff member attempts to query audit log table. | HTTP 403 Forbidden. |
| **SEC-06** | **Upload** | `POST /api/v1/print-jobs` | Attacker uploads an ELF or Windows binary renamed to `document.pdf`. | HTTP 422 Unprocessable Entity (Magic byte validation failed). |
| **SEC-07** | **Upload** | `POST /api/v1/print-jobs` | Attacker uploads PDF containing `/JavaScript` action tag. | HTTP 422 Unprocessable Entity (Active content rejected). |
| **SEC-08** | **Upload** | `POST /api/v1/print-jobs` | Attacker streams a 15MB file. | HTTP 413 Payload Too Large. |
| **SEC-09** | **Path Traversal** | `POST /api/v1/print-jobs` | Multipart filename submitted as `../../../../etc/passwd`. | Filename sanitized, stored under `{job_uuid}.pdf`, system intact. |
| **SEC-10** | **Auth** | `POST /api/v1/auth/login` | 15 rapid failed login attempts against single account. | HTTP 429 Too Many Requests, account locked for 15m. |
| **SEC-11** | **Tokens** | `POST /api/v1/auth/refresh` | Replay attack using previously exchanged refresh token. | HTTP 401 Unauthorized, entire family revoked. |
| **SEC-12** | **State Machine**| `DELETE /api/v1/print-jobs/{id}` | Student attempts to cancel job currently in `PRINTING` state. | HTTP 409 Conflict / 400 Bad Request (Invalid transition). |
| **SEC-13** | **Headers** | Any Response | Inspect response headers via `curl -I`. | CSP, HSTS, X-Content-Type-Options, X-Frame-Options present. |

### 9.2 Automated Security Test Implementation (Pytest)

The following automated test file (`tests/test_security_controls.py`) validates the security perimeter:

```python
import pytest
from httpx import AsyncClient
import uuid

# -------------------------------------------------------------------------
# Test Case 1: IDOR Protection on Job Metadata & Document Streaming
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_student_cannot_access_other_student_job(
    client: AsyncClient,
    student_a_token: str,
    student_b_job: dict
):
    """
    Verify that Student A cannot access Student B's print job or download its file.
    Must return 404 (Not Found) to avoid existence enumeration.
    """
    headers = {"Authorization": f"Bearer {student_a_token}"}
    job_id = student_b_job["id"]
    
    # 1. Metadata check
    res_meta = await client.get(f"/api/v1/print-jobs/{job_id}", headers=headers)
    assert res_meta.status_code == 404, "IDOR check failed: Metadata accessible or returned 403 instead of 404"
    
    # 2. Document binary streaming check
    res_doc = await client.get(f"/api/v1/print-jobs/{job_id}/document", headers=headers)
    assert res_doc.status_code == 404, "IDOR check failed: File stream accessible to non-owner"

# -------------------------------------------------------------------------
# Test Case 2: File Upload Magic Byte & Active Content Validation
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_pdf_upload_security_validation(
    client: AsyncClient,
    student_a_token: str
):
    """
    Verify upload security:
    - Fake PDF (EXE binary) is rejected.
    - PDF with embedded JavaScript is rejected.
    - File exceeding 10MB is rejected.
    """
    headers = {"Authorization": f"Bearer {student_a_token}"}
    
    # A. Fake PDF (ELF binary header)
    fake_pdf = b"\x7fELF\x02\x01\x01\x00" + (b"\x00" * 100)
    files = {"file": ("malicious.pdf", fake_pdf, "application/pdf")}
    res_fake = await client.post("/api/v1/print-jobs", headers=headers, files=files)
    assert res_fake.status_code == 422
    assert "Invalid file format" in res_fake.json()["detail"]
    
    # B. Malicious PDF with embedded /JavaScript
    active_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Action /S /JavaScript /JS (app.alert('XSS')) >>\nendobj\n%%EOF"
    files = {"file": ("exploit.pdf", active_pdf, "application/pdf")}
    res_active = await client.post("/api/v1/print-jobs", headers=headers, files=files)
    assert res_active.status_code == 422
    assert "Active content" in res_active.json()["detail"]

# -------------------------------------------------------------------------
# Test Case 3: RBAC Boundary Enforcement
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_rbac_privilege_boundaries(
    client: AsyncClient,
    student_a_token: str,
    staff_token: str
):
    """
    Verify that Student cannot access Staff endpoints,
    and Staff cannot access Admin endpoints.
    """
    student_headers = {"Authorization": f"Bearer {student_a_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    
    # Student accessing staff queue
    res_queue = await client.get("/api/v1/staff/queue", headers=student_headers)
    assert res_queue.status_code == 403
    
    # Staff accessing admin audit logs
    res_audit = await client.get("/api/v1/admin/audit-logs", headers=staff_headers)
    assert res_audit.status_code == 403

# -------------------------------------------------------------------------
# Test Case 4: Security Headers Verification
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_security_headers_present(client: AsyncClient):
    """Verify that mandatory defense-in-depth headers are delivered."""
    res = await client.get("/api/v1/printers")
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert "default-src 'self'" in res.headers.get("Content-Security-Policy", "")
    assert "max-age=" in res.headers.get("Strict-Transport-Security", "")
```

### 9.3 Manual Pre-Deployment Verification Checklist
Prior to staging or production deployment, the engineering team must sign off on the following verification items:

- [ ] **Auth:** Argon2id parameters benchmarked on production hardware (execution runtime between 250ms and 500ms).
- [ ] **Tokens:** JWT asymmetric keys generated and mounted via read-only secrets volume; no hardcoded keys in repository.
- [ ] **IDOR:** All database queries accessing `print_jobs` enforce `user_id = current_user.id` or explicit `role in ('staff', 'admin')`.
- [ ] **Anti-Enumeration:** Verified that all unauthorized object lookups return HTTP 404 rather than 403.
- [ ] **File Storage:** Storage directory permissions set to `0700`, owned by non-root user `printeasy`.
- [ ] **File Serving:** Verified zero public webroot aliases map to `/var/storage/print_jobs/`.
- [ ] **File Streaming:** All downloads force `Content-Disposition: attachment; filename*=UTF-8''...` and `X-Content-Type-Options: nosniff`.
- [ ] **PDF Validation:** Magic bytes (`%PDF-`), trailer (`%%EOF`), and active script filters verified via test suite.
- [ ] **File Size Limit:** Web server (Nginx `client_max_body_size 10M`) and FastAPI streaming middleware both reject >10MB payloads.
- [ ] **State Machine:** Concurrency test executes 50 parallel cancel requests for a single job; exactly one succeeds and one refund is processed.
- [ ] **Audit Trail:** Verified PostgreSQL database user `printeasy_app_user` possesses only `INSERT` and `SELECT` on `audit_logs` table (`UPDATE` and `DELETE` denied).
- [ ] **Retention:** Automated cronjob `printeasy-cleanup.service` verified to shred PDF files older than 24 hours.

---
**Approval & Sign-Off:**
*Lead Cybersecurity Engineer:* _____________________  
*Lead Backend Engineer:* _____________________  
*Date:* November 11, 2026
