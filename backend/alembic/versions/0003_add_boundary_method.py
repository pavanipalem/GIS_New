"""record how each substation boundary polygon was derived

The legacy long1/lat1 .. long15/lat15 columns store points in data-entry
order, not ring order, so 57 of the 213 substations with three or more
points self-intersect when connected in sequence. Those boundaries are
rebuilt from the same vertices in a different order; this column records
which strategy produced each one so the rebuilt ones can be reviewed.

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-03

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "gis"

_COMMENT = (
    "How boundary was derived from the legacy long1..long15/lat1..lat15 columns: "
    "legacy_order = the stored point order already formed a valid ring; "
    "radial_sort = same points re-ordered by angle about their centroid, because "
    "the stored order self-intersected; "
    "convex_hull = radial sort still failed, so the hull of the same points; "
    "NULL = fewer than 3 distinct points, or no polygon possible."
)


def upgrade() -> None:
    op.add_column(
        "substation",
        sa.Column("boundary_method", sa.String(20), nullable=True, comment=_COMMENT),
        schema=SCHEMA,
    )
    op.create_check_constraint(
        "ck_substation_boundary_method",
        "substation",
        "boundary_method IS NULL "
        "OR boundary_method IN ('legacy_order', 'radial_sort', 'convex_hull')",
        schema=SCHEMA,
    )
    op.create_index(
        "ix_substation_boundary_method", "substation", ["boundary_method"], schema=SCHEMA
    )


def downgrade() -> None:
    op.drop_index("ix_substation_boundary_method", "substation", schema=SCHEMA)
    op.drop_constraint("ck_substation_boundary_method", "substation", schema=SCHEMA)
    op.drop_column("substation", "boundary_method", schema=SCHEMA)
