from fastapi import APIRouter, Depends, Request, status, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.auth_service import AuthService
from app.schemas.user import UserRegister, UserLogin, TokenResponse, UserResponse
from app.core.exceptions import DomainException

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    data: UserRegister,
    request: Request,
    db: Session = Depends(get_db)
):
    """Register a new student account or staff account."""
    ip_address = request.client.host if request.client else None
    service = AuthService(db)
    try:
        return service.register(data, ip_address=ip_address)
    except DomainException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": e.message, "code": e.code or "REGISTRATION_ERROR"}
        )


@router.post("/login", response_model=TokenResponse)
def login(
    data: UserLogin,
    request: Request,
    db: Session = Depends(get_db)
):
    """Authenticate and obtain a JWT access token."""
    ip_address = request.client.host if request.client else None
    service = AuthService(db)
    try:
        return service.login(data, ip_address=ip_address)
    except DomainException as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": e.message, "code": e.code or "AUTH_ERROR"}
        )
