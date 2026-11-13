import uuid
from typing import Optional, List, Dict
from sqlalchemy.orm import Session

from app.core.exceptions import (
    InvalidStateTransitionError,
    ResourceNotFoundError,
    UnauthorizedAccessError,
    DomainException,
)
from app.models.user import User, UserRole
from app.models.print_request import PrintRequest, RequestStatus, ColorMode, DuplexMode
from app.models.print_settings import PrintSettings
from app.models.document import Document
from app.schemas.print_request import PrintRequestCreate, StatusUpdateSchema
from app.repositories.print_request_repository import PrintRequestRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.audit_repository import AuditRepository
from app.models.notification import Notification
from app.services.payment_service import PaymentService


# State machine allowed transitions
ALLOWED_TRANSITIONS = {
    RequestStatus.PENDING: {RequestStatus.PROCESSING, RequestStatus.CANCELLED},
    RequestStatus.PROCESSING: {RequestStatus.READY, RequestStatus.FAILED},
    RequestStatus.READY: {RequestStatus.COLLECTED},
    RequestStatus.COLLECTED: set(),   # Terminal state
    RequestStatus.FAILED: set(),      # Terminal state
    RequestStatus.CANCELLED: set(),   # Terminal state
}


class WorkflowService:
    def __init__(self, db: Session):
        self.db = db
        self.req_repo = PrintRequestRepository(db)
        self.doc_repo = DocumentRepository(db)
        self.notif_repo = NotificationRepository(db)
        self.audit_repo = AuditRepository(db)

    def create_print_request(
        self,
        student: User,
        data: PrintRequestCreate,
        ip_address: Optional[str] = None
    ) -> PrintRequest:
        """
        Creates a new print request for an uploaded document owned by the student.
        """
        # Validate that document exists and belongs to the student
        doc = self.doc_repo.get_by_id(data.document_id)
        if not doc:
            raise ResourceNotFoundError("Specified document does not exist.")
        if doc.user_id != student.id and student.role == UserRole.STUDENT:
            raise UnauthorizedAccessError("You can only submit print requests for your own documents.")

        # Validate settings constraints
        if data.copies < 1 or data.copies > 100:
            raise DomainException("Copies must be between 1 and 100.")

        req = PrintRequest(
            student_id=student.id,
            document_id=doc.id,
            status=RequestStatus.PENDING,
            copies=data.copies,
            color_mode=data.color_mode,
            duplex=data.duplex,
            page_range=data.page_range
        )
        self.req_repo.create(req)
        self.db.flush()

        # Create separate print_settings record
        settings = PrintSettings(
            request_id=req.id,
            page_range=data.page_range,
            copies=data.copies,
            color=data.color_mode.value,
            duplex=data.duplex.value,
            orientation=data.orientation or "portrait",
            paper_size=data.paper_size or "A4"
        )
        self.req_repo.add_print_settings(settings)

        # Record initial status in history
        self.req_repo.add_status_history(
            request_id=req.id,
            old_status="NONE",
            new_status=RequestStatus.PENDING.value,
            changed_by=student.id,
            comment="Print request submitted."
        )

        # Create initial UNPAID payment record with calculated pricing
        payment_service = PaymentService(self.db)
        payment_service.create_payment_for_request(req, doc)

        self.audit_repo.log_event(
            action="PRINT_REQUEST_CREATE",
            entity_type="print_request",
            user_id=student.id,
            entity_id=str(req.id),
            ip_address=ip_address,
            details={
                "document_id": str(doc.id),
                "copies": data.copies,
                "color_mode": data.color_mode.value,
                "duplex": data.duplex.value
            }
        )

        self.db.commit()
        return self.req_repo.get_by_id_with_relations(req.id)

    def update_request_status(
        self,
        request_id: uuid.UUID,
        actor: User,
        data: StatusUpdateSchema,
        ip_address: Optional[str] = None
    ) -> PrintRequest:
        """
        Validates transition and updates request status and history inside a single transaction.
        Notifies student when status changes.
        """
        # Concurrency safety: fetch row with lock
        req = self.req_repo.get_for_update(request_id)
        if not req:
            raise ResourceNotFoundError("Print request not found.")

        current_status = req.status
        target_status = data.status

        # If already at target status, return
        if current_status == target_status:
            return req

        # Check role permissions for the transition
        if actor.role == UserRole.STUDENT:
            # Students can only cancel their own pending requests
            if req.student_id != actor.id:
                raise UnauthorizedAccessError("Access denied: You do not own this request.")
            if target_status != RequestStatus.CANCELLED:
                raise UnauthorizedAccessError("Students are only permitted to cancel pending requests.")
        else:
            # Staff and Admin can execute operational workflow transitions
            pass

        # Validate finite state machine transition rules
        allowed = ALLOWED_TRANSITIONS.get(current_status, set())
        if target_status not in allowed:
            raise InvalidStateTransitionError(
                f"Illegal status transition: cannot change from '{current_status.value}' to '{target_status.value}'."
            )

        # Apply transition
        req.status = target_status

        # Record status history in same transaction
        self.req_repo.add_status_history(
            request_id=req.id,
            old_status=current_status.value,
            new_status=target_status.value,
            changed_by=actor.id,
            comment=data.comment
        )

        # Generate student notification
        notification_message = self._generate_notification_text(req, target_status, data.comment)
        if notification_message:
            notification = Notification(
                user_id=req.student_id,
                request_id=req.id,
                message=notification_message,
                is_read=False
            )
            self.notif_repo.create(notification)

        self.audit_repo.log_event(
            action="PRINT_REQUEST_STATUS_UPDATE",
            entity_type="print_request",
            user_id=actor.id,
            entity_id=str(req.id),
            ip_address=ip_address,
            details={
                "old_status": current_status.value,
                "new_status": target_status.value,
                "actor_role": actor.role.value,
                "comment": data.comment
            }
        )

        self.db.commit()
        return self.req_repo.get_by_id_with_relations(req.id)

    def get_request_details(self, request_id: uuid.UUID, user: User) -> PrintRequest:
        req = self.req_repo.get_by_id_with_relations(request_id)
        if not req:
            raise ResourceNotFoundError("Print request not found.")
        
        # IDOR check
        if user.role == UserRole.STUDENT and req.student_id != user.id:
            raise UnauthorizedAccessError("Access denied: You cannot view this print request.")
        return req

    def list_requests(
        self,
        user: User,
        status: Optional[RequestStatus] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[PrintRequest]:
        if user.role == UserRole.STUDENT:
            return self.req_repo.get_student_requests(user.id, status=status, skip=skip, limit=limit)
        else:
            return self.req_repo.get_queue(status=status, skip=skip, limit=limit)

    def _generate_notification_text(
        self,
        req: PrintRequest,
        status: RequestStatus,
        comment: Optional[str]
    ) -> Optional[str]:
        doc_name = req.document.file_name if req.document else "your document"
        if status == RequestStatus.PROCESSING:
            return f"Your print request for '{doc_name}' is now being processed by print staff."
        elif status == RequestStatus.READY:
            return f"Good news! Your print job for '{doc_name}' is READY for pickup at the college print center."
        elif status == RequestStatus.COLLECTED:
            return f"Print job for '{doc_name}' has been confirmed as COLLECTED. Thank you!"
        elif status == RequestStatus.FAILED:
            reason = f": {comment}" if comment else "."
            return f"Notice: Your print job for '{doc_name}' could not be completed{reason}"
        elif status == RequestStatus.CANCELLED:
            return f"Print job for '{doc_name}' has been cancelled."
        return None
