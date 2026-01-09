import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class DaySummary(Base):
    __tablename__ = "day_summaries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(
        String, ForeignKey("users.username", ondelete="CASCADE"), nullable=False
    )
    day_date: Mapped[date] = mapped_column(Date, nullable=False)
    timer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("timers.id", ondelete="CASCADE"), nullable=False
    )
    total_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "username",
            "day_date",
            "timer_id",
            name="uq_day_summaries_username_day_timer",
        ),
        CheckConstraint("total_seconds >= 0", name="ck_day_summaries_total_nonnegative"),
        Index("ix_day_summaries_username_day_date", "username", "day_date"),
        Index(
            "ix_day_summaries_username_timer_day_date",
            "username",
            "timer_id",
            "day_date",
        ),
    )
