"""size the line/tower text columns from the data, not by eye

The first line/tower load failed on tower.location_no, which holds values up to
74 characters against a guessed varchar(50). Measuring the rest turned up two
more things: line.conductor_type and line.earth_wire_type sit at exactly 100 of
100 (already truncated upstream, since the legacy columns really are
varchar(100)), and tower.volt_class and tower.towers_utilized are NULL in all
105,082 rows - the map procs filter on the line's VOLT_CLASS through the join,
never the tower's, so an index there is write overhead against an empty column.

varchar(n) is kept only where a real domain rule exists - usernames, codes,
voltage class - and descriptive free text becomes text. The two perform
identically in Postgres.

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-05

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "gis"

TOWER_TO_TEXT = [
    "tower_type",
    "circuit_type",
    "make",
    "towers_utilized",
    "soil_strata",
    "foundation_class",
    "earthing_type",
    "earth_wire_type",
    "telecom_joint_box",
]

LINE_TO_TEXT = [
    "feeder_name",
    "from_substation",
    "to_substation",
    "circuit_type",
    "conductor_type",
    "earth_wire_type",
    "jurisdiction",
]

# original widths, for downgrade
TOWER_WIDTHS = {
    "tower_type": 100,
    "circuit_type": 100,
    "make": 150,
    "towers_utilized": 150,
    "soil_strata": 150,
    "foundation_class": 150,
    "earthing_type": 150,
    "earth_wire_type": 150,
    "telecom_joint_box": 150,
}
LINE_WIDTHS = {
    "feeder_name": 150,
    "from_substation": 150,
    "to_substation": 150,
    "circuit_type": 100,
    "conductor_type": 100,
    "earth_wire_type": 100,
    "jurisdiction": 150,
}


def upgrade() -> None:
    op.alter_column(
        "tower", "location_no", type_=sa.String(100), existing_type=sa.String(50), schema=SCHEMA
    )
    for col in TOWER_TO_TEXT:
        op.alter_column(
            "tower", col, type_=sa.Text(), existing_type=sa.String(TOWER_WIDTHS[col]),
            schema=SCHEMA,
        )
    for col in LINE_TO_TEXT:
        op.alter_column(
            "line", col, type_=sa.Text(), existing_type=sa.String(LINE_WIDTHS[col]), schema=SCHEMA
        )

    # NULL in every legacy row; the map filters on the line's volt_class
    op.drop_index("ix_tower_volt_class", "tower", schema=SCHEMA)


def downgrade() -> None:
    op.create_index("ix_tower_volt_class", "tower", ["volt_class"], schema=SCHEMA)
    for col in LINE_TO_TEXT:
        op.alter_column(
            "line", col, type_=sa.String(LINE_WIDTHS[col]), existing_type=sa.Text(), schema=SCHEMA
        )
    for col in TOWER_TO_TEXT:
        op.alter_column(
            "tower", col, type_=sa.String(TOWER_WIDTHS[col]), existing_type=sa.Text(),
            schema=SCHEMA,
        )
    op.alter_column(
        "tower", "location_no", type_=sa.String(50), existing_type=sa.String(100), schema=SCHEMA
    )
