# PrintEasy — Database Schema & Architecture Specification
**Project:** PrintEasy - Digital College Printing Management System  
**Engine:** PostgreSQL 15+  
**ORM / Migration Framework:** SQLAlchemy 2.0 & Alembic  
**Target File:** `DATABASE_SCHEMA.md`  

---

## 1. Executive Overview & Design Principles

The PrintEasy database powers a high-throughput, self-service campus printing ecosystem where students upload documents, configure print settings, track queue status, and retrieve prints at campus service kiosks, while staff operate print queues and administrators audit operations.

### Key Architectural Tenets
1. **Strong Data Integrity & Relational Guarantees**: Strict Foreign Key constraints with carefully calibrated cascade rules (`CASCADE`, `RESTRICT`, and `SET NULL`) to prevent orphan records while preserving billing and compliance trails.
2. **Deterministic State Transitions & Concurrency Safety**: Row-level locking (`SELECT ... FOR UPDATE` and `FOR UPDATE SKIP LOCKED`) prevents race conditions between competing staff queue workers and concurrent student cancellations.
3. **Auditability by Design**: Every status transition generates an immutable `status_history` record, and administrative/security events write to `audit_logs` with structured JSONB metadata.
4. **PostgreSQL-Native Efficiency**:
   - UUIDv4 primary keys generated via PostgreSQL's native `gen_random_uuid()`.
   - Timezone-aware timestamps (`TIMESTAMPTZ`) stored strictly in UTC.
   - Native `ENUM` types for domain invariants (`user_role`, `request_status`, `color_mode`, `duplex_mode`).
   - Targeted B-tree indexes and a GIN index on `audit_logs.details`.

---

## 2. Complete Relational Database Schema (DDL)

```sql
-- ============================================================================
-- EXTENSIONS & CUSTOM ENUM TYPES
-- ============================================================================

-- Native pgcrypto or built-in gen_random_uuid() (Postgres 13+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User Roles
CREATE TYPE user_role AS ENUM ('student', 'staff', 'admin');

-- Print Request Lifecycle Statuses
CREATE TYPE request_status AS ENUM (
    'PENDING',
    'PROCESSING',
    'READY',
    'COLLECTED',
    'FAILED',
    'CANCELLED'
);

-- Color Modes
CREATE TYPE print_color_mode AS ENUM ('bw', 'color');

-- Duplex Printing Modes
CREATE TYPE print_duplex_mode AS ENUM ('single', 'double');

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE users IS 'System users including students, staff operators, and system admins.';
COMMENT ON COLUMN users.password_hash IS 'Argon2id or bcrypt hashed password string.';

-- ============================================================================
-- 2. DOCUMENTS TABLE
-- ============================================================================
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    storage_key VARCHAR(512) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(127) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT fk_documents_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE,

    CONSTRAINT uq_documents_storage_key UNIQUE (storage_key),
    CONSTRAINT ck_documents_file_size CHECK (file_size > 0 AND file_size <= 52428800), -- 50 MB ceiling
    CONSTRAINT ck_documents_file_hash_len CHECK (length(file_hash) = 64) -- SHA-256
);

COMMENT ON TABLE documents IS 'Uploaded file metadata referencing object storage (S3/local).';
COMMENT ON COLUMN documents.storage_key IS 'Unique key/path to the raw document in cloud/disk storage.';
COMMENT ON COLUMN documents.file_hash IS 'Hex-encoded SHA-256 digest for deduplication and integrity.';

-- ============================================================================
-- 3. PRINT_REQUESTS TABLE
-- ============================================================================
CREATE TABLE print_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    document_id UUID NOT NULL,
    status request_status NOT NULL DEFAULT 'PENDING',
    copies INTEGER NOT NULL DEFAULT 1,
    color_mode print_color_mode NOT NULL DEFAULT 'bw',
    duplex print_duplex_mode NOT NULL DEFAULT 'double',
    page_range VARCHAR(100) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT fk_print_requests_student_id
        FOREIGN KEY (student_id)
        REFERENCES users (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_print_requests_document_id
        FOREIGN KEY (document_id)
        REFERENCES documents (id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_print_requests_copies CHECK (copies > 0 AND copies <= 100)
);

COMMENT ON TABLE print_requests IS 'Main print job request entity tracking state and basic parameters.';
COMMENT ON COLUMN print_requests.student_id IS 'RESTRICT: User deletion is rejected if print orders exist.';
COMMENT ON COLUMN print_requests.document_id IS 'RESTRICT: Active print requests prevent source document deletion.';

-- ============================================================================
-- 4. PRINT_SETTINGS TABLE
-- ============================================================================
CREATE TABLE print_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL,
    page_range VARCHAR(100) NULL,
    copies INTEGER NOT NULL DEFAULT 1,
    color VARCHAR(20) NOT NULL DEFAULT 'bw',
    duplex VARCHAR(20) NOT NULL DEFAULT 'double',
    orientation VARCHAR(20) NOT NULL DEFAULT 'portrait',
    paper_size VARCHAR(20) NOT NULL DEFAULT 'A4',

    CONSTRAINT uq_print_settings_request_id UNIQUE (request_id),
    CONSTRAINT fk_print_settings_request_id
        FOREIGN KEY (request_id)
        REFERENCES print_requests (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_print_settings_copies CHECK (copies > 0 AND copies <= 100),
    CONSTRAINT ck_print_settings_orientation CHECK (orientation IN ('portrait', 'landscape')),
    CONSTRAINT ck_print_settings_paper_size CHECK (paper_size IN ('A4', 'A3', 'Letter', 'Legal'))
);

COMMENT ON TABLE print_settings IS 'Detailed physical printer hardware configurations (1:1 with print_requests).';

-- ============================================================================
-- 5. STATUS_HISTORY TABLE
-- ============================================================================
CREATE TABLE status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL,
    changed_by UUID NULL,
    old_status request_status NULL,
    new_status request_status NOT NULL,
    comment TEXT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT fk_status_history_request_id
        FOREIGN KEY (request_id)
        REFERENCES print_requests (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_status_history_changed_by
        FOREIGN KEY (changed_by)
        REFERENCES users (id)
        ON DELETE SET NULL
);

COMMENT ON TABLE status_history IS 'Immutable state transition ledger for SLA monitoring and troubleshooting.';

-- ============================================================================
-- 6. NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    request_id UUID NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT fk_notifications_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_notifications_request_id
        FOREIGN KEY (request_id)
        REFERENCES print_requests (id)
        ON DELETE SET NULL
);

COMMENT ON TABLE notifications IS 'User notification feed for job completion, queue updates, or failures.';

-- ============================================================================
-- 7. AUDIT_LOGS TABLE
-- ============================================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NULL,
    ip_address VARCHAR(45) NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT fk_audit_logs_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE SET NULL
);

COMMENT ON TABLE audit_logs IS 'Append-only regulatory and security audit trail.';
COMMENT ON COLUMN audit_logs.ip_address IS 'Supports IPv4 (up to 15 chars) and IPv6 (up to 45 chars).';
```

---

## 3. Entity-Relationship Diagrams (ERD)

### 3.1 Mermaid ER Diagram

```mermaid
erDiagram
    users ||--o{ documents : "uploads (1:N, ON DELETE CASCADE)"
    users ||--o{ print_requests : "places (1:N, ON DELETE RESTRICT)"
    users ||--o{ status_history : "transitions (1:N, ON DELETE SET NULL)"
    users ||--o{ notifications : "receives (1:N, ON DELETE CASCADE)"
    users ||--o{ audit_logs : "triggers (1:N, ON DELETE SET NULL)"

    documents ||--o{ print_requests : "referenced_by (1:N, ON DELETE RESTRICT)"

    print_requests ||--|| print_settings : "specifies (1:1, ON DELETE CASCADE)"
    print_requests ||--o{ status_history : "tracks (1:N, ON DELETE CASCADE)"
    print_requests ||--o{ notifications : "associates (1:N, ON DELETE SET NULL)"

    users {
        UUID id PK
        VARCHAR email UK
        VARCHAR password_hash
        user_role role
        VARCHAR name
        BOOLEAN is_active
        TIMESTAMPTZ created_at
    }

    documents {
        UUID id PK
        UUID user_id FK
        VARCHAR storage_key UK
        VARCHAR file_name
        BIGINT file_size
        VARCHAR mime_type
        VARCHAR file_hash
        TIMESTAMPTZ created_at
    }

    print_requests {
        UUID id PK
        UUID student_id FK
        UUID document_id FK
        request_status status
        INTEGER copies
        print_color_mode color_mode
        print_duplex_mode duplex
        VARCHAR page_range
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    print_settings {
        UUID id PK
        UUID request_id FK,UK
        VARCHAR page_range
        INTEGER copies
        VARCHAR color
        VARCHAR duplex
        VARCHAR orientation
        VARCHAR paper_size
    }

    status_history {
        UUID id PK
        UUID request_id FK
        UUID changed_by FK
        request_status old_status
        request_status new_status
        TEXT comment
        TIMESTAMPTZ timestamp
    }

    notifications {
        UUID id PK
        UUID user_id FK
        UUID request_id FK
        TEXT message
        BOOLEAN is_read
        TIMESTAMPTZ created_at
    }

    audit_logs {
        UUID id PK
        UUID user_id FK
        VARCHAR action
        VARCHAR entity_type
        UUID entity_id
        VARCHAR ip_address
        JSONB details
        TIMESTAMPTZ timestamp
    }
```

### 3.2 ASCII ER Diagram

```
 +-------------------------------------------------------------------------+
 |                                  USERS                                  |
 |-------------------------------------------------------------------------|
 | PK  id             : UUID (gen_random_uuid())                           |
 | UQ  email          : VARCHAR(255)                                       |
 |     password_hash  : VARCHAR(255)                                       |
 |     role           : ENUM ('student', 'staff', 'admin')                 |
 |     name           : VARCHAR(255)                                       |
 |     is_active      : BOOLEAN                                            |
 |     created_at     : TIMESTAMPTZ                                        |
 +-------------------------------------------------------------------------+
       | 1             | 1             | 1            | 1            | 1
       |               |               |              |              |
       | CASCADE       | RESTRICT      | SET NULL     | CASCADE      | SET NULL
       |               |               |              |              |
       v 0..N          v 0..N          v 0..N         v 0..N         v 0..N
 +-------------+ +---------------+ +------------+ +------------+ +------------+
 |  DOCUMENTS  | |PRINT_REQUESTS | |STATUS_HIST | |NOTIFICATNS | | AUDIT_LOGS |
 |-------------| |---------------| |------------| |------------| |------------|
 |PK id        | |PK id          | |PK id       | |PK id       | |PK id       |
 |FK user_id   | |FK student_id  | |FK request_ | |FK user_id  | |FK user_id  |
 |UQ stor_key  | |FK document_id | |   id       | |FK request_ | |   action   |
 |   file_name | |   status      | |FK changed_ | |   id (opt) | |   entity_  |
 |   file_size | |   copies      | |   by (opt) | |   message  | |   type     |
 |   mime_type | |   color_mode  | |   old_stat | |   is_read  | |   entity_id|
 |   file_hash | |   duplex      | |   new_stat | |   created_ | |   ip_addr  |
 |   created_at| |   page_range  | |   comment  | |     at     | |   details  |
 +-------------+ |   created_at  | |   timestamp| +------------+ |   timestamp|
       | 1       |   updated_at  | +------------+                +------------+
       |         +---------------+
       | RESTRICT   | 1        | 1
       |            |          |
       v 0..N       | CASCADE  | CASCADE
 (referenced by)----+          |
                    v 1..1     v 0..N
          +----------------+ +---------------+
          | PRINT_SETTINGS | |STATUS_HISTORY |
          |----------------| | (see above)   |
          |PK id           | +---------------+
          |FK,UQ request_id|
          |      page_range|
          |      copies    |
          |      color     |
          |      duplex    |
          |      orientatn |
          |      paper_size|
          +----------------+
```

---

## 4. Referential Integrity & Cascade Semantics

| Parent Table | Child Table | Foreign Key Column | On Delete Action | Business Justification |
| :--- | :--- | :--- | :--- | :--- |
| `users` | `documents` | `user_id` | **CASCADE** | If a user account is purged, their personal uploaded staging files are removed. |
| `users` | `print_requests` | `student_id` | **RESTRICT** | Financial/audit protection: prevents deleting accounts with active or completed print jobs. Account soft-deletion (`is_active = FALSE`) must be used instead. |
| `users` | `status_history` | `changed_by` | **SET NULL** | Retains transition history if the staff operator account is removed. |
| `users` | `notifications` | `user_id` | **CASCADE** | User notifications belong exclusively to that user. |
| `users` | `audit_logs` | `user_id` | **SET NULL** | Audit events must be immutable even if the initiating actor is anonymized or deleted. |
| `documents` | `print_requests` | `document_id` | **RESTRICT** | Prevents deleting underlying storage metadata while a print request references it. |
| `print_requests`| `print_settings`| `request_id` | **CASCADE** | Print settings are 1:1 job parameters; deleting the request cleans up its settings. |
| `print_requests`| `status_history`| `request_id` | **CASCADE** | Status transitions are owned entirely by the print request. |
| `print_requests`| `notifications` | `request_id` | **SET NULL** | Retains notification text in student inbox even if the print request entity is cleaned up. |

---

## 5. Indexing & Optimization Strategy

The indexing scheme is engineered to satisfy the critical application query paths: student dashboard views, staff queue polling, real-time unread notification badges, and forensic audit investigations.

```sql
-- ============================================================================
-- INDEX DEFINITIONS
-- ============================================================================

-- 1. USERS
-- Lookup by email (handled by UNIQUE constraint uq_users_email)
CREATE INDEX idx_users_role_active ON users (role, is_active);

-- 2. DOCUMENTS
CREATE INDEX idx_documents_user_id ON documents (user_id);
CREATE INDEX idx_documents_file_hash ON documents (file_hash);
CREATE INDEX idx_documents_created_at ON documents (created_at DESC);

-- 3. PRINT_REQUESTS
-- Composite index for student request history (most recent first)
CREATE INDEX idx_print_requests_student_created 
    ON print_requests (student_id, created_at DESC);

-- Composite index for staff queue filtering and processing
CREATE INDEX idx_print_requests_status_created 
    ON print_requests (status, created_at ASC);

-- Lookup by referenced document
CREATE INDEX idx_print_requests_document_id 
    ON print_requests (document_id);

-- 4. PRINT_SETTINGS
-- (Primary lookup is covered by uq_print_settings_request_id UNIQUE constraint)

-- 5. STATUS_HISTORY
-- Composite index for ordering audit events per request
CREATE INDEX idx_status_history_request_timestamp 
    ON status_history (request_id, timestamp DESC);

CREATE INDEX idx_status_history_changed_by 
    ON status_history (changed_by) 
    WHERE changed_by IS NOT NULL;

-- 6. NOTIFICATIONS
-- Composite partial index for student unread notification polling
CREATE INDEX idx_notifications_user_unread 
    ON notifications (user_id, created_at DESC) 
    WHERE is_read = FALSE;

-- General user notification retrieval
CREATE INDEX idx_notifications_user_all 
    ON notifications (user_id, created_at DESC);

-- 7. AUDIT_LOGS
-- Querying logs by entity target
CREATE INDEX idx_audit_logs_entity 
    ON audit_logs (entity_type, entity_id);

-- Querying user activity chronologically
CREATE INDEX idx_audit_logs_user_timestamp 
    ON audit_logs (user_id, timestamp DESC);

-- Forensic timeline queries
CREATE INDEX idx_audit_logs_timestamp 
    ON audit_logs (timestamp DESC);

-- GIN index for high-speed key/value queries inside JSONB metadata
CREATE INDEX idx_audit_logs_details_gin 
    ON audit_logs USING GIN (details);
```

### Indexing Rationale Matrix

| Index Name | Type | Key Column(s) | Justification |
| :--- | :--- | :--- | :--- |
| `idx_print_requests_status_created` | B-tree | `(status, created_at ASC)` | Essential for staff queue workers fetching `PENDING` orders FIFO. |
| `idx_print_requests_student_created`| B-tree | `(student_id, created_at DESC)`| Accelerates Student Portal "My Orders" paginated list. |
| `idx_notifications_user_unread` | Partial B-tree | `(user_id, created_at DESC) WHERE is_read = FALSE` | Eliminates table scans for real-time header bell notification counts. |
| `idx_documents_file_hash` | B-tree | `(file_hash)` | Rapid duplicate detection to save disk/S3 storage. |
| `idx_audit_logs_details_gin` | GIN | `(details)` | Enables fast `@>` JSON contains searches (e.g. `details @> '{"printer_id": "PRN-01"}'`). |

---

## 6. Concurrency Control, Locking & Transaction Boundaries

### 6.1 State Machine Rules
The `print_requests.status` column obeys a strict finite state machine:

```
                  +--------------+
                  |   PENDING    |
                  +--------------+
                     /        \
         (Staff picks)        (Student cancels)
                   v            v
           +------------+  +-----------+
           | PROCESSING |  | CANCELLED | (Terminal)
           +------------+  +-----------+
              /        \
     (Success)          (Hardware/Paper error)
            v            v
      +---------+   +----------+
      |  READY  |   |  FAILED  | (Terminal)
      +---------+   +----------+
           |
    (Student picks up)
           v
     +-----------+
     | COLLECTED | (Terminal)
     +-----------+
```

### 6.2 The Queue Pickup Race Condition (`FOR UPDATE SKIP LOCKED`)
When multiple staff operators pull pending jobs from the queue simultaneously, an ordinary `SELECT ... WHERE status = 'PENDING'` leads to two operators processing the exact same print request.

**Safe Queue Worker Pattern:**
```sql
BEGIN;

-- 1. Atomically acquire and lock exactly one pending request without blocking peers
SELECT id, student_id, document_id, copies
FROM print_requests
WHERE status = 'PENDING'
ORDER BY created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;

-- 2. Update status to PROCESSING
UPDATE print_requests
SET status = 'PROCESSING',
    updated_at = clock_timestamp()
WHERE id = :selected_request_id;

-- 3. Append to status_history
INSERT INTO status_history (
    id, request_id, changed_by, old_status, new_status, comment, timestamp
) VALUES (
    gen_random_uuid(), :selected_request_id, :staff_user_id,
    'PENDING', 'PROCESSING', 'Print job accepted by operator kiosk 02', clock_timestamp()
);

-- 4. Queue student notification
INSERT INTO notifications (
    id, user_id, request_id, message, is_read, created_at
) VALUES (
    gen_random_uuid(), :student_id, :selected_request_id,
    'Your print job is now being processed.', FALSE, clock_timestamp()
);

COMMIT;
```

### 6.3 Student Cancellation vs. Operator Processing Race Condition
If a student issues a cancellation request while staff is actively picking the job up:

```sql
BEGIN;

-- Explicit row lock on the target request
SELECT id, status, student_id 
FROM print_requests 
WHERE id = :request_id 
FOR UPDATE;

-- Validate transition invariant in application code:
-- Only PENDING jobs can be cancelled by student.
-- If status is already 'PROCESSING' or 'READY', abort and raise 409 Conflict.

UPDATE print_requests 
SET status = 'CANCELLED',
    updated_at = clock_timestamp()
WHERE id = :request_id;

INSERT INTO status_history (
    id, request_id, changed_by, old_status, new_status, comment, timestamp
) VALUES (
    gen_random_uuid(), :request_id, :student_id,
    'PENDING', 'CANCELLED', 'Cancelled by student prior to printing', clock_timestamp()
);

COMMIT;
```

### 6.4 Automatic Timestamp Trigger
An automated trigger keeps `updated_at` on `print_requests` updated on any mutation:

```sql
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_print_requests_updated_at
BEFORE UPDATE ON print_requests
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
```

---

## 7. SQLAlchemy 2.0 Declarative Models

The schema is defined in Python using modern SQLAlchemy 2.0 type-annotated syntax (`Mapped`, `mapped_column`, `relationship`).

```python
"""
Database models for PrintEasy.
File location: app/db/models.py
Compatible with SQLAlchemy 2.0+
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ============================================================================
# PYTHON ENUMS
# ============================================================================

class UserRole(str, enum.Enum):
    STUDENT = "student"
    STAFF = "staff"
    ADMIN = "admin"


class RequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    READY = "READY"
    COLLECTED = "COLLECTED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class ColorMode(str, enum.Enum):
    BW = "bw"
    COLOR = "color"


class DuplexMode(str, enum.Enum):
    SINGLE = "single"
    DOUBLE = "double"


# ============================================================================
# 1. USER MODEL
# ============================================================================

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        ENUM(UserRole, name="user_role", create_type=False),
        nullable=False,
        default=UserRole.STUDENT,
        server_default="student",
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )

    # Relationships
    documents: Mapped[List[Document]] = relationship(
        "Document", back_populates="user", cascade="all, delete-orphan"
    )
    print_requests: Mapped[List[PrintRequest]] = relationship(
        "PrintRequest", back_populates="student", foreign_keys="PrintRequest.student_id"
    )
    notifications: Mapped[List[Notification]] = relationship(
        "Notification", back_populates="user", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[List[AuditLog]] = relationship("AuditLog", back_populates="user")

    __table_args__ = (
        Index("idx_users_role_active", "role", "is_active"),
        CheckConstraint("email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'", name="ck_users_email_format"),
    )


# ============================================================================
# 2. DOCUMENT MODEL
# ============================================================================

class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    storage_key: Mapped[str] = mapped_column(String(512), unique=True, nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(127), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="documents")
    print_requests: Mapped[List[PrintRequest]] = relationship("PrintRequest", back_populates="document")

    __table_args__ = (
        CheckConstraint("file_size > 0 AND file_size <= 52428800", name="ck_documents_file_size"),
        CheckConstraint("length(file_hash) = 64", name="ck_documents_file_hash_len"),
        Index("idx_documents_created_at", created_at.desc()),
    )


# ============================================================================
# 3. PRINT_REQUEST MODEL
# ============================================================================

class PrintRequest(Base):
    __tablename__ = "print_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[RequestStatus] = mapped_column(
        ENUM(RequestStatus, name="request_status", create_type=False),
        nullable=False,
        default=RequestStatus.PENDING,
        server_default="PENDING",
    )
    copies: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    color_mode: Mapped[ColorMode] = mapped_column(
        ENUM(ColorMode, name="print_color_mode", create_type=False),
        nullable=False,
        default=ColorMode.BW,
        server_default="bw",
    )
    duplex: Mapped[DuplexMode] = mapped_column(
        ENUM(DuplexMode, name="print_duplex_mode", create_type=False),
        nullable=False,
        default=DuplexMode.DOUBLE,
        server_default="double",
    )
    page_range: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.clock_timestamp(),
        onupdate=func.clock_timestamp(),
    )

    # Relationships
    student: Mapped[User] = relationship("User", back_populates="print_requests", foreign_keys=[student_id])
    document: Mapped[Document] = relationship("Document", back_populates="print_requests")
    settings: Mapped[PrintSettings] = relationship(
        "PrintSettings", back_populates="print_request", uselist=False, cascade="all, delete-orphan"
    )
    status_history: Mapped[List[StatusHistory]] = relationship(
        "StatusHistory", back_populates="print_request", cascade="all, delete-orphan"
    )
    notifications: Mapped[List[Notification]] = relationship("Notification", back_populates="print_request")

    __table_args__ = (
        CheckConstraint("copies > 0 AND copies <= 100", name="ck_print_requests_copies"),
        Index("idx_print_requests_student_created", "student_id", created_at.desc()),
        Index("idx_print_requests_status_created", "status", created_at.asc()),
    )


# ============================================================================
# 4. PRINT_SETTINGS MODEL
# ============================================================================

class PrintSettings(Base):
    __tablename__ = "print_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("print_requests.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    page_range: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    copies: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="bw", server_default="bw")
    duplex: Mapped[str] = mapped_column(String(20), nullable=False, default="double", server_default="double")
    orientation: Mapped[str] = mapped_column(String(20), nullable=False, default="portrait", server_default="portrait")
    paper_size: Mapped[str] = mapped_column(String(20), nullable=False, default="A4", server_default="A4")

    # Relationships
    print_request: Mapped[PrintRequest] = relationship("PrintRequest", back_populates="settings")

    __table_args__ = (
        CheckConstraint("copies > 0 AND copies <= 100", name="ck_print_settings_copies"),
        CheckConstraint("orientation IN ('portrait', 'landscape')", name="ck_print_settings_orientation"),
        CheckConstraint("paper_size IN ('A4', 'A3', 'Letter', 'Legal')", name="ck_print_settings_paper_size"),
    )


# ============================================================================
# 5. STATUS_HISTORY MODEL
# ============================================================================

class StatusHistory(Base):
    __tablename__ = "status_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("print_requests.id", ondelete="CASCADE"), nullable=False
    )
    changed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    old_status: Mapped[Optional[RequestStatus]] = mapped_column(
        ENUM(RequestStatus, name="request_status", create_type=False), nullable=True
    )
    new_status: Mapped[RequestStatus] = mapped_column(
        ENUM(RequestStatus, name="request_status", create_type=False), nullable=False
    )
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )

    # Relationships
    print_request: Mapped[PrintRequest] = relationship("PrintRequest", back_populates="status_history")
    actor: Mapped[Optional[User]] = relationship("User", foreign_keys=[changed_by])

    __table_args__ = (
        Index("idx_status_history_request_timestamp", "request_id", timestamp.desc()),
        Index("idx_status_history_changed_by", "changed_by", postgresql_where=(changed_by.isnot(None))),
    )


# ============================================================================
# 6. NOTIFICATION MODEL
# ============================================================================

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    request_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("print_requests.id", ondelete="SET NULL"), nullable=True
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="notifications")
    print_request: Mapped[Optional[PrintRequest]] = relationship("PrintRequest", back_populates="notifications")

    __table_args__ = (
        Index("idx_notifications_user_unread", "user_id", created_at.desc(), postgresql_where=(is_read.is_(False))),
        Index("idx_notifications_user_all", "user_id", created_at.desc()),
    )


# ============================================================================
# 7. AUDIT_LOG MODEL
# ============================================================================

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    details: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="'{}'::jsonb"
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )

    # Relationships
    user: Mapped[Optional[User]] = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index("idx_audit_logs_entity", "entity_type", "entity_id"),
        Index("idx_audit_logs_user_timestamp", "user_id", timestamp.desc()),
        Index("idx_audit_logs_timestamp", timestamp.desc()),
        Index("idx_audit_logs_details_gin", "details", postgresql_using="gin"),
    )
```

---

## 8. Alembic Migration Plan & Execution

### 8.1 Directory Structure
```
/home/exu0/cybersecurity/ml-innovation/
├── alembic.ini
├── migrations/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── 20261111_0001_initial_schema.py
└── app/
    └── db/
        ├── base.py
        ├── session.py
        └── models.py
```

### 8.2 `alembic.ini` Configuration Highlights
```ini
[alembic]
script_location = migrations
prepend_sys_path = .
version_locations = migrations/versions

# Format timestamp in revision filename
file_template = %%(year)d%%(month).2d%%(day).2d_%%(rev)s_%%(slug)s

# Logging
[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic
```

### 8.3 `migrations/env.py` Autogenerate Hook
To ensure Alembic detects custom PostgreSQL ENUMs and types accurately:
```python
import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

from app.db.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def get_url():
    return os.getenv("DATABASE_URL", "postgresql+psycopg://printeasy:printeasy_pass@localhost:5432/printeasy_db")

def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()
```

### 8.4 Baseline Migration Script (`20261111_0001_initial_schema.py`)
```python
"""initial_schema

Revision ID: 0001_initial
Revises: None
Create Date: 2026-11-11 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto";')

    # 2. ENUM Types
    user_role = postgresql.ENUM('student', 'staff', 'admin', name='user_role')
    user_role.create(op.get_bind())

    request_status = postgresql.ENUM(
        'PENDING', 'PROCESSING', 'READY', 'COLLECTED', 'FAILED', 'CANCELLED',
        name='request_status'
    )
    request_status.create(op.get_bind())

    color_mode = postgresql.ENUM('bw', 'color', name='print_color_mode')
    color_mode.create(op.get_bind())

    duplex_mode = postgresql.ENUM('single', 'double', name='print_duplex_mode')
    duplex_mode.create(op.get_bind())

    # 3. Create Tables
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', user_role, server_default='student', nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('clock_timestamp()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email', name='uq_users_email'),
        sa.CheckConstraint("email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'", name='ck_users_email_format')
    )
    op.create_index('idx_users_role_active', 'users', ['role', 'is_active'])

    op.create_table(
        'documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storage_key', sa.String(length=512), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=False),
        sa.Column('mime_type', sa.String(length=127), nullable=False),
        sa.Column('file_hash', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('clock_timestamp()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_documents_user_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('storage_key', name='uq_documents_storage_key'),
        sa.CheckConstraint('file_size > 0 AND file_size <= 52428800', name='ck_documents_file_size'),
        sa.CheckConstraint('length(file_hash) = 64', name='ck_documents_file_hash_len')
    )
    op.create_index('idx_documents_user_id', 'documents', ['user_id'])
    op.create_index('idx_documents_file_hash', 'documents', ['file_hash'])
    op.create_index('idx_documents_created_at', 'documents', [sa.text('created_at DESC')])

    op.create_table(
        'print_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', request_status, server_default='PENDING', nullable=False),
        sa.Column('copies', sa.Integer(), server_default='1', nullable=False),
        sa.Column('color_mode', color_mode, server_default='bw', nullable=False),
        sa.Column('duplex', duplex_mode, server_default='double', nullable=False),
        sa.Column('page_range', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('clock_timestamp()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('clock_timestamp()'), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], name='fk_print_requests_document_id', ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], name='fk_print_requests_student_id', ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('copies > 0 AND copies <= 100', name='ck_print_requests_copies')
    )
    op.create_index('idx_print_requests_student_created', 'print_requests', ['student_id', sa.text('created_at DESC')])
    op.create_index('idx_print_requests_status_created', 'print_requests', ['status', sa.text('created_at ASC')])
    op.create_index('idx_print_requests_document_id', 'print_requests', ['document_id'])

    op.create_table(
        'print_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('request_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('page_range', sa.String(length=100), nullable=True),
        sa.Column('copies', sa.Integer(), server_default='1', nullable=False),
        sa.Column('color', sa.String(length=20), server_default='bw', nullable=False),
        sa.Column('duplex', sa.String(length=20), server_default='double', nullable=False),
        sa.Column('orientation', sa.String(length=20), server_default='portrait', nullable=False),
        sa.Column('paper_size', sa.String(length=20), server_default='A4', nullable=False),
        sa.ForeignKeyConstraint(['request_id'], ['print_requests.id'], name='fk_print_settings_request_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('request_id', name='uq_print_settings_request_id'),
        sa.CheckConstraint('copies > 0 AND copies <= 100', name='ck_print_settings_copies'),
        sa.CheckConstraint("orientation IN ('portrait', 'landscape')", name='ck_print_settings_orientation'),
        sa.CheckConstraint("paper_size IN ('A4', 'A3', 'Letter', 'Legal')", name='ck_print_settings_paper_size')
    )

    op.create_table(
        'status_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('request_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('changed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('old_status', request_status, nullable=True),
        sa.Column('new_status', request_status, nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('clock_timestamp()'), nullable=False),
        sa.ForeignKeyConstraint(['changed_by'], ['users.id'], name='fk_status_history_changed_by', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['request_id'], ['print_requests.id'], name='fk_status_history_request_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_status_history_request_timestamp', 'status_history', ['request_id', sa.text('timestamp DESC')])
    op.create_index('idx_status_history_changed_by', 'status_history', ['changed_by'], postgresql_where=sa.text('changed_by IS NOT NULL'))

    op.create_table(
        'notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('request_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('is_read', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('clock_timestamp()'), nullable=False),
        sa.ForeignKeyConstraint(['request_id'], ['print_requests.id'], name='fk_notifications_request_id', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_notifications_user_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_notifications_user_unread', 'notifications', ['user_id', sa.text('created_at DESC')], postgresql_where=sa.text('is_read = FALSE'))
    op.create_index('idx_notifications_user_all', 'notifications', ['user_id', sa.text('created_at DESC')])

    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('entity_type', sa.String(length=100), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('clock_timestamp()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_audit_logs_user_id', ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_audit_logs_entity', 'audit_logs', ['entity_type', 'entity_id'])
    op.create_index('idx_audit_logs_user_timestamp', 'audit_logs', ['user_id', sa.text('timestamp DESC')])
    op.create_index('idx_audit_logs_timestamp', 'audit_logs', [sa.text('timestamp DESC')])
    op.create_index('idx_audit_logs_details_gin', 'audit_logs', ['details'], postgresql_using='gin')


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('notifications')
    op.drop_table('status_history')
    op.drop_table('print_settings')
    op.drop_table('print_requests')
    op.drop_table('documents')
    op.drop_table('users')

    sa.Enum(name='print_duplex_mode').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='print_color_mode').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='request_status').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='user_role').drop(op.get_bind(), checkfirst=False)
```

### 8.5 Migration Lifecycle Commands
```bash
# Initialize alembic (if running fresh)
alembic init migrations

# Generate revision after editing SQLAlchemy models
alembic revision --autogenerate -m "add_table_or_column_name"

# Apply pending migrations to the latest revision
alembic upgrade head

# Rollback single migration step
alembic downgrade -1

# Inspect current schema version vs database state
alembic current
alembic history --verbose
```

---

## 9. Security, Data Hygiene & Retention Rules

1. **Password Storage**: Passwords must never be stored in plaintext. `password_hash` stores salted hashes generated using `Argon2id` or `bcrypt` (cost factor >= 12).
2. **PII Anonymization on Account Purge**:
   - Because `print_requests` uses `ON DELETE RESTRICT` for `student_id`, active accounts are disabled via `is_active = FALSE`.
   - When GDPR / Right-to-be-Forgotten compliance requires data removal, user records are sanitized by replacing `name` with `'Anonymized Student'` and `email` with `'anonymized_<uuid>@printeasy.local'`, leaving operational accounting metrics intact.
3. **Audit Log Immutability**:
   - The application database user must not be granted `UPDATE` or `DELETE` privileges on `audit_logs` or `status_history`.
   - In production, configure an automated PostgreSQL table rule or revoke statement:
     ```sql
     REVOKE UPDATE, DELETE ON audit_logs FROM printeasy_app_user;
     REVOKE UPDATE, DELETE ON status_history FROM printeasy_app_user;
     ```
