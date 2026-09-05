from __future__ import annotations

from geoalchemy2 import Geography
from sqlalchemy import ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.line import Line

# Normalized rebuild of legacy_raw."ehvconsumers" (18 columns, mostly text).


class EhvConsumer(Base):
    __tablename__ = "ehv_consumer"

    ehv_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)

    name: Mapped[str | None] = mapped_column(Text)
    location_desc: Mapped[str | None] = mapped_column(Text)
    installed_capacity_mw: Mapped[float | None] = mapped_column(Numeric(10, 2))

    location: Mapped[str | None] = mapped_column(
        Geography("POINT", srid=4326, spatial_index=False)
    )

    feeder_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("line.feeder_id", ondelete="SET NULL"), index=True
    )
    feeder_name: Mapped[str | None] = mapped_column(Text)
    substation: Mapped[str | None] = mapped_column(Text)
    consumer_code: Mapped[str | None] = mapped_column(String(100))
    voltage_rate: Mapped[str | None] = mapped_column(String(50))
    function_loc_code: Mapped[str | None] = mapped_column(String(100))
    connected_ss: Mapped[str | None] = mapped_column(Text)
    line_name: Mapped[str | None] = mapped_column(Text)
    line_code: Mapped[str | None] = mapped_column(String(100))

    division: Mapped[str | None] = mapped_column(String(100))
    circle: Mapped[str | None] = mapped_column(String(100))
    zone: Mapped[str | None] = mapped_column(String(100))

    line: Mapped[Line | None] = relationship()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<EhvConsumer {self.ehv_id} {self.name!r}>"
