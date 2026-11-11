from typing import Optional, Any
from fastapi import HTTPException, status


class DomainException(Exception):
    """Base exception for application business domain failures."""
    def __init__(self, message: str, code: Optional[str] = None):
        self.message = message
        self.code = code
        super().__init__(message)


class InvalidStateTransitionError(DomainException):
    """Raised when an illegal workflow state transition is attempted."""
    pass


class DocumentValidationError(DomainException):
    """Raised when an uploaded document fails integrity or security checks."""
    pass


class ResourceNotFoundError(DomainException):
    """Raised when an entity is not found or not accessible."""
    pass


class UnauthorizedAccessError(DomainException):
    """Raised when an actor lacks access privileges (IDOR protection)."""
    pass


def http_error(status_code: int, message: str, code: Optional[str] = None) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"message": message, "code": code or "ERROR"}
    )
