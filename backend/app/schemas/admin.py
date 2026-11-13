import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, EmailStr
from app.models.user import UserRole
from app.models.print_request import RequestStatus


class AdminReportResponse(BaseModel):
    total_users: int
    total_students: int
    total_staff: int
    total_print_requests: int
    requests_by_status: Dict[str, int]
    total_pages_printed_approx: int
    total_documents_uploaded: int
    total_storage_bytes: int
    total_revenue: float = 0.0
    total_paid_requests: int = 0
    total_unpaid_requests: int = 0
    revenue_by_method: Dict[str, float] = {}


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    user_email: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    ip_address: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class UserUpdateRole(BaseModel):
    role: UserRole
    is_active: Optional[bool] = None
