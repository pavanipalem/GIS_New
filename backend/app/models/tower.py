from __future__ import annotations

from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Sequence,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.line import Line

# ---------------------------------------------------------------------------
# Normalized rebuild of legacy_raw."Feeders-Towers-template" (37 columns).
#
# This is the authoritative tower table: every map branch in GetMapData,
# MapData and MapDatav3 reads it joined to "lines-template" on FEEDER_ID.
# legacy_raw.totaltowers is NOT a second source - sp_gisdatamodify deletes it
# and rebuilds it from this table joined to lines-template, filling only 9 of
# its 85 columns. It is a denormalized cache, so it gets no model here.
#
# Coordinates come from the text tower_long/tower_lat, which is what the procs
# read. The legacy long/lat/long1/lat1 float columns are the same values
# rounded to 4dp and are dropped.
# ---------------------------------------------------------------------------


class Tower(Base):
    __tablename__ = "tower"
    __table_args__ = (
        Index("ix_tower_location", "location", postgresql_using="gist"),
        Index("ix_tower_feeder_id", "feeder_id"),
        Index("ix_tower_feeder_seq", "feeder_id", "seq_no"),
    )

    # IDENTITY in SQL Server; a sequence here (migration 0006).
    tower_id: Mapped[int] = mapped_column(
        BigInteger, Sequence("tower_tower_id_seq", schema="gis"), primary_key=True
    )
    feeder_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("line.feeder_id", ondelete="SET NULL")
    )

    location: Mapped[str | None] = mapped_column(
        Geography("POINT", srid=4326, spatial_index=False)
    )
    # Legacy "order": the tower's position along the route. Distinct from
    # location_no, which is the surveyor's label and can run the other way
    # (feeder 361 has order 19,20,21 against location numbers 71,70,69).
    seq_no: Mapped[int | None] = mapped_column(Integer)
    location_no: Mapped[str | None] = mapped_column(String(100))

    tower_type: Mapped[str | None] = mapped_column(Text)
    tower_extension: Mapped[str | None] = mapped_column(String(50))
    circuit_type: Mapped[str | None] = mapped_column(Text)
    make: Mapped[str | None] = mapped_column(Text)
    towers_utilized: Mapped[str | None] = mapped_column(Text)

    soil_strata: Mapped[str | None] = mapped_column(Text)
    foundation_class: Mapped[str | None] = mapped_column(Text)

    # Insulator counts: a fixed set of six named ratings, not numbered slots,
    # so they stay flat rather than becoming a child table.
    disc_70kn: Mapped[int | None] = mapped_column(SmallInteger)
    disc_120kn: Mapped[int | None] = mapped_column(SmallInteger)
    disc_160kn: Mapped[int | None] = mapped_column(SmallInteger)
    src_70kn: Mapped[int | None] = mapped_column(SmallInteger)
    src_120kn: Mapped[int | None] = mapped_column(SmallInteger)
    src_160kn: Mapped[int | None] = mapped_column(SmallInteger)

    earthing_type: Mapped[str | None] = mapped_column(Text)
    earth_wire_type: Mapped[str | None] = mapped_column(Text)
    telecom_joint_box: Mapped[str | None] = mapped_column(Text)
    landmark: Mapped[str | None] = mapped_column(Text)
    additional_info: Mapped[str | None] = mapped_column(Text)

    # Empty in all 105,082 legacy rows - the map procs filter on the line's
    # VOLT_CLASS through the join, never the tower's. Kept because the column
    # exists upstream, but deliberately not indexed.
    volt_class: Mapped[str | None] = mapped_column(String(50))
    zone: Mapped[str | None] = mapped_column(String(100))
    circle: Mapped[str | None] = mapped_column(String(100))
    sap_id: Mapped[int | None] = mapped_column(Integer)
    rrsc_line_code: Mapped[str | None] = mapped_column(String(100))

    inserted_by: Mapped[str | None] = mapped_column(String(50))
    inserted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_by: Mapped[str | None] = mapped_column(String(50))

    line: Mapped[Line | None] = relationship(back_populates="towers")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Tower {self.tower_id} loc={self.location_no!r}>"
