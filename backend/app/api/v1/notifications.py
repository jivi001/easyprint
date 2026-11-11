import uuid
from typing import List
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.notification_service import NotificationService
from app.schemas.notification import NotificationResponse, NotificationListResponse
from app.core.exceptions import ResourceNotFoundError

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationListResponse)
def get_notifications(
    unread_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve user in-app notifications and unread count."""
    service = NotificationService(db)
    items, unread_count = service.get_user_notifications(
        user=current_user,
        unread_only=unread_only,
        skip=skip,
        limit=limit
    )
    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(n) for n in items],
        unread_count=unread_count
    )


@router.patch("/{id}/read", response_model=NotificationResponse)
def mark_notification_read(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a notification as read."""
    service = NotificationService(db)
    try:
        notif = service.mark_notification_read(id, current_user)
        return NotificationResponse.model_validate(notif)
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)


@router.post("/read-all", status_code=status.HTTP_200_OK)
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all unread notifications as read for current user."""
    service = NotificationService(db)
    count = service.mark_all_read(current_user)
    return {"message": f"Marked {count} notifications as read."}
