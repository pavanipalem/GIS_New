from __future__ import annotations

import enum
from datetime import date, datetime

from geoalchemy2 import Geography
from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Identity,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

# ---------------------------------------------------------------------------
# Normalized rebuild of legacy_raw."substations-template" (143 flat columns).
#
#   - ptr1_*..ptr9_* (+ PTR{n}_Volt Level)  -> Transformer child rows
#   - shnt_rctr__* / capacitor_* / station transformer -> SubstationEquipment
#   - long1/lat1 .. long15/lat15            -> boundary  geography(Polygon)
#   - longitude/latitude                    -> location  geography(Point)
#   - free-text numeric/date fields are parsed during backfill; the model
#     declares the real target types.
# ---------------------------------------------------------------------------


class EquipmentKind(str, enum.Enum):
    shunt_reactor = "shunt_reactor"
    capacitor = "capacitor"
    station_transformer = "station_transformer"


class Substation(Base):
    __tablename__ = "substation"

    ss_code: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)

    # Identity / classification
    ss_name: Mapped[str | None] = mapped_column(String(200))
    ss_type: Mapped[str | None] = mapped_column(String(50))
    volt_class: Mapped[str | None] = mapped_column(String(50))
    volt_levels: Mapped[str | None] = mapped_column(String(50))
    primary_mva_cap: Mapped[float | None] = mapped_column(Numeric(12, 2))
    no_of_ptrs: Mapped[int | None] = mapped_column(SmallInteger)

    # Administrative hierarchy
    district: Mapped[str | None] = mapped_column(String(150))
    zone: Mapped[str | None] = mapped_column(String(100))
    circle: Mapped[str | None] = mapped_column(String(100))
    division: Mapped[str | None] = mapped_column(String(150))
    plant_circle: Mapped[str | None] = mapped_column(String(100))

    # Attributes / flags (kept as free text — legacy values are inconsistent)
    manned: Mapped[str | None] = mapped_column(String(50))
    generation: Mapped[str | None] = mapped_column(String(50))
    gen_type: Mapped[str | None] = mapped_column(String(100))
    scada: Mapped[str | None] = mapped_column(String(50))
    railway_tss: Mapped[str | None] = mapped_column(String(50))
    gis_type: Mapped[str | None] = mapped_column("gis_type", String(50))
    ehv_consumer: Mapped[str | None] = mapped_column(String(50))
    rad_grid: Mapped[str | None] = mapped_column(String(50))
    dg_set: Mapped[str | None] = mapped_column(String(50))
    dg_and_ff_system: Mapped[str | None] = mapped_column(String(50))
    contact_no: Mapped[str | None] = mapped_column(String(50))

    # Codes / external references
    function_loc_code: Mapped[str | None] = mapped_column(String(100))
    sap_erp_connectivity: Mapped[str | None] = mapped_column(String(50))
    rrsc_ss_code: Mapped[str | None] = mapped_column(String(50))
    ss_erp_source: Mapped[str | None] = mapped_column(String(100))

    # Document links
    ss_doc: Mapped[str | None] = mapped_column(Text)
    link_sld: Mapped[str | None] = mapped_column(Text)
    link_ss_photo: Mapped[str | None] = mapped_column(Text)
    link_ss_layout: Mapped[str | None] = mapped_column(Text)

    # Geometry (SRID 4326)
    location: Mapped[str | None] = mapped_column(Geography("POINT", srid=4326, spatial_index=False))
    boundary: Mapped[str | None] = mapped_column(Geography("POLYGON", srid=4326, spatial_index=False))
    # How `boundary` was derived from the legacy long1..long15/lat1..lat15 columns:
    # "legacy_order" - the stored point order already formed a valid ring
    # "radial_sort"  - same points, re-ordered by angle about their centroid,
    #                  because the stored order self-intersected
    # "convex_hull"  - radial sort still failed; hull of the same points
    # NULL           - fewer than 3 distinct points, or no polygon possible
    boundary_method: Mapped[str | None] = mapped_column(String(20))

    # Audit
    inserted_by: Mapped[str | None] = mapped_column(String(50))
    inserted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_by: Mapped[str | None] = mapped_column(String(50))
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    transformers: Mapped[list[Transformer]] = relationship(
        back_populates="substation",
        cascade="all, delete-orphan",
        order_by="Transformer.slot_no",
    )
    equipment: Mapped[list[SubstationEquipment]] = relationship(
        back_populates="substation",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Substation {self.ss_code} {self.ss_name!r}>"


class Transformer(Base):
    __tablename__ = "transformer"
    __table_args__ = (UniqueConstraint("ss_code", "slot_no"),)

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    ss_code: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("substation.ss_code", ondelete="CASCADE"), index=True
    )
    slot_no: Mapped[int] = mapped_column(SmallInteger)  # 1..9, the legacy ptrN index

    capacity_mva: Mapped[float | None] = mapped_column(Numeric(12, 2))
    serial_no: Mapped[str | None] = mapped_column(String(150))
    make: Mapped[str | None] = mapped_column(String(150))
    vector_group: Mapped[str | None] = mapped_column(String(50))
    year_of_commissioning: Mapped[date | None] = mapped_column(Date)
    # Legacy ptrN_yoc arrives in ~8 formats, including year-only ("2024")
    # and free text ("not commissioned"). A full date fills both columns;
    # a year-only value fills yoc_year alone; anything unparseable
    # survives verbatim in yoc_raw.
    yoc_year: Mapped[int | None] = mapped_column(SmallInteger)
    yoc_raw: Mapped[str | None] = mapped_column(String(100))
    po_reference: Mapped[str | None] = mapped_column(Text)
    volt_level: Mapped[str | None] = mapped_column(String(50))

    substation: Mapped[Substation] = relationship(back_populates="transformers")


class SubstationEquipment(Base):
    __tablename__ = "substation_equipment"

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    ss_code: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("substation.ss_code", ondelete="CASCADE"), index=True
    )
    kind: Mapped[EquipmentKind] = mapped_column(
        Enum(EquipmentKind, name="equipment_kind", native_enum=True)
    )

    capacity_mva: Mapped[float | None] = mapped_column(Numeric(12, 2))
    serial_no: Mapped[str | None] = mapped_column(String(150))
    make: Mapped[str | None] = mapped_column(String(150))
    vector_group: Mapped[str | None] = mapped_column(String(50))
    year_of_commissioning: Mapped[date | None] = mapped_column(Date)
    yoc_year: Mapped[int | None] = mapped_column(SmallInteger)
    yoc_raw: Mapped[str | None] = mapped_column(String(100))
    po_reference: Mapped[str | None] = mapped_column(Text)

    substation: Mapped[Substation] = relationship(back_populates="equipment")
