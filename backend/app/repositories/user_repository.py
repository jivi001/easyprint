from typing import Optional, List
import uuid
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.user import User, UserRole


class UserRepository(BaseRepository[User]):
    def __init__(self, db: Session):
        super().__init__(User, db)

    def get_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email.lower().strip()).first()

    def get_by_role(self, role: UserRole, skip: int = 0, limit: int = 100) -> List[User]:
        return self.db.query(User).filter(User.role == role).offset(skip).limit(limit).all()

    def count_by_role(self, role: UserRole) -> int:
        return self.db.query(User).filter(User.role == role).count()

    def total_users(self) -> int:
        return self.db.query(User).count()
