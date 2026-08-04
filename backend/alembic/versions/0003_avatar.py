"""avatar on users

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-04

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Spelled out rather than imported from app.models: a migration records what the
# type was on this date. If the enum gains a tenth member later, that is another
# migration, and this one still has to describe the nine it created.
AVATAR_KEYS = (
    "here_to_gain",
    "here_to_lose",
    "warming_up",
    "casual",
    "regular",
    "consistent",
    "advanced",
    "batman",
    "unit",
)


def upgrade() -> None:
    avatar_key = sa.Enum(*AVATAR_KEYS, name="avatar_key")
    # Created explicitly: add_column would emit the CREATE TYPE for us, but then
    # downgrade has no handle on it and leaves the type behind.
    avatar_key.create(op.get_bind())
    # Nullable — an account that hasn't picked one shows initials instead.
    op.add_column("users", sa.Column("avatar", avatar_key, nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar")
    sa.Enum(name="avatar_key").drop(op.get_bind())
