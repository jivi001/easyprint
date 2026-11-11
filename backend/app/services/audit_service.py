import uuid
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.repositories.audit_repository import AuditRepository
from app.repositories.user_repository import UserRepository
from app.repositories.print_request_repository import PrintRequestRepository
from app.repositories.document_repository import DocumentRepository
from app.models.user import User, UserRole
from app.models.document import Document
from app.models.audit_log import AuditLog
from app.schemas.admin import AdminReportResponse, AuditLogResponse


class AuditService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_repo = AuditRepository(db)
        self.user_repo = UserRepository(db)
        self.req_repo = PrintRequestRepository(db)
        self.doc_repo = DocumentRepository(db)

    def get_audit_logs(self, skip: int = 0, limit: int = 100) -> List[AuditLogResponse]:
        logs = self.audit_repo.get_recent_logs(skip=skip, limit=limit)
        response_items = []
        for log in logs:
            user_email = log.user.email if log.user else None
            response_items.append(
                AuditLogResponse(
                    id=log.id,
                    user_id=log.user_id,
                    user_email=user_email,
                    action=log.action,
                    entity_type=log.entity_type,
                    entity_id=log.entity_id,
                    ip_address=log.ip_address,
                    details=log.details,
                    timestamp=log.timestamp
                )
            )
        return response_items

    def generate_system_report(self) -> AdminReportResponse:
        total_users = self.user_repo.total_users()
        total_students = self.user_repo.count_by_role(UserRole.STUDENT)
        total_staff = self.user_repo.count_by_role(UserRole.STAFF) + self.user_repo.count_by_role(UserRole.ADMIN)
        
        status_counts = self.req_repo.count_by_status()
        total_requests = sum(status_counts.values())
        
        total_copies = self.req_repo.total_copies()
        total_docs = self.doc_repo.count_documents()

        total_storage_bytes = self.db.query(func.sum(Document.file_size)).scalar() or 0

        return AdminReportResponse(
            total_users=total_users,
            total_students=total_students,
            total_staff=total_staff,
            total_print_requests=total_requests,
            requests_by_status=status_counts,
            total_pages_printed_approx=total_copies,
            total_documents_uploaded=total_docs,
            total_storage_bytes=total_storage_bytes
        )
