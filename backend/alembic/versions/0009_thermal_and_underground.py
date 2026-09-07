"""thermal power stations, and underground cables as real data

Two gaps found by comparing the rewrite's map panel against the legacy
MapView layer list.

Thermal generating stations were never migrated - the legacy panel has
Hydel / Thermal / Solar and only two came across.

"UG Cables 220 KV / 132 KV" are not a separate table: they are ordinary
lines whose feeder ids were hardcoded into GetMapData, MapData and MapDatav3,
the same two lists repeated five times each. That is business data living in
SQL text, so it becomes a column. Six of the 41 ids match no line and are
left out rather than invented; every surviving id resolves to a line of the
expected voltage.

Revision ID: 0009
Revises: 0008
Create Date: 2026-09-07

"""

from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "gis"

UNDERGROUND_FEEDER_IDS = [
    # 132 kV
    22, 24, 25, 26, 27, 28, 30, 401, 411, 412, 415, 426, 427, 432, 434, 435,
    436, 437, 438, 439, 465, 466, 467, 468, 751, 752,
    # 220 kV
    505, 506, 518, 519, 521, 597, 598, 660, 661, 669, 672, 674, 675, 676, 780,
]


def upgrade() -> None:
    op.create_table(
        "thermal_power_station",
        sa.Column("thermal_id", sa.BigInteger(), autoincrement=False, nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("gen_cap_mw", sa.Numeric(10, 2), nullable=True),
        sa.Column("connected_ss", sa.Text(), nullable=True),
        sa.Column("volt_level", sa.String(50), nullable=True),
        sa.Column("division", sa.String(100), nullable=True),
        sa.Column("circle", sa.String(100), nullable=True),
        sa.Column("zone", sa.String(100), nullable=True),
        sa.Column(
            "location",
            geoalchemy2.Geography(geometry_type="POINT", srid=4326, spatial_index=False),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("thermal_id", name="pk_thermal_power_station"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_thermal_power_station_location", "thermal_power_station", ["location"],
        postgresql_using="gist", schema=SCHEMA,
    )
    op.execute(
        f"""
        INSERT INTO {SCHEMA}.thermal_power_station (
            thermal_id, name, gen_cap_mw, connected_ss, volt_level,
            division, circle, zone, location
        )
        SELECT t.thermal_id, {SCHEMA}.tnull(t.name), t.gen_cap,
               {SCHEMA}.tnull(t.connected_ss), {SCHEMA}.tnull(t.vtg_rate),
               {SCHEMA}.tnull(t.division), {SCHEMA}.tnull(t.circle),
               {SCHEMA}.tnull(t.zone),
               CASE WHEN t.long BETWEEN -180 AND 180 AND t.lat BETWEEN -90 AND 90
                    THEN ST_SetSRID(ST_MakePoint(t.long, t.lat), 4326)::geography END
        FROM legacy_raw."thermalpowerstations" t
        """
    )
    seq = f"{SCHEMA}.thermal_power_station_thermal_id_seq"
    op.execute(
        f"CREATE SEQUENCE IF NOT EXISTS {seq} AS bigint "
        f"OWNED BY {SCHEMA}.thermal_power_station.thermal_id"
    )
    op.execute(
        f"SELECT setval('{seq}', "
        f"COALESCE((SELECT max(thermal_id) FROM {SCHEMA}.thermal_power_station), 0) + 1, false)"
    )
    op.execute(
        f"ALTER TABLE {SCHEMA}.thermal_power_station "
        f"ALTER COLUMN thermal_id SET DEFAULT nextval('{seq}')"
    )

    op.add_column(
        "line",
        sa.Column(
            "is_underground",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            comment=(
                "Underground cable. Replaces the hardcoded FEEDER_ID lists that the "
                'legacy map procedures used to drive the "UG Cables" layers.'
            ),
        ),
        schema=SCHEMA,
    )
    ids = ", ".join(str(i) for i in UNDERGROUND_FEEDER_IDS)
    op.execute(f"UPDATE {SCHEMA}.line SET is_underground = true WHERE feeder_id IN ({ids})")
    op.create_index(
        "ix_line_is_underground", "line", ["is_underground"],
        schema=SCHEMA, postgresql_where=sa.text("is_underground"),
    )


def downgrade() -> None:
    op.drop_index("ix_line_is_underground", "line", schema=SCHEMA)
    op.drop_column("line", "is_underground", schema=SCHEMA)
    op.execute(f"DROP SEQUENCE IF EXISTS {SCHEMA}.thermal_power_station_thermal_id_seq CASCADE")
    op.drop_table("thermal_power_station", schema=SCHEMA)
