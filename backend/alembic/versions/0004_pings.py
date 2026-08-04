"""pings

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-04

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PING_STATUSES = ("pending", "accepted", "declined")


def upgrade() -> None:
    # Created up front so downgrade has something to drop. The column then
    # refers to it with create_type=False — otherwise create_table emits its
    # own CREATE TYPE and the transaction dies on "type already exists".
    sa.Enum(*PING_STATUSES, name="ping_status").create(op.get_bind())
    ping_status = postgresql.ENUM(*PING_STATUSES, name="ping_status", create_type=False)

    op.create_table(
        "pings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("from_user_id", sa.Uuid(), nullable=False),
        sa.Column("to_user_id", sa.Uuid(), nullable=False),
        # The training time. When the ping was sent is created_at.
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status", ping_status, server_default="pending", nullable=False
        ),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["from_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_user_id"], ["users.id"], ondelete="CASCADE"),
        # One invitation per person per slot: the second identical ping is not a
        # second invitation, it is the same one sent twice.
        sa.UniqueConstraint("from_user_id", "to_user_id", "at", name="uq_ping_slot"),
    )
    # One index per tab. Each leads with the user column, so it serves that
    # foreign key too and neither needs an index of its own.
    op.create_index("ix_pings_from_at", "pings", ["from_user_id", "at"])
    op.create_index("ix_pings_to_at", "pings", ["to_user_id", "at"])


def downgrade() -> None:
    op.drop_table("pings")
    sa.Enum(name="ping_status").drop(op.get_bind())
