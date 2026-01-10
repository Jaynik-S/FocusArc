"""init schema

Revision ID: 0001_init_schema
Revises: 
Create Date: 2026-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0001_init_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("username", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "char_length(username) BETWEEN 1 AND 32",
            name="ck_users_username_len",
        ),
        sa.PrimaryKeyConstraint("username", name="pk_users"),
    )

    op.create_table(
        "timers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("color", sa.String(), nullable=False),
        sa.Column("icon", sa.String(), nullable=False),
        sa.Column(
            "is_archived",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "char_length(name) BETWEEN 1 AND 32",
            name="ck_timers_name_len",
        ),
        sa.ForeignKeyConstraint(
            ["username"],
            ["users.username"],
            ondelete="CASCADE",
            name="fk_timers_username_users",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_timers"),
        sa.UniqueConstraint("username", "name", name="uq_timers_username_name"),
    )
    op.create_index(
        "ix_timers_username_is_archived",
        "timers",
        ["username", "is_archived"],
    )

    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("timer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("client_tz", sa.String(), nullable=False),
        sa.Column("day_date", sa.Date(), nullable=False),
        sa.Column("day_of_week", sa.SmallInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "end_at IS NULL OR end_at >= start_at",
            name="ck_sessions_end_after_start",
        ),
        sa.CheckConstraint(
            "duration_seconds IS NULL OR duration_seconds >= 0",
            name="ck_sessions_duration_nonnegative",
        ),
        sa.ForeignKeyConstraint(
            ["username"],
            ["users.username"],
            ondelete="CASCADE",
            name="fk_sessions_username_users",
        ),
        sa.ForeignKeyConstraint(
            ["timer_id"],
            ["timers.id"],
            ondelete="CASCADE",
            name="fk_sessions_timer_id_timers",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_sessions"),
    )
    op.create_index(
        "ux_sessions_one_active_per_user",
        "sessions",
        ["username"],
        unique=True,
        postgresql_where=sa.text("end_at IS NULL"),
    )
    op.create_index(
        "ix_sessions_username_day_date",
        "sessions",
        ["username", "day_date"],
    )
    op.create_index(
        "ix_sessions_username_timer_day_date",
        "sessions",
        ["username", "timer_id", "day_date"],
    )
    op.create_index(
        "ix_sessions_username_start_at",
        "sessions",
        ["username", "start_at"],
    )

    op.create_table(
        "day_summaries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("day_date", sa.Date(), nullable=False),
        sa.Column("timer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("total_seconds", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "total_seconds >= 0",
            name="ck_day_summaries_total_nonnegative",
        ),
        sa.ForeignKeyConstraint(
            ["username"],
            ["users.username"],
            ondelete="CASCADE",
            name="fk_day_summaries_username_users",
        ),
        sa.ForeignKeyConstraint(
            ["timer_id"],
            ["timers.id"],
            ondelete="CASCADE",
            name="fk_day_summaries_timer_id_timers",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_day_summaries"),
        sa.UniqueConstraint(
            "username",
            "day_date",
            "timer_id",
            name="uq_day_summaries_username_day_timer",
        ),
    )
    op.create_index(
        "ix_day_summaries_username_day_date",
        "day_summaries",
        ["username", "day_date"],
    )
    op.create_index(
        "ix_day_summaries_username_timer_day_date",
        "day_summaries",
        ["username", "timer_id", "day_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_day_summaries_username_timer_day_date", table_name="day_summaries")
    op.drop_index("ix_day_summaries_username_day_date", table_name="day_summaries")
    op.drop_table("day_summaries")

    op.drop_index("ix_sessions_username_start_at", table_name="sessions")
    op.drop_index("ix_sessions_username_timer_day_date", table_name="sessions")
    op.drop_index("ix_sessions_username_day_date", table_name="sessions")
    op.drop_index("ux_sessions_one_active_per_user", table_name="sessions")
    op.drop_table("sessions")

    op.drop_index("ix_timers_username_is_archived", table_name="timers")
    op.drop_table("timers")

    op.drop_table("users")
