"""add yoc_year to transformer and substation_equipment

Legacy ptrN_yoc holds year-only values ("2024", "1985") alongside full dates,
which a DATE column cannot represent honestly.

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-03

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "gis"


def upgrade() -> None:
    for table in ("transformer", "substation_equipment"):
        op.add_column(
            table,
            sa.Column("yoc_year", sa.SmallInteger(), nullable=True),
            schema=SCHEMA,
        )


def downgrade() -> None:
    for table in ("transformer", "substation_equipment"):
        op.drop_column(table, "yoc_year", schema=SCHEMA)
