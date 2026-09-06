from __future__ import annotations

import json
from typing import TypeVar

from fastapi import HTTPException, status
from geoalchemy2 import Geometry
from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session

from app.core.legacy_parse import parse_legacy_date, tnull
from app.models.ehv_consumer import EhvConsumer
from app.models.solar_plant import SolarPlant
from app.schemas.assets import (
    EhvConsumerFields,
    EhvConsumerOut,
    SolarPlantFields,
    SolarPlantOut,
)
from app.schemas.map import MapPoint

# ---------------------------------------------------------------------------
# Ports sp_Solarplant and sp_ehvconsumers. Both are flat CRUD - insert,
# update, delete - over small tables (57 and 127 rows), so there is no
# pagination and the list returns everything, as the procs did.
# ---------------------------------------------------------------------------

TModel = TypeVar("TModel", SolarPlant, EhvConsumer)


def _point_of(db: Session, model: type[TModel], pk_col, pk_value: int) -> MapPoint | None:
    geojson = db.scalar(
        select(func.ST_AsGeoJSON(cast(model.location, Geometry))).where(pk_col == pk_value)
    )
    if not geojson:
        return None
    lng, lat = json.loads(geojson)["coordinates"]
    return MapPoint(lat=lat, lng=lng)


def _apply(obj, data, *, exclude: set[str]) -> None:
    """Only the fields actually sent, so an omitted field is left alone
    rather than nulled - the same rule as the other write services."""
    for name, value in data.model_dump(exclude=exclude, exclude_unset=True).items():
        setattr(obj, name, tnull(value) if isinstance(value, str) else value)
    if data.location is not None:
        obj.location = f"SRID=4326;POINT({data.location.lng} {data.location.lat})"


# -------------------------------------------------------------- solar plants
def list_solar_plants(db: Session) -> list[SolarPlantOut]:
    return [
        _solar_out(db, s)
        for s in db.scalars(select(SolarPlant).order_by(SolarPlant.solar_id)).all()
    ]


def _solar_out(db: Session, s: SolarPlant) -> SolarPlantOut:
    return SolarPlantOut(
        solar_id=s.solar_id,
        commercial_operation_date=s.commercial_operation_date,
        location=_point_of(db, SolarPlant, SolarPlant.solar_id, s.solar_id),
        **{
            n: getattr(s, n)
            for n in SolarPlantFields.model_fields
            if n != "location"
        },
    )


def _load_solar(db: Session, solar_id: int) -> SolarPlant:
    obj = db.get(SolarPlant, solar_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Solar plant {solar_id} not found")
    return obj


def get_solar_plant(db: Session, solar_id: int) -> SolarPlantOut:
    return _solar_out(db, _load_solar(db, solar_id))


def _apply_solar(obj: SolarPlant, data: SolarPlantFields) -> None:
    _apply(obj, data, exclude={"location"})
    if "commercial_operation_date_raw" in data.model_dump(exclude_unset=True):
        obj.commercial_operation_date = parse_legacy_date(data.commercial_operation_date_raw)


def create_solar_plant(db: Session, data: SolarPlantFields) -> SolarPlantOut:
    obj = SolarPlant()
    _apply_solar(obj, data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _solar_out(db, obj)


def update_solar_plant(db: Session, solar_id: int, data: SolarPlantFields) -> SolarPlantOut:
    obj = _load_solar(db, solar_id)
    _apply_solar(obj, data)
    db.commit()
    return _solar_out(db, obj)


def delete_solar_plant(db: Session, solar_id: int) -> None:
    db.delete(_load_solar(db, solar_id))
    db.commit()


# ------------------------------------------------------------- EHV consumers
def list_ehv_consumers(db: Session) -> list[EhvConsumerOut]:
    return [
        _ehv_out(db, e)
        for e in db.scalars(select(EhvConsumer).order_by(EhvConsumer.ehv_id)).all()
    ]


def _ehv_out(db: Session, e: EhvConsumer) -> EhvConsumerOut:
    return EhvConsumerOut(
        ehv_id=e.ehv_id,
        location=_point_of(db, EhvConsumer, EhvConsumer.ehv_id, e.ehv_id),
        **{
            n: getattr(e, n)
            for n in EhvConsumerFields.model_fields
            if n != "location"
        },
    )


def _load_ehv(db: Session, ehv_id: int) -> EhvConsumer:
    obj = db.get(EhvConsumer, ehv_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"EHV consumer {ehv_id} not found")
    return obj


def get_ehv_consumer(db: Session, ehv_id: int) -> EhvConsumerOut:
    return _ehv_out(db, _load_ehv(db, ehv_id))


def create_ehv_consumer(db: Session, data: EhvConsumerFields) -> EhvConsumerOut:
    obj = EhvConsumer()
    _apply(obj, data, exclude={"location"})
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _ehv_out(db, obj)


def update_ehv_consumer(db: Session, ehv_id: int, data: EhvConsumerFields) -> EhvConsumerOut:
    obj = _load_ehv(db, ehv_id)
    _apply(obj, data, exclude={"location"})
    db.commit()
    return _ehv_out(db, obj)


def delete_ehv_consumer(db: Session, ehv_id: int) -> None:
    db.delete(_load_ehv(db, ehv_id))
    db.commit()
