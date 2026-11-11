import os
import sys
import uuid
import pytest
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_path))

from app.core.database import Base, get_db
from app.core.config import get_settings
from app.core.security import hash_password, create_access_token
from app.models.user import User, UserRole
from app.main import app

settings = get_settings()

# Use temporary storage for tests
settings.STORAGE_DIR = Path("/tmp/user/1000/opencode/printeasy_test_storage")
settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# In-memory SQLite database for test speed and complete isolation
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def student_user(db_session):
    user = User(
        id=uuid.uuid4(),
        email=f"student_{uuid.uuid4().hex[:6]}@college.edu",
        password_hash=hash_password("Password123!"),
        name="Alice Student",
        role=UserRole.STUDENT,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def student_token(student_user):
    return create_access_token(
        subject=str(student_user.id),
        role=student_user.role.value,
        email=student_user.email
    )


@pytest.fixture
def student_auth_header(student_token):
    return {"Authorization": f"Bearer {student_token}"}


@pytest.fixture
def second_student_user(db_session):
    user = User(
        id=uuid.uuid4(),
        email=f"student2_{uuid.uuid4().hex[:6]}@college.edu",
        password_hash=hash_password("Password123!"),
        name="Bob SecondStudent",
        role=UserRole.STUDENT,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def second_student_auth_header(second_student_user):
    token = create_access_token(
        subject=str(second_student_user.id),
        role=second_student_user.role.value,
        email=second_student_user.email
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def staff_user(db_session):
    user = User(
        id=uuid.uuid4(),
        email=f"staff_{uuid.uuid4().hex[:6]}@college.edu",
        password_hash=hash_password("Password123!"),
        name="Sam Staff",
        role=UserRole.STAFF,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def staff_token(staff_user):
    return create_access_token(
        subject=str(staff_user.id),
        role=staff_user.role.value,
        email=staff_user.email
    )


@pytest.fixture
def staff_auth_header(staff_token):
    return {"Authorization": f"Bearer {staff_token}"}


@pytest.fixture
def admin_user(db_session):
    user = User(
        id=uuid.uuid4(),
        email=f"admin_{uuid.uuid4().hex[:6]}@college.edu",
        password_hash=hash_password("Password123!"),
        name="Carol Admin",
        role=UserRole.ADMIN,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def admin_token(admin_user):
    return create_access_token(
        subject=str(admin_user.id),
        role=admin_user.role.value,
        email=admin_user.email
    )


@pytest.fixture
def admin_auth_header(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def valid_pdf_bytes():
    """Generates a minimal RFC-compliant PDF buffer with magic bytes and EOF trailer."""
    content = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
        b"xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n"
        b"trailer\n<< /Size 4 /Root 1 0 R >>\n"
        b"startxref\n190\n%%EOF\n"
    )
    return content


@pytest.fixture
def invalid_pdf_bytes():
    """Buffer masquerading as PDF without %PDF- magic bytes."""
    return b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"


@pytest.fixture
def malicious_script_pdf_bytes():
    """PDF containing prohibited active script token."""
    return b"%PDF-1.4\n1 0 obj\n<< /JavaScript (app.alert('pwned')) >>\nendobj\ntrailer\n<<>>\n%%EOF\n"
