import uuid
from typing import Optional, List, Dict
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.repositories.base import BaseRepository
from app.models.print_request import PrintRequest, RequestStatus
from app.models.status_history import StatusHistory
from app.models.print_settings import PrintSettings


class PrintRequestRepository(BaseRepository[PrintRequest]):
    def __init__(self, db: Session):
        super().__init__(PrintRequest, db)

    def get_by_id_with_relations(self, request_id: uuid.UUID) -> Optional[PrintRequest]:
        return (
            self.db.query(PrintRequest)
            .options(
                joinedload(PrintRequest.student),
                joinedload(PrintRequest.document),
                joinedload(PrintRequest.settings),
                joinedload(PrintRequest.status_history)
            )
            .filter(PrintRequest.id == request_id)
            .first()
        )

    def get_for_update(self, request_id: uuid.UUID) -> Optional[PrintRequest]:
        query = self.db.query(PrintRequest).filter(PrintRequest.id == request_id)
        # with_for_update is supported on PostgreSQL, gracefully skipped if dialect is sqlite
        bind = self.db.get_bind()
        if bind and bind.dialect.name == "postgresql":
            query = query.with_for_update()
        return query.first()

    def get_student_requests(
        self,
        student_id: uuid.UUID,
        status: Optional[RequestStatus] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[PrintRequest]:
        query = (
            self.db.query(PrintRequest)
            .options(
                joinedload(PrintRequest.student),
                joinedload(PrintRequest.document),
                joinedload(PrintRequest.settings)
            )
            .filter(PrintRequest.student_id == student_id)
        )
        if status:
            query = query.filter(PrintRequest.status == status)
        return query.order_by(PrintRequest.created_at.desc()).offset(skip).limit(limit).all()

    def get_queue(
        self,
        status: Optional[RequestStatus] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[PrintRequest]:
        query = (
            self.db.query(PrintRequest)
            .options(
                joinedload(PrintRequest.student),
                joinedload(PrintRequest.document),
                joinedload(PrintRequest.settings)
            )
        )
        if status:
            query = query.filter(PrintRequest.status == status)
        return query.order_by(PrintRequest.created_at.asc()).offset(skip).limit(limit).all()

    def add_status_history(
        self,
        request_id: uuid.UUID,
        old_status: str,
        new_status: str,
        changed_by: Optional[uuid.UUID] = None,
        comment: Optional[str] = None
    ) -> StatusHistory:
        history = StatusHistory(
            request_id=request_id,
            changed_by=changed_by,
            old_status=old_status,
            new_status=new_status,
            comment=comment
        )
        self.db.add(history)
        self.db.flush()
        return history

    def add_print_settings(self, settings: PrintSettings) -> PrintSettings:
        self.db.add(settings)
        self.db.flush()
        return settings

    def count_by_status(self) -> Dict[str, int]:
        results = (
            self.db.query(PrintRequest.status, func.count(PrintRequest.id))
            .group_by(PrintRequest.status)
            .all()
        )
        counts = {s.value: 0 for s in RequestStatus}
        for st, count in results:
            counts[st.value] = count
        return counts

    def total_copies(self) -> int:
        total = self.db.query(func.sum(PrintRequest.copies)).scalar()
        return total or 0
