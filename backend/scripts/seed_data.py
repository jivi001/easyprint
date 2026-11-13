"""Seed default demo accounts for Student, Staff, and Admin."""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal, engine, Base
import app.models  # noqa: F401
from app.models.user import User, UserRole
from app.core.security import hash_password


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        accounts = [
            {
                "email": "student@college.edu",
                "name": "Alex Student",
                "role": UserRole.STUDENT,
                "password": "Password123!",
            },
            {
                "email": "staff@college.edu",
                "name": "Jordan Staff (Operator)",
                "role": UserRole.STAFF,
                "password": "Password123!",
            },
            {
                "email": "admin@college.edu",
                "name": "Campus IT Admin",
                "role": UserRole.ADMIN,
                "password": "Password123!",
            },
        ]

        for acc in accounts:
            existing = db.query(User).filter(User.email == acc["email"]).first()
            if not existing:
                user = User(
                    email=acc["email"],
                    name=acc["name"],
                    role=acc["role"],
                    password_hash=hash_password(acc["password"]),
                    is_active=True
                )
                db.add(user)
                print(f"Created {acc['role'].value}: {acc['email']}")
            else:
                print(f"Already exists: {acc['email']}")

        db.commit()
        print("Seeding complete successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
