import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Request, status, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.print_request import RequestStatus
from app.services.workflow_service import WorkflowService
from app.schemas.print_request import (
    PrintRequestCreate,
    PrintRequestResponse,
    PrintRequestDetailResponse,
    StatusUpdateSchema,
    StatusHistoryResponse,
    PrintSettingsSchema,
)
from app.core.exceptions import (
    InvalidStateTransitionError,
    ResourceNotFoundError,
    UnauthorizedAccessError,
    DomainException,
)

router = APIRouter(prefix="/print-requests", tags=["Print Requests"])


def _to_response_dto(req) -> PrintRequestResponse:
    pay = getattr(req, "payment", None)
    return PrintRequestResponse(
        id=req.id,
        student_id=req.student_id,
        student_name=req.student.name if req.student else None,
        student_email=req.student.email if req.student else None,
        document_id=req.document_id,
        document_name=req.document.file_name if req.document else None,
        file_size=req.document.file_size if req.document else None,
        status=req.status,
        copies=req.copies,
        color_mode=req.color_mode,
        duplex=req.duplex,
        page_range=req.page_range,
        created_at=req.created_at,
        updated_at=req.updated_at,
        payment_status=pay.status.value if pay else "UNPAID",
        total_amount=pay.amount if pay else 0.0,
        currency=pay.currency if pay else "USD",
        rate_per_page=pay.rate_per_page if pay else (0.50 if req.color_mode == "color" else 0.10),
        total_pages=pay.total_pages if pay else req.copies,
        payment_method=pay.payment_method if pay else None,
        transaction_id=pay.transaction_id if pay else None,
        paid_at=pay.paid_at if pay else None,
    )


def _to_detail_dto(req) -> PrintRequestDetailResponse:
    base = _to_response_dto(req)
    settings_dto = None
    if req.settings:
        settings_dto = PrintSettingsSchema(
            page_range=req.settings.page_range,
            copies=req.settings.copies,
            color=req.settings.color,
            duplex=req.settings.duplex,
            orientation=req.settings.orientation,
            paper_size=req.settings.paper_size
        )
    
    history_dtos = []
    for h in req.status_history:
        history_dtos.append(
            StatusHistoryResponse(
                id=h.id,
                old_status=h.old_status,
                new_status=h.new_status,
                comment=h.comment,
                changed_by_name=h.actor.name if h.actor else "System",
                timestamp=h.timestamp
            )
        )

    return PrintRequestDetailResponse(
        **base.model_dump(),
        settings=settings_dto,
        status_history=history_dtos
    )


@router.post("", response_model=PrintRequestDetailResponse, status_code=status.HTTP_201_CREATED)
def submit_print_request(
    data: PrintRequestCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submit a new print request for an uploaded PDF.
    Initializes status to PENDING and registers print settings.
    """
    ip_address = request.client.host if request.client else None
    service = WorkflowService(db)
    try:
        req = service.create_print_request(current_user, data, ip_address=ip_address)
        return _to_detail_dto(req)
    except (ResourceNotFoundError, UnauthorizedAccessError, DomainException) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": str(e), "code": getattr(e, "code", "REQUEST_ERROR")}
        )


@router.get("", response_model=List[PrintRequestResponse])
def list_print_requests(
    status_filter: Optional[RequestStatus] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List print requests:
    - Students see only their own requests.
    - Staff and Admin see the full queue.
    """
    service = WorkflowService(db)
    requests = service.list_requests(
        user=current_user,
        status=status_filter,
        skip=skip,
        limit=limit
    )
    return [_to_response_dto(r) for r in requests]


@router.get("/{id}", response_model=PrintRequestDetailResponse)
def get_print_request(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve details of a print request including settings and full status history.
    Enforces student isolation (IDOR protection).
    """
    service = WorkflowService(db)
    try:
        req = service.get_request_details(id, current_user)
        return _to_detail_dto(req)
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except UnauthorizedAccessError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)


@router.patch("/{id}/status", response_model=PrintRequestDetailResponse)
def update_print_request_status(
    id: uuid.UUID,
    data: StatusUpdateSchema,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update request status.
    Enforces valid state transitions:
    - PENDING -> PROCESSING -> READY -> COLLECTED
    - PENDING -> CANCELLED (student owner or staff)
    - PROCESSING -> FAILED (staff)
    Automatically notifies the student on state changes.
    """
    ip_address = request.client.host if request.client else None
    service = WorkflowService(db)
    try:
        req = service.update_request_status(id, current_user, data, ip_address=ip_address)
        return _to_detail_dto(req)
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except UnauthorizedAccessError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except InvalidStateTransitionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": e.message, "code": "INVALID_STATE_TRANSITION"}
        )
