from __future__ import annotations

from datetime import date, datetime

from geoalchemy2 import Geography
from sqlalchemy import Date, DateTime, Index, Integer, Numeric, Sequence, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

# ---------------------------------------------------------------------------
# Normalized rebuild of legacy_raw."lines-template" (23 columns, all varchar).
#
# A line carries no geometry of its own - the legacy table has no coordinate
# columns at all. Its physical route is its towers, joined on feeder_id. Every
# map branch in GetMapData/MapData/MapDatav3 reads
# "Feeders-Towers-template" a, "lines-template" b WHERE a.FEEDER_ID = b.FEEDER_ID.
#
# FROM/TO are SQL reserved words in the legacy table; renamed here.
# ---------------------------------------------------------------------------


class Line(Base):
    __tablename__ = "line"
    __table_args__ = (
        Index("ix_line_route", "route", postgresql_using="gist"),
        Index("ix_line_volt_class", "volt_class"),
        Index("ix_line_zone_circle", "zone", "circle"),
    )

    # IDENTITY in SQL Server; a sequence here (migration 0006) so new lines
    # get an id allocated instead of the caller inventing one.
    feeder_id: Mapped[int] = mapped_column(
        Integer, Sequence("line_feeder_id_seq", schema="gis"), primary_key=True
    )

    feeder_name: Mapped[str | None] = mapped_column(Text)
    volt_class: Mapped[str | None] = mapped_column(String(50))
    from_substation: Mapped[str | None] = mapped_column("from_substation", Text)
    to_substation: Mapped[str | None] = mapped_column("to_substation", Text)

    total_no_of_locations: Mapped[int | None] = mapped_column(Integer)
    length_ckm: Mapped[float | None] = mapped_column(Numeric(12, 3))
    length_of_line: Mapped[float | None] = mapped_column(Numeric(12, 3))
    max_load_in_amp: Mapped[float | None] = mapped_column(Numeric(12, 2))

    circuit_type: Mapped[str | None] = mapped_column(Text)
    conductor_type: Mapped[str | None] = mapped_column(Text)
    earth_wire_type: Mapped[str | None] = mapped_column(Text)

    # Parsed where possible; the *_raw columns always hold what was actually
    # entered. 31% of charging dates and 40% of maintenance dates carry more
    # than one date can express - per-circuit, per-section, or a qualifier -
    # so parsing alone would discard real information.
    date_of_charging: Mapped[date | None] = mapped_column(Date)
    date_of_charging_raw: Mapped[str | None] = mapped_column(
        Text,
        comment=(
            "Original DATE_OF_CHRGING_OF_LINE text. date_of_charging holds the "
            "parsed value when there is one; this always holds what was entered."
        ),
    )
    last_maintenance_date: Mapped[date | None] = mapped_column(Date)
    last_maintenance_date_raw: Mapped[str | None] = mapped_column(
        Text, comment="Original LAST_MAINTENANCE_DATE text, as above."
    )

    jurisdiction: Mapped[str | None] = mapped_column(Text)
    zone: Mapped[str | None] = mapped_column(String(100))
    circle: Mapped[str | None] = mapped_column(String(100))
    sap_fl_code: Mapped[str | None] = mapped_column(String(100))
    additional_info: Mapped[str | None] = mapped_column(Text)

    # The route drawn on the map: this line's towers joined in seq_no order.
    # Derived, not source data - rebuild it whenever a tower on this feeder
    # moves, is added or is removed (gis.rebuild_line_routes()).
    route: Mapped[str | None] = mapped_column(
        Geography("LINESTRING", srid=4326, spatial_index=False)
    )
    tower_count: Mapped[int | None] = mapped_column(Integer)

    inserted_by: Mapped[str | None] = mapped_column(String(50))
    inserted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_by: Mapped[str | None] = mapped_column(String(50))
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    towers: Mapped[list["Tower"]] = relationship(  # noqa: F821
        back_populates="line",
        order_by="Tower.seq_no",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Line {self.feeder_id} {self.feeder_name!r}>"
