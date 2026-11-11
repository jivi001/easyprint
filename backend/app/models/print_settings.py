import uuid
from typing import TYPE_CHECKING
from sqlalchemy import String, Integer, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.print_request import PrintRequest


class PrintSettings(Base):
    __tablename__ = "print_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    request_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("print_requests.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )
    page_range: Mapped[str] = mapped_column(String(50), default="all", nullable=False)
    copies: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="bw", nullable=False)
    duplex: Mapped[str] = mapped_column(String(20), default="single", nullable=False)
    orientation: Mapped[str] = mapped_column(String(20), default="portrait", nullable=False)
    paper_size: Mapped[str] = mapped_column(String(20), default="A4", nullable=False)

    # Relationships
    request: Mapped["PrintRequest"] = relationship("PrintRequest", back_populates="settings")
