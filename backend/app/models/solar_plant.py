from __future__ import annotations

from datetime import date, datetime

from geoalchemy2 import Geography
from sqlalchemy import Date, DateTime, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

# Normalized rebuild of legacy_raw."Solar Plants" (12 columns, mostly text).
# solar_id is the only column with a real type in the legacy schema; kept as PK.


class SolarPlant(Base):
    __tablename__ = "solar_plant"

    solar_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)

    plant_name: Mapped[str | None] = mapped_column(Text)
    location_desc: Mapped[str | None] = mapped_column(Text)
    installed_capacity_mw: Mapped[float | None] = mapped_column(Numeric(10, 2))
    interfacing_ss: Mapped[str | None] = mapped_column(Text)
    voltage_level: Mapped[str | None] = mapped_column(String(50))
    commercial_operation_date: Mapped[date | None] = mapped_column(Date)

    location: Mapped[str | None] = mapped_column(
        Geography("POINT", srid=4326, spatial_index=False)
    )

    division: Mapped[str | None] = mapped_column(String(100))
    circle: Mapped[str | None] = mapped_column(String(100))
    zone: Mapped[str | None] = mapped_column(String(100))

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SolarPlant {self.solar_id} {self.plant_name!r}>"
