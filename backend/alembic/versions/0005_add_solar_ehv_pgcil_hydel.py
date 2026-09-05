"""solar plants, EHV consumers, and three read-only reference layers

gis.solar_plant, gis.ehv_consumer from the two remaining "confirmed live"
legacy tables. gis.pgcil_substation, gis.hydel_power_station, gis.pgcil_line
are read-only: no INSERT/UPDATE against pgcil, hydelpowerstations or
pgcillines exists anywhere in the legacy stored procedures, and only
MapView.aspx references them, for display - so no audit columns and no
write-path service methods for these three.

pgcil_line has no ordering column in its source at all, so it is a point
layer rather than a route.

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-06

"""

from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "gis"


def _point_col():
    return sa.Column(
        "location",
        geoalchemy2.Geography(geometry_type="POINT", srid=4326, spatial_index=False),
        nullable=True,
    )


def upgrade() -> None:
    # ------------------------------------------------------------ solar_plant
    op.create_table(
        "solar_plant",
        sa.Column("solar_id", sa.BigInteger(), autoincrement=False, nullable=False),
        sa.Column("plant_name", sa.Text(), nullable=True),
        sa.Column("location_desc", sa.Text(), nullable=True),
        sa.Column("installed_capacity_mw", sa.Numeric(10, 2), nullable=True),
        sa.Column("interfacing_ss", sa.Text(), nullable=True),
        sa.Column("voltage_level", sa.String(50), nullable=True),
        sa.Column("commercial_operation_date", sa.Date(), nullable=True),
        _point_col(),
        sa.Column("division", sa.String(100), nullable=True),
        sa.Column("circle", sa.String(100), nullable=True),
        sa.Column("zone", sa.String(100), nullable=True),
        sa.PrimaryKeyConstraint("solar_id", name="pk_solar_plant"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_solar_plant_location", "solar_plant", ["location"], postgresql_using="gist",
        schema=SCHEMA,
    )

    # ----------------------------------------------------------- ehv_consumer
    op.create_table(
        "ehv_consumer",
        sa.Column("ehv_id", sa.BigInteger(), autoincrement=False, nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("location_desc", sa.Text(), nullable=True),
        sa.Column("installed_capacity_mw", sa.Numeric(10, 2), nullable=True),
        _point_col(),
        sa.Column("feeder_id", sa.Integer(), nullable=True),
        sa.Column("feeder_name", sa.Text(), nullable=True),
        sa.Column("substation", sa.Text(), nullable=True),
        sa.Column("consumer_code", sa.String(100), nullable=True),
        sa.Column("voltage_rate", sa.String(50), nullable=True),
        sa.Column("function_loc_code", sa.String(100), nullable=True),
        sa.Column("connected_ss", sa.Text(), nullable=True),
        sa.Column("line_name", sa.Text(), nullable=True),
        sa.Column("line_code", sa.String(100), nullable=True),
        sa.Column("division", sa.String(100), nullable=True),
        sa.Column("circle", sa.String(100), nullable=True),
        sa.Column("zone", sa.String(100), nullable=True),
        sa.PrimaryKeyConstraint("ehv_id", name="pk_ehv_consumer"),
        sa.ForeignKeyConstraint(
            ["feeder_id"], [f"{SCHEMA}.line.feeder_id"],
            name="fk_ehv_consumer_feeder_id_line", ondelete="SET NULL",
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_ehv_consumer_location", "ehv_consumer", ["location"], postgresql_using="gist",
        schema=SCHEMA,
    )
    op.create_index("ix_ehv_consumer_feeder_id", "ehv_consumer", ["feeder_id"], schema=SCHEMA)

    # ------------------------------------------------------- pgcil_substation
    op.create_table(
        "pgcil_substation",
        sa.Column("id", sa.Integer(), sa.Identity(), nullable=False),
        sa.Column("voltage", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=True),
        _point_col(),
        sa.PrimaryKeyConstraint("id", name="pk_pgcil_substation"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_pgcil_substation_location", "pgcil_substation", ["location"],
        postgresql_using="gist", schema=SCHEMA,
    )

    # ----------------------------------------------------- hydel_power_station
    op.create_table(
        "hydel_power_station",
        sa.Column("hydel_id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("gen_cap_mw", sa.Numeric(10, 2), nullable=True),
        sa.Column("connected_ss", sa.String(100), nullable=True),
        sa.Column("volt_level", sa.String(10), nullable=True),
        sa.Column("division", sa.String(100), nullable=True),
        sa.Column("circle", sa.String(50), nullable=True),
        sa.Column("zone", sa.String(100), nullable=True),
        _point_col(),
        sa.PrimaryKeyConstraint("hydel_id", name="pk_hydel_power_station"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_hydel_power_station_location", "hydel_power_station", ["location"],
        postgresql_using="gist", schema=SCHEMA,
    )

    # ------------------------------------------------------------- pgcil_line
    op.create_table(
        "pgcil_line",
        sa.Column("id", sa.Integer(), sa.Identity(), nullable=False),
        sa.Column("feeder_name", sa.Text(), nullable=True),
        _point_col(),
        sa.PrimaryKeyConstraint("id", name="pk_pgcil_line"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_pgcil_line_location", "pgcil_line", ["location"], postgresql_using="gist",
        schema=SCHEMA,
    )
    op.create_index("ix_pgcil_line_feeder_name", "pgcil_line", ["feeder_name"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("pgcil_line", schema=SCHEMA)
    op.drop_table("hydel_power_station", schema=SCHEMA)
    op.drop_table("pgcil_substation", schema=SCHEMA)
    op.drop_table("ehv_consumer", schema=SCHEMA)
    op.drop_table("solar_plant", schema=SCHEMA)
