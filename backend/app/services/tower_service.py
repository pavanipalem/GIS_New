from __future__ import annotations

import json

from fastapi import HTTPException, status
from geoalchemy2 import Geometry
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.core.legacy_parse import tnull
from app.models.line import Line
from app.models.tower import Tower
from app.schemas.map import MapPoint
from app.schemas.network import TowerCreate, TowerFields, TowerOut, TowerPage, TowerUpdate
from app.services.line_service import rebuild_route

# ---------------------------------------------------------------------------
# Ports Inserttowers-template.
#
#   - the proc refused an insert without a FEEDER_ID and returned 0; here
#     feeder_id is required by the schema, so the caller gets a 422 saying so
#   - VOLT_CLASS has spaces stripped, as the proc did
#   - tower_id is allocated by a sequence, matching the SQL Server IDENTITY
#
# Every write rebuilds the affected feeder's route. line.route is derived
# from its towers, so skipping this leaves the map drawing a stale corridor -
# the failure is silent and only visible on screen.
# ---------------------------------------------------------------------------


def _apply_fields(tower: Tower, data: TowerFields) -> None:
    """Applies only the fields actually present in the request.

    exclude_unset matters: without it, a body that omits a field sets it to
    None, so a small edit silently blanks everything it did not mention.
    feeder_id is excluded because create/update own it - letting it through
    here nulled it and quietly orphaned the tower from its line.
    """
    values = data.model_dump(exclude={"location", "feeder_id"}, exclude_unset=True)
    for name, value in values.items():
        if name == "volt_class":
            v = tnull(value)
            tower.volt_class = v.replace(" ", "") if v else None
        elif isinstance(value, str):
            setattr(tower, name, tnull(value))
        else:
            setattr(tower, name, value)

    if data.location is not None:
        tower.location = f"SRID=4326;POINT({data.location.lng} {data.location.lat})"


def _to_out(db: Session, tower: Tower) -> TowerOut:
    geojson = db.scalar(
        select(func.ST_AsGeoJSON(cast(Tower.location, Geometry))).where(
            Tower.tower_id == tower.tower_id
        )
    )
    location = None
    if geojson:
        lng, lat = json.loads(geojson)["coordinates"]
        location = MapPoint(lat=lat, lng=lng)

    return TowerOut(
        tower_id=tower.tower_id,
        feeder_id=tower.feeder_id,
        location=location,
        inserted_by=tower.inserted_by,
        inserted_at=tower.inserted_at,
        updated_by=tower.updated_by,
        **{
            name: getattr(tower, name)
            for name in TowerFields.model_fields
            if name != "location"
        },
    )


def list_towers(
    db: Session,
    feeder_id: int | None = None,
    q: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> TowerPage:
    stmt = select(Tower)
    if feeder_id is not None:
        stmt = stmt.where(Tower.feeder_id == feeder_id)
    if q:
        needle = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Tower.location_no).like(needle),
                cast(Tower.tower_id, String).like(needle),
                func.lower(Tower.tower_type).like(needle),
            )
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    towers = db.scalars(
        stmt.order_by(Tower.feeder_id, Tower.seq_no, Tower.tower_id).limit(limit).offset(offset)
    ).all()
    return TowerPage(
        items=[_to_out(db, t) for t in towers], total=total, limit=limit, offset=offset
    )


def _load(db: Session, tower_id: int) -> Tower:
    tower = db.get(Tower, tower_id)
    if tower is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Tower {tower_id} not found")
    return tower


def get_tower(db: Session, tower_id: int) -> TowerOut:
    return _to_out(db, _load(db, tower_id))


def create_tower(db: Session, data: TowerCreate, username: str) -> TowerOut:
    if db.get(Line, data.feeder_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Line {data.feeder_id} does not exist")

    tower = Tower(feeder_id=data.feeder_id, inserted_by=username, inserted_at=func.now())
    _apply_fields(tower, data)
    db.add(tower)
    db.commit()
    db.refresh(tower)

    rebuild_route(db, data.feeder_id)
    db.commit()
    return _to_out(db, tower)


def update_tower(db: Session, tower_id: int, data: TowerUpdate, username: str) -> TowerOut:
    tower = _load(db, tower_id)
    previous_feeder = tower.feeder_id

    if data.feeder_id is not None and data.feeder_id != tower.feeder_id:
        if db.get(Line, data.feeder_id) is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"Line {data.feeder_id} does not exist"
            )
        tower.feeder_id = data.feeder_id

    _apply_fields(tower, data)
    tower.updated_by = username
    db.commit()

    # both ends need rebuilding when a tower changes feeder
    for fid in {previous_feeder, tower.feeder_id} - {None}:
        rebuild_route(db, fid)  # type: ignore[arg-type]
    db.commit()

    return _to_out(db, tower)


def delete_tower(db: Session, tower_id: int) -> None:
    tower = _load(db, tower_id)
    feeder_id = tower.feeder_id
    db.delete(tower)
    db.commit()
    if feeder_id is not None:
        rebuild_route(db, feeder_id)
        db.commit()
