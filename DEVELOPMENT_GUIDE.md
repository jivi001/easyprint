# PrintEasy — Developer & Operations Guide

Document Version: 1.0  
Author: SUBAGENT 11 — Senior Software Documentation Engineer  
Status: Active Reference Guide

---

## 1. Introduction

This guide documents development workflows, environment setups, database migration procedures, testing routines, and production operations for **PrintEasy**.

---

## 2. Local Environment Setup

### 2.1 Backend (Python 3.11+ & FastAPI)

```bash
# 1. Clone repository and navigate to root
cd printeasy

# 2. Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# 3. Install backend dependencies
pip install -r backend/requirements.txt

# 4. Configure local environment variables
cp .env.example .env

# 5. Run database migrations
alembic upgrade head

# 6. Start the development server with live reload
uvicorn app.main:app --app-dir backend --reload --port 8000
```
API Documentation:
- Swagger UI: `http://localhost:8000/api/v1/docs`
- ReDoc: `http://localhost:8000/api/v1/redoc`
- OpenAPI JSON: `http://localhost:8000/api/v1/openapi.json`
- Health check: `http://localhost:8000/health`

---

### 2.2 Frontend (React 18 + TypeScript + Vite)

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install Node dependencies
npm install

# 3. Start Vite development server
npm run dev
```
Frontend runs locally at `http://localhost:5173` with reverse proxy forwarding `/api` calls to `http://127.0.0.1:8000`.

To create a production static build:
```bash
npm run build
```

---

## 3. Database Management & Migrations (Alembic)

PrintEasy uses **SQLAlchemy 2.0** models and **Alembic** migrations.

### Applying Migrations
```bash
# Upgrade database to latest revision
alembic upgrade head

# Downgrade by one revision
alembic downgrade -1

# View migration history
alembic history --verbose
```

### Creating New Migrations
When modifying models in `backend/app/models/`:
```bash
# Autogenerate migration from models
alembic revision --autogenerate -m "describe_changes"

# Inspect generated file in backend/migrations/versions/ before applying!
alembic upgrade head
```

---

## 4. Running Automated Tests

Run the full automated test suite using Pytest:

```bash
# Run all tests with verbose output
pytest backend/tests/ -v

# Run a specific test suite
pytest backend/tests/test_workflow.py -v
pytest backend/tests/test_documents.py -v
pytest backend/tests/test_auth.py -v

# Run with test coverage
pytest --cov=backend/app backend/tests/
```

---

## 5. Docker Deployment

### Multi-Container Stack Orchestration

```bash
# Build images and start stack in detached mode
docker compose up --build -d

# Check running container status
docker compose ps

# View service logs
docker compose logs -f backend
docker compose logs -f nginx
docker compose logs -f postgres

# Stop all containers
docker compose down
```

### Volume Persistence & Backups
- Database data volume: `postgres_data`
- Document files volume: `document_storage` (maps to `/app/storage/private` inside backend container)

To create a database backup:
```bash
docker compose exec postgres pg_dump -U printeasy -d printeasy > backup_$(date +%Y%m%d_%H%M%S).sql
```

To restore a database backup:
```bash
cat backup_file.sql | docker compose exec -T postgres psql -U printeasy -d printeasy
```

---

## 6. Security & Operational Runbooks

### 6.1 Secret Key Rotation
1. Generate a new high-entropy string (64+ characters).
2. Update `SECRET_KEY` in production `.env`.
3. Restart `printeasy-backend` service.
4. *Note:* Active JWT sessions will expire and require user re-authentication.

### 6.2 Storage Disk Monitoring
PrintEasy stores uploaded PDFs in `storage/private/`. Ensure automated monitoring flags storage consumption exceeding 80% capacity:
```bash
du -sh storage/private/
```

### 6.3 Emergency Document Purge
If a student requests immediate erasure of an uploaded document under campus privacy policies:
```python
# Launch Python shell
from app.core.database import SessionLocal
from app.models.document import Document
from pathlib import Path

db = SessionLocal()
doc = db.query(Document).filter(Document.id == "DOCUMENT_UUID").first()
if doc:
    file_path = Path("storage/private") / doc.storage_key
    if file_path.exists():
        file_path.unlink() # Secure file deletion
    db.delete(doc)
    db.commit()
db.close()
```
