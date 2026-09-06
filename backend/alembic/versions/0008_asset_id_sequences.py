"""sequences for solar_plant.solar_id and ehv_consumer.ehv_id

Same story as 0006: both were IDENTITY in SQL Server, and sp_Solarplant /
sp_ehvconsumers insert without supplying an id.

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-06

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "gis"

_TABLES = [("solar_plant", "solar_id"), ("ehv_consumer", "ehv_id")]


def upgrade() -> None:
    # Free-text original of the solar commissioning date. Every existing value
    # parses, so nothing was lost historically - but the legacy column accepted
    # anything, and a future "Q3 2024" would disappear the way 276 line
    # charging dates did before migration 0007.
    op.add_column(
        "solar_plant",
        sa.Column("commercial_operation_date_raw", sa.Text(), nullable=True),
        schema=SCHEMA,
    )
    op.execute(
        f"""
        UPDATE {SCHEMA}.solar_plant sp
        SET commercial_operation_date_raw = {SCHEMA}.tnull(src.commercialoperationdate)
        FROM legacy_raw."Solar Plants" src
        WHERE src.solar_id = sp.solar_id
        """
    )

    for table, col in _TABLES:
        seq = f"{SCHEMA}.{table}_{col}_seq"
        op.execute(
            f"CREATE SEQUENCE IF NOT EXISTS {seq} AS bigint OWNED BY {SCHEMA}.{table}.{col}"
        )
        op.execute(
            f"SELECT setval('{seq}', COALESCE((SELECT max({col}) FROM {SCHEMA}.{table}), 0) + 1, false)"
        )
        op.execute(
            f"ALTER TABLE {SCHEMA}.{table} ALTER COLUMN {col} SET DEFAULT nextval('{seq}')"
        )


def downgrade() -> None:
    op.drop_column("solar_plant", "commercial_operation_date_raw", schema=SCHEMA)
    for table, col in _TABLES:
        op.execute(f"ALTER TABLE {SCHEMA}.{table} ALTER COLUMN {col} DROP DEFAULT")
        op.execute(f"DROP SEQUENCE IF EXISTS {SCHEMA}.{table}_{col}_seq")
