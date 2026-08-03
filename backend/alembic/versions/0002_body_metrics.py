"""height and goal weight on users

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-03

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable, and deliberately not backfilled: an account that never answered
    # the signup questions has no height, and 0 or an average would both be
    # answers the user never gave.
    op.add_column("users", sa.Column("height_cm", sa.Numeric(4, 1), nullable=True))
    op.add_column(
        "users", sa.Column("goal_weight_kg", sa.Numeric(5, 2), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("users", "goal_weight_kg")
    op.drop_column("users", "height_cm")
