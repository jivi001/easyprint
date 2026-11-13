import uuid
import re
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import (
    ResourceNotFoundError,
    UnauthorizedAccessError,
    DomainException,
)
from app.models.user import User, UserRole
from app.models.print_request import PrintRequest, RequestStatus
from app.models.document import Document
from app.models.payment import Payment, PaymentStatus, PaymentMethod
from app.models.notification import Notification
from app.schemas.payment import (
    PaymentRateInfo,
    PaymentCalculateResponse,
    PaymentProcessRequest,
    StaffPaymentConfirmRequest,
    PaymentResponse,
    PaymentReceiptResponse,
)
from app.repositories.print_request_repository import PrintRequestRepository
from app.repositories.audit_repository import AuditRepository
from app.repositories.notification_repository import NotificationRepository
from app.utils.pdf_validator import extract_pdf_page_count

settings = get_settings()

RATE_BW_PER_PAGE = 0.10
RATE_COLOR_PER_PAGE = 0.50
CURRENCY = "USD"
CURRENCY_SYMBOL = "$"


def parse_page_range_count(page_range: str, total_doc_pages: int = 1) -> int:
    """Parses page range string ('all', '1-5', '1, 3, 5') into page count."""
    if not page_range or page_range.strip().lower() == "all":
        return max(1, total_doc_pages)

    clean = page_range.strip()
    # Check range like "1-5"
    range_match = re.match(r"^(\d+)\s*-\s*(\d+)$", clean)
    if range_match:
        start, end = int(range_match.group(1)), int(range_match.group(2))
        if 1 <= start <= end:
            return end - start + 1
        elif start > end:
            return 1

    # Check comma-separated list like "1, 3, 5"
    if "," in clean:
        parts = [p.strip() for p in clean.split(",") if p.strip().isdigit()]
        if parts:
            return len(parts)

    # Single number like "4"
    if clean.isdigit():
        return 1

    return max(1, total_doc_pages)


class PaymentService:
    def __init__(self, db: Session):
        self.db = db
        self.req_repo = PrintRequestRepository(db)
        self.audit_repo = AuditRepository(db)
        self.notif_repo = NotificationRepository(db)
        self.storage_base = Path(settings.STORAGE_DIR).resolve()

    def get_rates(self) -> PaymentRateInfo:
        return PaymentRateInfo(
            bw_rate_per_page=RATE_BW_PER_PAGE,
            color_rate_per_page=RATE_COLOR_PER_PAGE,
            currency=CURRENCY,
            currency_symbol=CURRENCY_SYMBOL
        )

    def get_document_page_count(self, doc: Document) -> int:
        """Reads PDF file from storage to extract real page count, default 1."""
        try:
            target_path = (self.storage_base / doc.storage_key).resolve()
            if target_path.exists():
                with open(target_path, "rb") as f:
                    content = f.read()
                    return extract_pdf_page_count(content)
        except Exception:
            pass
        return 1

    def calculate_pricing(
        self,
        page_range: str,
        copies: int,
        color_mode: str,
        duplex: str,
        document_pages: int = 1
    ) -> Tuple[int, float, float]:
        """
        Returns (total_pages, rate_per_page, total_amount).
        total_pages = sheets_in_range * copies
        """
        sheets_in_range = parse_page_range_count(page_range, document_pages)
        total_pages = max(1, sheets_in_range * max(1, copies))
        
        is_color = color_mode.lower() == "color"
        rate = RATE_COLOR_PER_PAGE if is_color else RATE_BW_PER_PAGE
        
        total_amount = round(total_pages * rate, 2)
        total_amount = max(0.10, total_amount)
        return total_pages, rate, total_amount

    def create_payment_for_request(
        self,
        req: PrintRequest,
        doc: Optional[Document] = None
    ) -> Payment:
        """Initializes a new UNPAID payment record for a newly submitted print request."""
        doc_pages = self.get_document_page_count(doc) if doc else 1
        total_pages, rate, total_amount = self.calculate_pricing(
            page_range=req.page_range,
            copies=req.copies,
            color_mode=req.color_mode.value if hasattr(req.color_mode, "value") else str(req.color_mode),
            duplex=req.duplex.value if hasattr(req.duplex, "value") else str(req.duplex),
            document_pages=doc_pages
        )

        payment = Payment(
            request_id=req.id,
            student_id=req.student_id,
            amount=total_amount,
            currency=CURRENCY,
            rate_per_page=rate,
            total_pages=total_pages,
            status=PaymentStatus.UNPAID,
            gateway_provider="PrintEasy Campus Gateway"
        )
        self.db.add(payment)
        return payment

    def process_payment(
        self,
        student: User,
        data: PaymentProcessRequest,
        ip_address: Optional[str] = None
    ) -> Payment:
        """
        Processes a student payment via Campus Gateway (Card, UPI, Campus Wallet).
        Validates payment data, confirms transaction, updates state, and emits notification.
        """
        req = self.db.query(PrintRequest).filter(PrintRequest.id == data.request_id).first()
        if not req:
            raise ResourceNotFoundError("Print request not found.")

        # IDOR check: student must own the print request
        if student.role == UserRole.STUDENT and req.student_id != student.id:
            raise UnauthorizedAccessError("Access denied: You cannot pay for another student's print job.")

        payment = self.db.query(Payment).filter(Payment.request_id == req.id).first()
        if not payment:
            # Fallback if payment record was missing
            payment = self.create_payment_for_request(req, req.document)
            self.db.flush()

        if payment.status == PaymentStatus.COMPLETED:
            raise DomainException("Payment has already been completed for this print request.")

        # Validate payment method inputs
        method = (data.payment_method or "card").lower()
        if method == "card":
            card_num = (data.card_number or "").replace(" ", "").replace("-", "")
            if len(card_num) < 12:
                raise DomainException("Invalid card number: Please enter a valid 16-digit card number.")
            if not data.card_expiry or "/" not in data.card_expiry:
                raise DomainException("Invalid expiration date: Use MM/YY format.")
            if not data.card_cvv or len(data.card_cvv.strip()) < 3:
                raise DomainException("Invalid security code (CVV).")
            last4 = card_num[-4:]
            payment_meta = f"Card: •••• {last4} ({data.card_holder or 'Student'})"
        elif method == "upi":
            upi_id = (data.upi_id or "").strip()
            if not upi_id or "@" not in upi_id:
                raise DomainException("Invalid UPI ID: format must be username@provider (e.g., student@okcampus).")
            payment_meta = f"UPI ID: {upi_id}"
        elif method == "campus_wallet":
            campus_id = (data.campus_id or "").strip()
            if not campus_id:
                raise DomainException("Campus ID / Student Card number is required.")
            payment_meta = f"Campus Wallet: {campus_id}"
        elif method == "cash":
            payment_meta = "Cash at counter"
        else:
            raise DomainException(f"Unsupported payment method: {data.payment_method}")

        # Generate cryptographic transaction ID and human-readable receipt reference
        now = datetime.now()
        txn_id = f"TXN-PE-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
        receipt_ref = f"RCPT-{now.strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"

        payment.status = PaymentStatus.COMPLETED
        payment.payment_method = method
        payment.transaction_id = txn_id
        payment.receipt_reference = receipt_ref
        payment.payment_metadata = payment_meta
        payment.paid_at = datetime.now()

        # Audit log event
        self.audit_repo.log_event(
            action="PAYMENT_COMPLETED",
            entity_type="payment",
            user_id=student.id,
            entity_id=str(payment.id),
            ip_address=ip_address,
            details={
                "request_id": str(req.id),
                "amount": payment.amount,
                "currency": payment.currency,
                "payment_method": method,
                "transaction_id": txn_id,
                "total_pages": payment.total_pages
            }
        )

        # Notify student
        doc_name = req.document.file_name if req.document else "Document"
        notif = Notification(
            user_id=req.student_id,
            request_id=req.id,
            message=f"Payment of {payment.currency} ${payment.amount:.2f} confirmed for '{doc_name}'. Ref: {txn_id}.",
            is_read=False
        )
        self.notif_repo.create(notif)

        self.db.commit()
        self.db.refresh(payment)
        return payment

    def staff_confirm_payment(
        self,
        staff: User,
        data: StaffPaymentConfirmRequest,
        ip_address: Optional[str] = None
    ) -> Payment:
        """Staff verifies and records payment at counter or terminal."""
        if staff.role not in [UserRole.STAFF, UserRole.ADMIN]:
            raise UnauthorizedAccessError("Only staff operators and administrators can confirm in-person payments.")

        req = self.db.query(PrintRequest).filter(PrintRequest.id == data.request_id).first()
        if not req:
            raise ResourceNotFoundError("Print request not found.")

        payment = self.db.query(Payment).filter(Payment.request_id == req.id).first()
        if not payment:
            payment = self.create_payment_for_request(req, req.document)
            self.db.flush()

        if payment.status == PaymentStatus.COMPLETED:
            return payment

        now = datetime.now()
        txn_id = f"TXN-STAFF-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
        receipt_ref = f"RCPT-COUNTER-{now.strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"

        payment.status = PaymentStatus.COMPLETED
        payment.payment_method = data.payment_method or "cash"
        payment.staff_id = staff.id
        payment.transaction_id = txn_id
        payment.receipt_reference = receipt_ref
        payment.payment_metadata = data.notes or f"Collected at print center counter by Staff {staff.name}"
        payment.paid_at = datetime.now()

        # Audit log event
        self.audit_repo.log_event(
            action="STAFF_PAYMENT_COLLECTED",
            entity_type="payment",
            user_id=staff.id,
            entity_id=str(payment.id),
            ip_address=ip_address,
            details={
                "request_id": str(req.id),
                "amount": payment.amount,
                "staff_name": staff.name,
                "payment_method": payment.payment_method,
                "transaction_id": txn_id
            }
        )

        # Notify student
        doc_name = req.document.file_name if req.document else "Document"
        notif = Notification(
            user_id=req.student_id,
            request_id=req.id,
            message=f"Payment of ${payment.amount:.2f} confirmed at counter by Staff {staff.name} for '{doc_name}'.",
            is_read=False
        )
        self.notif_repo.create(notif)

        self.db.commit()
        self.db.refresh(payment)
        return payment

    def get_receipt(self, request_id: uuid.UUID, user: User) -> PaymentReceiptResponse:
        """Retrieves verified payment receipt for a print request."""
        req = self.db.query(PrintRequest).filter(PrintRequest.id == request_id).first()
        if not req:
            raise ResourceNotFoundError("Print request not found.")

        # IDOR check
        if user.role == UserRole.STUDENT and req.student_id != user.id:
            raise UnauthorizedAccessError("Access denied: You cannot view this receipt.")

        payment = self.db.query(Payment).filter(Payment.request_id == req.id).first()
        if not payment or payment.status != PaymentStatus.COMPLETED:
            raise DomainException("Payment has not been completed for this request.")

        staff_name = None
        if payment.staff_id:
            staff_user = self.db.query(User).filter(User.id == payment.staff_id).first()
            if staff_user:
                staff_name = staff_user.name

        student_user = self.db.query(User).filter(User.id == req.student_id).first()

        return PaymentReceiptResponse(
            receipt_number=payment.receipt_reference or f"RCPT-{payment.id.hex[:8].upper()}",
            transaction_id=payment.transaction_id or f"TXN-{payment.id.hex[:10].upper()}",
            paid_at=payment.paid_at or payment.created_at,
            amount=payment.amount,
            currency=payment.currency,
            status=payment.status.value,
            payment_method=payment.payment_method or "card",
            gateway_provider=payment.gateway_provider,
            student_name=student_user.name if student_user else "Student",
            student_email=student_user.email if student_user else "",
            document_name=req.document.file_name if req.document else "Document.pdf",
            copies=req.copies,
            color_mode="Color" if (req.color_mode.value if hasattr(req.color_mode, "value") else req.color_mode) == "color" else "B&W",
            duplex="Double-sided" if (req.duplex.value if hasattr(req.duplex, "value") else req.duplex) == "double" else "Single-sided",
            page_range=req.page_range,
            total_pages=payment.total_pages,
            rate_per_page=payment.rate_per_page,
            staff_receiver_name=staff_name
        )
