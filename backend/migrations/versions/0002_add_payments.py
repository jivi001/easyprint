"""Add payments table

Revision ID: 0002_add_payments
Revises: 0001_initial_schema
Create Date: 2026-11-13 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "0002_add_payments"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("request_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("student_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("staff_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="USD"),
        sa.Column("rate_per_page", sa.Float(), nullable=False),
        sa.Column("total_pages", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="UNPAID"),
        sa.Column("payment_method", sa.String(length=50), nullable=True),
        sa.Column("transaction_id", sa.String(length=100), nullable=True),
        sa.Column("gateway_provider", sa.String(length=100), nullable=False, server_default="PrintEasy Campus Gateway"),
        sa.Column("receipt_reference", sa.String(length=100), nullable=True),
        sa.Column("payment_metadata", sa.Text(), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["request_id"], ["print_requests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["staff_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("request_id"),
        sa.UniqueConstraint("transaction_id")
    )
    op.create_index("ix_payments_request_id", "payments", ["request_id"])
    op.create_index("ix_payments_student_id", "payments", ["student_id"])
    op.create_index("ix_payments_staff_id", "payments", ["staff_id"])
    op.create_index("ix_payments_status", "payments", ["status"])
    op.create_index("ix_payments_transaction_id", "payments", ["transaction_id"])


def downgrade() -> None:
    op.drop_index("ix_payments_transaction_id", table_name="payments")
    op.drop_index("ix_payments_status", table_name="payments")
    op.drop_index("ix_payments_staff_id", table_name="payments")
    op.drop_index("ix_payments_student_id", table_name="payments")
    op.drop_index("ix_payments_request_id", table_name="payments")
    op.drop_table("payments")
