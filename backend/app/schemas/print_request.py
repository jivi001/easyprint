import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.print_request import RequestStatus, ColorMode, DuplexMode


class PrintSettingsSchema(BaseModel):
    page_range: str = Field(default="all", max_length=50)
    copies: int = Field(default=1, ge=1, le=100)
    color: str = Field(default="bw")
    duplex: str = Field(default="single")
    orientation: str = Field(default="portrait")
    paper_size: str = Field(default="A4")

    class Config:
        from_attributes = True


class PrintRequestCreate(BaseModel):
    document_id: uuid.UUID
    copies: int = Field(default=1, ge=1, le=100)
    color_mode: ColorMode = ColorMode.BW
    duplex: DuplexMode = DuplexMode.SINGLE
    page_range: str = Field(default="all", max_length=50)
    orientation: Optional[str] = "portrait"
    paper_size: Optional[str] = "A4"


class StatusHistoryResponse(BaseModel):
    id: uuid.UUID
    old_status: str
    new_status: str
    comment: Optional[str] = None
    changed_by_name: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class PrintRequestResponse(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    document_id: uuid.UUID
    document_name: Optional[str] = None
    file_size: Optional[int] = None
    status: RequestStatus
    copies: int
    color_mode: ColorMode
    duplex: DuplexMode
    page_range: str
    created_at: datetime
    updated_at: datetime
    # Payment fields
    payment_status: Optional[str] = "UNPAID"
    total_amount: Optional[float] = 0.0
    currency: Optional[str] = "INR"
    rate_per_page: Optional[float] = 3.00
    total_pages: Optional[int] = 1
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    paid_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PrintRequestDetailResponse(PrintRequestResponse):
    settings: Optional[PrintSettingsSchema] = None
    status_history: List[StatusHistoryResponse] = []


class StatusUpdateSchema(BaseModel):
    status: RequestStatus
    comment: Optional[str] = Field(default=None, max_length=255)
