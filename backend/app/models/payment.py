import uuid
import enum
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Integer, Float, Enum, ForeignKey, DateTime, Uuid, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, utc_now

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.print_request import PrintRequest


class PaymentStatus(str, enum.Enum):
    UNPAID = "UNPAID"
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class PaymentMethod(str, enum.Enum):
    CARD = "card"
    UPI = "upi"
    CAMPUS_WALLET = "campus_wallet"
    CASH = "cash"


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"

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
    student_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    rate_per_page: Mapped[float] = mapped_column(Float, nullable=False)
    total_pages: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status", native_enum=False),
        default=PaymentStatus.UNPAID,
        nullable=False,
        index=True
    )
    payment_method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    transaction_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, unique=True, index=True)
    gateway_provider: Mapped[str] = mapped_column(String(100), default="PrintEasy Campus Gateway", nullable=False)
    receipt_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    payment_metadata: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    request: Mapped["PrintRequest"] = relationship("PrintRequest", back_populates="payment")
    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])
    staff: Mapped[Optional["User"]] = relationship("User", foreign_keys=[staff_id])
