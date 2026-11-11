import uuid
import os
from pathlib import Path
from typing import Optional, Tuple, BinaryIO
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import (
    DocumentValidationError,
    ResourceNotFoundError,
    UnauthorizedAccessError,
)
from app.models.user import User, UserRole
from app.models.document import Document
from app.repositories.document_repository import DocumentRepository
from app.repositories.audit_repository import AuditRepository
from app.utils.pdf_validator import (
    validate_pdf_content,
    sanitize_filename,
    generate_storage_key,
)

settings = get_settings()


class DocumentService:
    def __init__(self, db: Session):
        self.db = db
        self.doc_repo = DocumentRepository(db)
        self.audit_repo = AuditRepository(db)
        self.storage_base = Path(settings.STORAGE_DIR).resolve()

    def upload_document(
        self,
        user: User,
        file: UploadFile,
        ip_address: Optional[str] = None
    ) -> Document:
        """
        Receives, validates and stores an uploaded PDF file safely.
        """
        if not file.filename:
            raise DocumentValidationError("No file name provided.")

        raw_filename = sanitize_filename(file.filename)
        
        # Read file contents securely into memory buffer
        content = file.file.read()
        
        # Enforce PDF validation (magic bytes, size, %%EOF, dangerous tokens)
        file_size, file_hash = validate_pdf_content(content)

        # Generate isolated storage key: {user_id}/{uuid}.pdf
        storage_key = generate_storage_key(str(user.id))
        target_path = (self.storage_base / storage_key).resolve()

        # Prevent path traversal: target must be inside storage_base
        if not str(target_path).startswith(str(self.storage_base)):
            raise DocumentValidationError("Path traversal violation detected.")

        target_path.parent.mkdir(parents=True, exist_ok=True)

        # Write file with strict POSIX permissions
        with open(target_path, "wb") as f:
            f.write(content)
        
        # 0600 file permissions: readable and writable only by owner process
        os.chmod(target_path, 0o600)

        # Save document metadata in PostgreSQL / DB
        doc = Document(
            user_id=user.id,
            storage_key=storage_key,
            file_name=raw_filename,
            file_size=file_size,
            mime_type="application/pdf",
            file_hash=file_hash
        )
        self.doc_repo.create(doc)
        self.db.commit()
        self.db.refresh(doc)

        self.audit_repo.log_event(
            action="DOCUMENT_UPLOAD",
            entity_type="document",
            user_id=user.id,
            entity_id=str(doc.id),
            ip_address=ip_address,
            details={"file_name": raw_filename, "file_size": file_size, "hash": file_hash}
        )
        self.db.commit()

        return doc

    def get_document_for_download(
        self,
        document_id: uuid.UUID,
        user: User,
        ip_address: Optional[str] = None
    ) -> Tuple[Document, Path]:
        """
        Authorizes access to document and returns (Document, Path).
        Rules:
        - Student: can only access their own documents (IDOR protection)
        - Staff / Admin: can access any document requested for printing
        """
        doc = self.doc_repo.get_by_id(document_id)
        if not doc:
            raise ResourceNotFoundError("Document not found.")

        # IDOR access check
        if user.role == UserRole.STUDENT and doc.user_id != user.id:
            self.audit_repo.log_event(
                action="IDOR_VIOLATION_ATTEMPT",
                entity_type="document",
                user_id=user.id,
                entity_id=str(document_id),
                ip_address=ip_address,
                details={"owner_id": str(doc.user_id)}
            )
            self.db.commit()
            raise UnauthorizedAccessError("Access denied: You do not own this document.")

        file_path = (self.storage_base / doc.storage_key).resolve()
        if not file_path.exists() or not str(file_path).startswith(str(self.storage_base)):
            raise ResourceNotFoundError("Underlying document file not found in storage.")

        self.audit_repo.log_event(
            action="DOCUMENT_DOWNLOAD",
            entity_type="document",
            user_id=user.id,
            entity_id=str(doc.id),
            ip_address=ip_address,
            details={"requester_role": user.role.value}
        )
        self.db.commit()

        return doc, file_path
