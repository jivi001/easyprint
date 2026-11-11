import uuid
from typing import Optional
from sqlalchemy.orm import Session
from app.repositories.user_repository import UserRepository
from app.repositories.audit_repository import AuditRepository
from app.models.user import User, UserRole
from app.schemas.user import UserRegister, UserLogin, TokenResponse, UserResponse
from app.core.security import hash_password, verify_password, create_access_token
from app.core.exceptions import DomainException


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.audit_repo = AuditRepository(db)

    def register(self, data: UserRegister, ip_address: Optional[str] = None) -> UserResponse:
        existing = self.user_repo.get_by_email(data.email)
        if existing:
            raise DomainException("An account with this email address already exists.", "EMAIL_TAKEN")

        role = data.role or UserRole.STUDENT
        user = User(
            email=data.email.lower().strip(),
            password_hash=hash_password(data.password),
            name=data.name.strip(),
            role=role,
            is_active=True
        )
        self.user_repo.create(user)
        self.db.commit()
        self.db.refresh(user)

        self.audit_repo.log_event(
            action="USER_REGISTER",
            entity_type="user",
            user_id=user.id,
            entity_id=str(user.id),
            ip_address=ip_address,
            details={"email": user.email, "role": user.role.value}
        )
        self.db.commit()

        return UserResponse.model_validate(user)

    def login(self, data: UserLogin, ip_address: Optional[str] = None) -> TokenResponse:
        user = self.user_repo.get_by_email(data.email)
        if not user or not verify_password(data.password, user.password_hash):
            self.audit_repo.log_event(
                action="LOGIN_FAILED",
                entity_type="user",
                ip_address=ip_address,
                details={"attempted_email": data.email}
            )
            self.db.commit()
            raise DomainException("Invalid email or password.", "AUTH_FAILED")

        if not user.is_active:
            raise DomainException("Account is disabled. Please contact the administrator.", "ACCOUNT_DISABLED")

        token = create_access_token(
            subject=str(user.id),
            role=user.role.value,
            email=user.email
        )

        self.audit_repo.log_event(
            action="LOGIN_SUCCESS",
            entity_type="user",
            user_id=user.id,
            entity_id=str(user.id),
            ip_address=ip_address,
            details={"role": user.role.value}
        )
        self.db.commit()

        return TokenResponse(
            access_token=token,
            role=user.role,
            name=user.name,
            email=user.email,
            user_id=user.id
        )
