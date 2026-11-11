import uuid
from typing import Optional, List
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.document import Document


class DocumentRepository(BaseRepository[Document]):
    def __init__(self, db: Session):
        super().__init__(Document, db)

    def get_user_documents(self, user_id: uuid.UUID, skip: int = 0, limit: int = 100) -> List[Document]:
        return (
            self.db.query(Document)
            .filter(Document.user_id == user_id)
            .order_by(Document.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_storage_key(self, storage_key: str) -> Optional[Document]:
        return self.db.query(Document).filter(Document.storage_key == storage_key).first()

    def get_by_hash(self, file_hash: str) -> Optional[Document]:
        return self.db.query(Document).filter(Document.file_hash == file_hash).first()

    def count_documents(self) -> int:
        return self.db.query(Document).count()
