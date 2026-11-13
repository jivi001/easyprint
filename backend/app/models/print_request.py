import uuid
import enum
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import String, Integer, Enum, ForeignKey, DateTime, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, utc_now

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.document import Document
    from app.models.print_settings import PrintSettings
    from app.models.status_history import StatusHistory
    from app.models.notification import Notification
    from app.models.payment import Payment


class RequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    READY = "READY"
    COLLECTED = "COLLECTED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class ColorMode(str, enum.Enum):
    BW = "bw"
    COLOR = "color"


class DuplexMode(str, enum.Enum):
    SINGLE = "single"
    DOUBLE = "double"


class PrintRequest(Base, TimestampMixin):
    __tablename__ = "print_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("documents.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus, name="request_status", native_enum=False),
        default=RequestStatus.PENDING,
        nullable=False,
        index=True
    )
    copies: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    color_mode: Mapped[ColorMode] = mapped_column(
        Enum(ColorMode, name="color_mode", native_enum=False),
        default=ColorMode.BW,
        nullable=False
    )
    duplex: Mapped[DuplexMode] = mapped_column(
        Enum(DuplexMode, name="duplex_mode", native_enum=False),
        default=DuplexMode.SINGLE,
        nullable=False
    )
    page_range: Mapped[str] = mapped_column(String(50), default="all", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False
    )

    # Relationships
    student: Mapped["User"] = relationship("User", back_populates="print_requests")
    document: Mapped["Document"] = relationship("Document", back_populates="print_requests")
    settings: Mapped[Optional["PrintSettings"]] = relationship(
        "PrintSettings",
        back_populates="request",
        uselist=False,
        cascade="all, delete-orphan"
    )
    status_history: Mapped[List["StatusHistory"]] = relationship(
        "StatusHistory",
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="StatusHistory.timestamp.asc()"
    )
    notifications: Mapped[List["Notification"]] = relationship(
        "Notification",
        back_populates="request",
        cascade="all, delete-orphan"
    )
    payment: Mapped[Optional["Payment"]] = relationship(
        "Payment",
        back_populates="request",
        uselist=False,
        cascade="all, delete-orphan"
    )
