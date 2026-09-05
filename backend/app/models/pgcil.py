from __future__ import annotations

from geoalchemy2 import Geography
from sqlalchemy import Identity, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

# ---------------------------------------------------------------------------
# Three read-only reference layers. No stored procedure ever inserts or
# updates them (checked: no INSERT/UPDATE against pgcil, hydelpowerstations
# or pgcillines anywhere in script_utf8.sql), and no .aspx page edits them -
# only MapView.aspx references them, for display. So: models and endpoints
# only, no create/update/delete service methods.
#
# All three legacy tables already use unbounded text/double precision with
# no varchar declared, except hydelpowerstations which does declare real
# widths - both are mirrored exactly here rather than guessed.
# ---------------------------------------------------------------------------


class PgcilSubstation(Base):
    """legacy_raw.pgcil (6 rows). Interstate PGCIL interconnection points -
    names match existing TGTransco substations (e.g. Dichpally, Ghanapur),
    so this flags which substations carry a PGCIL presence rather than
    describing a separate network. No natural PK in the source."""

    __tablename__ = "pgcil_substation"

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    voltage: Mapped[str | None] = mapped_column(Text)
    name: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(
        Geography("POINT", srid=4326, spatial_index=False)
    )


class HydelPowerStation(Base):
    """legacy_raw.hydelpowerstations (11 rows)."""

    __tablename__ = "hydel_power_station"

    hydel_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    name: Mapped[str | None] = mapped_column(String(255))
    gen_cap_mw: Mapped[float | None] = mapped_column(Numeric(10, 2))
    connected_ss: Mapped[str | None] = mapped_column(String(100))
    volt_level: Mapped[str | None] = mapped_column(String(10))
    division: Mapped[str | None] = mapped_column(String(100))
    circle: Mapped[str | None] = mapped_column(String(50))
    zone: Mapped[str | None] = mapped_column(String(100))
    location: Mapped[str | None] = mapped_column(
        Geography("POINT", srid=4326, spatial_index=False)
    )


class PgcilLine(Base):
    """legacy_raw.pgcillines (1,959 rows). Tower-like points along PGCIL
    corridors, but the source has NO ordering column of any kind - not
    even a location_no, let alone the seq_no equivalent on gis.tower.
    Rendered as points, not a route: nothing in the legacy map draws
    polylines, and there is zero signal here to order a route by, unlike
    the substation-boundary case where at least a stored point order
    existed to validate or reject."""

    __tablename__ = "pgcil_line"

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    feeder_name: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(
        Geography("POINT", srid=4326, spatial_index=False)
    )
