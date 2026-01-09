import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(
        String, ForeignKey("users.username", ondelete="CASCADE"), nullable=False
    )
    timer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("timers.id", ondelete="CASCADE"), nullable=False
    )
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    client_tz: Mapped[str] = mapped_column(String, nullable=False)
    day_date: Mapped[date] = mapped_column(Date, nullable=False)
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "end_at IS NULL OR end_at >= start_at",
            name="ck_sessions_end_after_start",
        ),
        CheckConstraint(
            "duration_seconds IS NULL OR duration_seconds >= 0",
            name="ck_sessions_duration_nonnegative",
        ),
        Index(
            "ux_sessions_one_active_per_user",
            "username",
            unique=True,
            postgresql_where=sa.text("end_at IS NULL"),
        ),
        Index("ix_sessions_username_day_date", "username", "day_date"),
        Index("ix_sessions_username_timer_day_date", "username", "timer_id", "day_date"),
        Index("ix_sessions_username_start_at", "username", "start_at"),
    )
