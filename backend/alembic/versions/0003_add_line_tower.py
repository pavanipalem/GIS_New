"""transmission lines and towers

gis.line  from legacy_raw."lines-template"           (911 rows)
gis.tower from legacy_raw."Feeders-Towers-template"  (105,082 rows)

legacy_raw.totaltowers gets no table: sp_gisdatamodify deletes it and rebuilds
it from exactly this join, filling 9 of its 85 columns. It is a denormalized
cache that PostGIS plus a GiST index makes unnecessary.

line.route is the polyline the map draws - the line's towers joined in seq_no
order. Derived from gis.tower, so it is rebuilt rather than edited.

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-05

"""

from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "gis"


def upgrade() -> None:
    # ----------------------------------------------------------------- line
    op.create_table(
        "line",
        sa.Column("feeder_id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("feeder_name", sa.String(150), nullable=True),
        sa.Column("volt_class", sa.String(50), nullable=True),
        sa.Column("from_substation", sa.String(150), nullable=True),
        sa.Column("to_substation", sa.String(150), nullable=True),
        sa.Column("total_no_of_locations", sa.Integer(), nullable=True),
        sa.Column("length_ckm", sa.Numeric(12, 3), nullable=True),
        sa.Column("length_of_line", sa.Numeric(12, 3), nullable=True),
        sa.Column("max_load_in_amp", sa.Numeric(12, 2), nullable=True),
        sa.Column("circuit_type", sa.String(100), nullable=True),
        sa.Column("conductor_type", sa.String(100), nullable=True),
        sa.Column("earth_wire_type", sa.String(100), nullable=True),
        sa.Column("date_of_charging", sa.Date(), nullable=True),
        sa.Column("last_maintenance_date", sa.Date(), nullable=True),
        sa.Column("jurisdiction", sa.String(150), nullable=True),
        sa.Column("zone", sa.String(100), nullable=True),
        sa.Column("circle", sa.String(100), nullable=True),
        sa.Column("sap_fl_code", sa.String(100), nullable=True),
        sa.Column("additional_info", sa.Text(), nullable=True),
        sa.Column(
            "route",
            geoalchemy2.Geography(geometry_type="LINESTRING", srid=4326, spatial_index=False),
            nullable=True,
        ),
        sa.Column("tower_count", sa.Integer(), nullable=True),
        sa.Column("inserted_by", sa.String(50), nullable=True),
        sa.Column("inserted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_by", sa.String(50), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("feeder_id", name="pk_line"),
        schema=SCHEMA,
    )
    op.create_index("ix_line_route", "line", ["route"], postgresql_using="gist", schema=SCHEMA)
    op.create_index("ix_line_volt_class", "line", ["volt_class"], schema=SCHEMA)
    op.create_index("ix_line_zone_circle", "line", ["zone", "circle"], schema=SCHEMA)

    # ---------------------------------------------------------------- tower
    op.create_table(
        "tower",
        sa.Column("tower_id", sa.BigInteger(), autoincrement=False, nullable=False),
        sa.Column("feeder_id", sa.Integer(), nullable=True),
        sa.Column(
            "location",
            geoalchemy2.Geography(geometry_type="POINT", srid=4326, spatial_index=False),
            nullable=True,
        ),
        sa.Column("seq_no", sa.Integer(), nullable=True),
        sa.Column("location_no", sa.String(50), nullable=True),
        sa.Column("tower_type", sa.String(100), nullable=True),
        sa.Column("tower_extension", sa.String(50), nullable=True),
        sa.Column("circuit_type", sa.String(100), nullable=True),
        sa.Column("make", sa.String(150), nullable=True),
        sa.Column("towers_utilized", sa.String(150), nullable=True),
        sa.Column("soil_strata", sa.String(150), nullable=True),
        sa.Column("foundation_class", sa.String(150), nullable=True),
        sa.Column("disc_70kn", sa.SmallInteger(), nullable=True),
        sa.Column("disc_120kn", sa.SmallInteger(), nullable=True),
        sa.Column("disc_160kn", sa.SmallInteger(), nullable=True),
        sa.Column("src_70kn", sa.SmallInteger(), nullable=True),
        sa.Column("src_120kn", sa.SmallInteger(), nullable=True),
        sa.Column("src_160kn", sa.SmallInteger(), nullable=True),
        sa.Column("earthing_type", sa.String(150), nullable=True),
        sa.Column("earth_wire_type", sa.String(150), nullable=True),
        sa.Column("telecom_joint_box", sa.String(150), nullable=True),
        sa.Column("landmark", sa.Text(), nullable=True),
        sa.Column("additional_info", sa.Text(), nullable=True),
        sa.Column("volt_class", sa.String(50), nullable=True),
        sa.Column("zone", sa.String(100), nullable=True),
        sa.Column("circle", sa.String(100), nullable=True),
        sa.Column("sap_id", sa.Integer(), nullable=True),
        sa.Column("rrsc_line_code", sa.String(100), nullable=True),
        sa.Column("inserted_by", sa.String(50), nullable=True),
        sa.Column("inserted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_by", sa.String(50), nullable=True),
        sa.PrimaryKeyConstraint("tower_id", name="pk_tower"),
        sa.ForeignKeyConstraint(
            ["feeder_id"],
            [f"{SCHEMA}.line.feeder_id"],
            name="fk_tower_feeder_id_line",
            ondelete="SET NULL",
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_tower_location", "tower", ["location"], postgresql_using="gist", schema=SCHEMA
    )
    op.create_index("ix_tower_feeder_id", "tower", ["feeder_id"], schema=SCHEMA)
    op.create_index("ix_tower_volt_class", "tower", ["volt_class"], schema=SCHEMA)
    op.create_index("ix_tower_feeder_seq", "tower", ["feeder_id", "seq_no"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("tower", schema=SCHEMA)
    op.drop_table("line", schema=SCHEMA)
