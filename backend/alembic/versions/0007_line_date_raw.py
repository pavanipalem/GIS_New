"""keep the original text of the line date columns (repair)

101_backfill_lines_towers.sql parsed DATE_OF_CHRGING_OF_LINE and
LAST_MAINTENANCE_DATE straight into date columns and kept nothing else, so
anything the parser could not read was silently dropped - 276 of 899 charging
dates and 57 of 144 maintenance dates. Those values carry real detail a single
date cannot hold ("01.03.2017(Ckt I),15.06.2018(Ckt II)", "01.03.2024 (Idle
charged)"). gis.transformer already kept yoc_raw; this brings the line columns
in line. legacy_raw still holds every original, so the repair recovers them.

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-06

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "gis"


def upgrade() -> None:
    op.add_column(
        "line",
        sa.Column(
            "date_of_charging_raw",
            sa.Text(),
            nullable=True,
            comment=(
                "Original DATE_OF_CHRGING_OF_LINE text. date_of_charging holds the "
                "parsed value when there is one; this always holds what was entered."
            ),
        ),
        schema=SCHEMA,
    )
    op.add_column(
        "line",
        sa.Column(
            "last_maintenance_date_raw",
            sa.Text(),
            nullable=True,
            comment="Original LAST_MAINTENANCE_DATE text, as above.",
        ),
        schema=SCHEMA,
    )
    op.execute(
        f"""
        UPDATE {SCHEMA}.line l
        SET date_of_charging_raw      = {SCHEMA}.tnull(src."DATE_OF_CHRGING_OF_LINE"),
            last_maintenance_date_raw = {SCHEMA}.tnull(src."LAST_MAINTENANCE_DATE")
        FROM legacy_raw."lines-template" src
        WHERE src."FEEDER_ID" = l.feeder_id
        """
    )


def downgrade() -> None:
    op.drop_column("line", "last_maintenance_date_raw", schema=SCHEMA)
    op.drop_column("line", "date_of_charging_raw", schema=SCHEMA)
