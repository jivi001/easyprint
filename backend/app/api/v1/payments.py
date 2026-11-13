import uuid
from fastapi import APIRouter, Depends, Request, status, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.payment import Payment
from app.services.payment_service import PaymentService, CURRENCY, CURRENCY_SYMBOL
from app.schemas.payment import (
    PaymentRateInfo,
    PaymentCalculateRequest,
    PaymentCalculateResponse,
    PaymentProcessRequest,
    StaffPaymentConfirmRequest,
    PaymentResponse,
    PaymentReceiptResponse,
)
from app.core.exceptions import (
    ResourceNotFoundError,
    UnauthorizedAccessError,
    DomainException,
)

router = APIRouter(prefix="/payments", tags=["Payments"])


def _to_payment_dto(p: Payment) -> PaymentResponse:
    return PaymentResponse(
        id=p.id,
        request_id=p.request_id,
        student_id=p.student_id,
        student_name=p.student.name if p.student else None,
        staff_id=p.staff_id,
        staff_name=p.staff.name if p.staff else None,
        amount=p.amount,
        currency=p.currency,
        rate_per_page=p.rate_per_page,
        total_pages=p.total_pages,
        status=p.status,
        payment_method=p.payment_method,
        transaction_id=p.transaction_id,
        gateway_provider=p.gateway_provider,
        receipt_reference=p.receipt_reference,
        paid_at=p.paid_at,
        created_at=p.created_at
    )


@router.get("/rates", response_model=PaymentRateInfo)
def get_payment_rates(
    db: Session = Depends(get_db)
):
    """Returns current college print rates per page (B&W and Color)."""
    service = PaymentService(db)
    return service.get_rates()


@router.post("/calculate", response_model=PaymentCalculateResponse)
def calculate_price(
    data: PaymentCalculateRequest,
    db: Session = Depends(get_db)
):
    """
    Calculates total pages and pricing for print configuration before submission.
    """
    service = PaymentService(db)
    doc_pages = 1
    if data.document_id:
        from app.models.document import Document
        doc = db.query(Document).filter(Document.id == data.document_id).first()
        if doc:
            doc_pages = service.get_document_page_count(doc)

    total_pages, rate, total_amount = service.calculate_pricing(
        page_range=data.page_range,
        copies=data.copies,
        color_mode=data.color_mode,
        duplex=data.duplex,
        document_pages=doc_pages
    )
    return PaymentCalculateResponse(
        total_pages=total_pages,
        rate_per_page=rate,
        subtotal=total_amount,
        total_amount=total_amount,
        currency=CURRENCY,
        currency_symbol=CURRENCY_SYMBOL
    )


@router.post("/process", response_model=PaymentResponse)
def process_payment(
    data: PaymentProcessRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Processes student payment for a print request via Campus Gateway.
    Accepts Card, UPI, or Campus Wallet.
    """
    ip_address = request.client.host if request.client else None
    service = PaymentService(db)
    try:
        payment = service.process_payment(current_user, data, ip_address=ip_address)
        return _to_payment_dto(payment)
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except UnauthorizedAccessError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except DomainException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)


@router.post("/staff-confirm", response_model=PaymentResponse)
def staff_confirm_payment(
    data: StaffPaymentConfirmRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Staff operator verifies and records counter payment (cash, campus kiosk terminal).
    """
    ip_address = request.client.host if request.client else None
    service = PaymentService(db)
    try:
        payment = service.staff_confirm_payment(current_user, data, ip_address=ip_address)
        return _to_payment_dto(payment)
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except UnauthorizedAccessError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except DomainException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)


@router.get("/request/{request_id}", response_model=PaymentResponse)
def get_payment_by_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves payment details for a specific print request."""
    from app.models.print_request import PrintRequest
    req = db.query(PrintRequest).filter(PrintRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Print request not found.")

    if current_user.role == "student" and req.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    payment = db.query(Payment).filter(Payment.request_id == request_id).first()
    if not payment:
        service = PaymentService(db)
        payment = service.create_payment_for_request(req, req.document)
        db.commit()
        db.refresh(payment)

    return _to_payment_dto(payment)


@router.get("/receipt/{request_id}", response_model=PaymentReceiptResponse)
def get_payment_receipt(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generates an itemized receipt for a completed payment."""
    service = PaymentService(db)
    try:
        return service.get_receipt(request_id, current_user)
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except UnauthorizedAccessError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except DomainException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)


@router.post("/recalculate/{request_id}", response_model=PaymentResponse)
def recalculate_and_update_request_cost(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Counts pages in the document for the print request, calculates the price after the count,
    and updates the payment record cost in the database based on the output pages.
    """
    service = PaymentService(db)
    try:
        payment = service.update_request_cost_from_document(request_id)
        return _to_payment_dto(payment)
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
