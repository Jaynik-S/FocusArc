from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String, primary_key=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    study_revision: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0", nullable=False)
    study_timezone: Mapped[str] = mapped_column(String(64), default="America/Toronto", server_default="America/Toronto", nullable=False)
    study_last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "char_length(username) BETWEEN 1 AND 32",
            name="ck_users_username_len",
        ),
    )
