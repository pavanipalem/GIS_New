"""initial core schema: users, substations, transformers, equipment

Revision ID: 0001
Revises:
Create Date: 2026-09-03

"""

from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "gis"


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"')

    user_role = sa.Enum("admin", "editor", "viewer", name="user_role", schema=SCHEMA)
    equipment_kind = sa.Enum(
        "shunt_reactor",
        "capacitor",
        "station_transformer",
        name="equipment_kind",
        schema=SCHEMA,
    )
    user_role.create(op.get_bind(), checkfirst=True)
    equipment_kind.create(op.get_bind(), checkfirst=True)

    # ---------------------------------------------------------------- app_user
    op.create_table(
        "app_user",
        sa.Column("id", sa.Integer(), sa.Identity(), nullable=False),
        sa.Column("username", sa.String(50), nullable=False),
        sa.Column("full_name", sa.String(120), nullable=True),
        sa.Column("password_hash", sa.String(128), nullable=False),
        sa.Column("role", user_role, nullable=False, server_default="viewer"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "must_change_password", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_app_user"),
        sa.UniqueConstraint("username", name="uq_app_user_username"),
        schema=SCHEMA,
    )
    op.create_index("ix_app_user_username", "app_user", ["username"], schema=SCHEMA)

    # ------------------------------------------------------------- substation
    op.create_table(
        "substation",
        sa.Column("ss_code", sa.BigInteger(), autoincrement=False, nullable=False),
        sa.Column("ss_name", sa.String(200), nullable=True),
        sa.Column("ss_type", sa.String(50), nullable=True),
        sa.Column("volt_class", sa.String(50), nullable=True),
        sa.Column("volt_levels", sa.String(50), nullable=True),
        sa.Column("primary_mva_cap", sa.Numeric(12, 2), nullable=True),
        sa.Column("no_of_ptrs", sa.SmallInteger(), nullable=True),
        sa.Column("district", sa.String(150), nullable=True),
        sa.Column("zone", sa.String(100), nullable=True),
        sa.Column("circle", sa.String(100), nullable=True),
        sa.Column("division", sa.String(150), nullable=True),
        sa.Column("plant_circle", sa.String(100), nullable=True),
        sa.Column("manned", sa.String(50), nullable=True),
        sa.Column("generation", sa.String(50), nullable=True),
        sa.Column("gen_type", sa.String(100), nullable=True),
        sa.Column("scada", sa.String(50), nullable=True),
        sa.Column("railway_tss", sa.String(50), nullable=True),
        sa.Column("gis_type", sa.String(50), nullable=True),
        sa.Column("ehv_consumer", sa.String(50), nullable=True),
        sa.Column("rad_grid", sa.String(50), nullable=True),
        sa.Column("dg_set", sa.String(50), nullable=True),
        sa.Column("dg_and_ff_system", sa.String(50), nullable=True),
        sa.Column("contact_no", sa.String(50), nullable=True),
        sa.Column("function_loc_code", sa.String(100), nullable=True),
        sa.Column("sap_erp_connectivity", sa.String(50), nullable=True),
        sa.Column("rrsc_ss_code", sa.String(50), nullable=True),
        sa.Column("ss_erp_source", sa.String(100), nullable=True),
        sa.Column("ss_doc", sa.Text(), nullable=True),
        sa.Column("link_sld", sa.Text(), nullable=True),
        sa.Column("link_ss_photo", sa.Text(), nullable=True),
        sa.Column("link_ss_layout", sa.Text(), nullable=True),
        sa.Column(
            "location",
            geoalchemy2.Geography(geometry_type="POINT", srid=4326, spatial_index=False),
            nullable=True,
        ),
        sa.Column(
            "boundary",
            geoalchemy2.Geography(geometry_type="POLYGON", srid=4326, spatial_index=False),
            nullable=True,
        ),
        sa.Column("inserted_by", sa.String(50), nullable=True),
        sa.Column("inserted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_by", sa.String(50), nullable=True),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("ss_code", name="pk_substation"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_substation_location",
        "substation",
        ["location"],
        postgresql_using="gist",
        schema=SCHEMA,
    )
    op.create_index(
        "ix_substation_boundary",
        "substation",
        ["boundary"],
        postgresql_using="gist",
        schema=SCHEMA,
    )
    op.create_index("ix_substation_volt_class", "substation", ["volt_class"], schema=SCHEMA)
    op.create_index("ix_substation_zone_circle", "substation", ["zone", "circle"], schema=SCHEMA)

    # ------------------------------------------------------------ transformer
    op.create_table(
        "transformer",
        sa.Column("id", sa.Integer(), sa.Identity(), nullable=False),
        sa.Column("ss_code", sa.BigInteger(), nullable=False),
        sa.Column("slot_no", sa.SmallInteger(), nullable=False),
        sa.Column("capacity_mva", sa.Numeric(12, 2), nullable=True),
        sa.Column("serial_no", sa.String(150), nullable=True),
        sa.Column("make", sa.String(150), nullable=True),
        sa.Column("vector_group", sa.String(50), nullable=True),
        sa.Column("year_of_commissioning", sa.Date(), nullable=True),
        sa.Column("yoc_raw", sa.String(100), nullable=True),
        sa.Column("po_reference", sa.Text(), nullable=True),
        sa.Column("volt_level", sa.String(50), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_transformer"),
        sa.ForeignKeyConstraint(
            ["ss_code"],
            [f"{SCHEMA}.substation.ss_code"],
            name="fk_transformer_ss_code_substation",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("ss_code", "slot_no", name="uq_transformer_ss_code"),
        sa.CheckConstraint("slot_no BETWEEN 1 AND 9", name="ck_transformer_slot_no_range"),
        schema=SCHEMA,
    )
    op.create_index("ix_transformer_ss_code", "transformer", ["ss_code"], schema=SCHEMA)

    # --------------------------------------------------- substation_equipment
    op.create_table(
        "substation_equipment",
        sa.Column("id", sa.Integer(), sa.Identity(), nullable=False),
        sa.Column("ss_code", sa.BigInteger(), nullable=False),
        sa.Column("kind", equipment_kind, nullable=False),
        sa.Column("capacity_mva", sa.Numeric(12, 2), nullable=True),
        sa.Column("serial_no", sa.String(150), nullable=True),
        sa.Column("make", sa.String(150), nullable=True),
        sa.Column("vector_group", sa.String(50), nullable=True),
        sa.Column("year_of_commissioning", sa.Date(), nullable=True),
        sa.Column("yoc_raw", sa.String(100), nullable=True),
        sa.Column("po_reference", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_substation_equipment"),
        sa.ForeignKeyConstraint(
            ["ss_code"],
            [f"{SCHEMA}.substation.ss_code"],
            name="fk_substation_equipment_ss_code_substation",
            ondelete="CASCADE",
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_substation_equipment_ss_code", "substation_equipment", ["ss_code"], schema=SCHEMA
    )


def downgrade() -> None:
    op.drop_table("substation_equipment", schema=SCHEMA)
    op.drop_table("transformer", schema=SCHEMA)
    op.drop_table("substation", schema=SCHEMA)
    op.drop_table("app_user", schema=SCHEMA)
    sa.Enum(name="equipment_kind", schema=SCHEMA).drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="user_role", schema=SCHEMA).drop(op.get_bind(), checkfirst=True)
