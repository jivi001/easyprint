import uuid
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, Request, status, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.document_service import DocumentService
from app.services.payment_service import PaymentService
from app.schemas.document import DocumentResponse, DocumentUploadResponse
from app.core.exceptions import (
    DocumentValidationError,
    ResourceNotFoundError,
    UnauthorizedAccessError,
)

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    file: UploadFile = File(...),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Securely upload a PDF document.
    Validates magic bytes, file size (<=10MB), and isolates file in private storage.
    """
    ip_address = request.client.host if request and request.client else None
    service = DocumentService(db)
    try:
        doc = service.upload_document(current_user, file, ip_address=ip_address)
        return DocumentUploadResponse(
            id=doc.id,
            file_name=doc.file_name,
            file_size=doc.file_size,
            message="Document uploaded and validated successfully."
        )
    except DocumentValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": e.message, "code": "INVALID_DOCUMENT"}
        )


@router.get("", response_model=List[DocumentResponse])
def list_user_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List documents uploaded by the authenticated user."""
    service = DocumentService(db)
    docs = service.doc_repo.get_user_documents(current_user.id)
    return [DocumentResponse.model_validate(d) for d in docs]


@router.get("/{id}")
def download_document(
    id: uuid.UUID,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Authorized document download.
    Enforces IDOR checks: students may only access their own documents;
    staff and admin may access documents to service print requests.
    """
    ip_address = request.client.host if request and request.client else None
    service = DocumentService(db)
    try:
        doc, file_path = service.get_document_for_download(id, current_user, ip_address=ip_address)
        return FileResponse(
            path=file_path,
            filename=doc.file_name,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{doc.file_name}"',
                "X-Content-Type-Options": "nosniff"
            }
        )
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except UnauthorizedAccessError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)


@router.get("/{id}/page-count")
def get_document_page_count(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns how many pages this document has.
    Enforces IDOR checks so students only query page count of their documents.
    """
    doc_service = DocumentService(db)
    doc = doc_service.doc_repo.get_by_id(id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    if hasattr(current_user.role, "value") and current_user.role.value == "STUDENT" and doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    pay_service = PaymentService(db)
    page_count = pay_service.count_document_pages(doc)
    return {
        "document_id": doc.id,
        "file_name": doc.file_name,
        "page_count": page_count
    }
