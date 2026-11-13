import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.payment import PaymentStatus, PaymentMethod


class PaymentRateInfo(BaseModel):
    bw_rate_per_page: float = 3.00
    color_rate_per_page: float = 6.00
    currency: str = "INR"
    currency_symbol: str = "₹"


class PaymentCalculateRequest(BaseModel):
    page_range: str = Field(default="all", max_length=50)
    copies: int = Field(default=1, ge=1, le=100)
    color_mode: str = Field(default="bw")
    duplex: str = Field(default="single")
    document_id: Optional[uuid.UUID] = None


class PaymentCalculateResponse(BaseModel):
    total_pages: int
    rate_per_page: float
    subtotal: float
    total_amount: float
    currency: str = "INR"
    currency_symbol: str = "₹"


class PaymentProcessRequest(BaseModel):
    request_id: uuid.UUID
    payment_method: str = Field(default="card")
    card_number: Optional[str] = None
    card_expiry: Optional[str] = None
    card_cvv: Optional[str] = None
    card_holder: Optional[str] = None
    upi_id: Optional[str] = None
    campus_id: Optional[str] = None
    campus_pin: Optional[str] = None


class StaffPaymentConfirmRequest(BaseModel):
    request_id: uuid.UUID
    payment_method: str = Field(default="cash")
    notes: Optional[str] = Field(default=None, max_length=255)


class PaymentResponse(BaseModel):
    id: uuid.UUID
    request_id: uuid.UUID
    student_id: uuid.UUID
    student_name: Optional[str] = None
    staff_id: Optional[uuid.UUID] = None
    staff_name: Optional[str] = None
    amount: float
    currency: str
    rate_per_page: float
    total_pages: int
    status: PaymentStatus
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    gateway_provider: str
    receipt_reference: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PaymentReceiptResponse(BaseModel):
    receipt_number: str
    transaction_id: str
    paid_at: datetime
    amount: float
    currency: str
    status: str
    payment_method: str
    gateway_provider: str
    student_name: str
    student_email: str
    document_name: str
    copies: int
    color_mode: str
    duplex: str
    page_range: str
    total_pages: int
    rate_per_page: float
    staff_receiver_name: Optional[str] = None
