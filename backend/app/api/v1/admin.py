import uuid
from typing import List
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import UserRole
from app.services.audit_service import AuditService
from app.repositories.user_repository import UserRepository
from app.schemas.admin import AdminReportResponse, AuditLogResponse, UserUpdateRole
from app.schemas.user import UserResponse

router = APIRouter(prefix="/admin", tags=["Admin & Reporting"])


@router.get("/reports", response_model=AdminReportResponse)
def get_system_reports(
    current_user=Depends(require_roles([UserRole.ADMIN.value, UserRole.STAFF.value])),
    db: Session = Depends(get_db)
):
    """
    Generate aggregate system metrics:
    - User statistics (students vs staff)
    - Print request volume by status
    - Total estimated volume and storage footprint
    """
    service = AuditService(db)
    return service.generate_system_report()


@router.get("/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user=Depends(require_roles([UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """
    View immutable forensic audit trail (Admin only).
    """
    service = AuditService(db)
    return service.get_audit_logs(skip=skip, limit=limit)


@router.get("/users", response_model=List[UserResponse])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user=Depends(require_roles([UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """List system users for administrative management."""
    user_repo = UserRepository(db)
    users = user_repo.get_all(skip=skip, limit=limit)
    return [UserResponse.model_validate(u) for u in users]


@router.patch("/users/{id}/role", response_model=UserResponse)
def update_user_role(
    id: uuid.UUID,
    data: UserUpdateRole,
    current_user=Depends(require_roles([UserRole.ADMIN.value])),
    db: Session = Depends(get_db)
):
    """Update role or active status of a user (Admin only)."""
    user_repo = UserRepository(db)
    user = user_repo.get_by_id(id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)
