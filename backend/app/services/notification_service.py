import uuid
from typing import List, Tuple
from sqlalchemy.orm import Session
from app.repositories.notification_repository import NotificationRepository
from app.models.notification import Notification
from app.models.user import User
from app.core.exceptions import ResourceNotFoundError


class NotificationService:
    def __init__(self, db: Session):
        self.db = db
        self.notif_repo = NotificationRepository(db)

    def get_user_notifications(
        self,
        user: User,
        unread_only: bool = False,
        skip: int = 0,
        limit: int = 50
    ) -> Tuple[List[Notification], int]:
        notifications = self.notif_repo.get_user_notifications(
            user_id=user.id,
            unread_only=unread_only,
            skip=skip,
            limit=limit
        )
        unread_count = self.notif_repo.count_unread(user.id)
        return notifications, unread_count

    def mark_notification_read(self, notification_id: uuid.UUID, user: User) -> Notification:
        notif = self.notif_repo.mark_as_read(notification_id, user.id)
        if not notif:
            raise ResourceNotFoundError("Notification not found or access denied.")
        self.db.commit()
        return notif

    def mark_all_read(self, user: User) -> int:
        count = self.notif_repo.mark_all_as_read(user.id)
        self.db.commit()
        return count
