from __future__ import annotations

import json

from fastapi import HTTPException, status
from geoalchemy2 import Geometry
from sqlalchemy import String, cast, func, or_, select, text
from sqlalchemy.orm import Session

from app.core.legacy_parse import parse_legacy_date, tnull
from app.models.line import Line
from app.models.tower import Tower
from app.schemas.map import MapPoint
from app.schemas.network import (
    LineCreate,
    LineDetail,
    LineFields,
    LineListItem,
    LinePage,
    LineUpdate,
)

# ---------------------------------------------------------------------------
# Ports Insertlines-template.
#
#   - VOLT_CLASS has spaces stripped, as the proc did
#   - the proc refused an insert unless FROM and TO were both present and
#     returned 0; here they are required by the schema, so the caller gets a
#     422 explaining why instead of a silent no-op
#   - feeder_id is allocated by a sequence, matching the SQL Server IDENTITY
#
# Dates are parsed where possible and the original text is always kept - see
# migration 0007 for why that matters.
# ---------------------------------------------------------------------------


def rebuild_route(db: Session, feeder_id: int) -> None:
    """line.route is derived from the feeder's towers, so it goes stale the
    moment a tower moves. Called after every tower write."""
    db.execute(text("SELECT gis.rebuild_line_routes(:fid)"), {"fid": feeder_id})


def _apply_fields(line: Line, data: LineFields) -> None:
    """Only the fields actually sent - see the note in tower_service for why
    exclude_unset is load-bearing rather than a tidy-up."""
    for name, value in data.model_dump(exclude_unset=True).items():
        if name == "volt_class":
            v = tnull(value)
            line.volt_class = v.replace(" ", "") if v else None
        elif name == "date_of_charging_raw":
            line.date_of_charging_raw = tnull(value)
            line.date_of_charging = parse_legacy_date(value)
        elif name == "last_maintenance_date_raw":
            line.last_maintenance_date_raw = tnull(value)
            line.last_maintenance_date = parse_legacy_date(value)
        elif isinstance(value, str):
            setattr(line, name, tnull(value))
        else:
            setattr(line, name, value)


def list_lines(
    db: Session,
    q: str | None = None,
    volt_class: str | None = None,
    zone: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> LinePage:
    stmt = select(
        Line.feeder_id,
        Line.feeder_name,
        Line.volt_class,
        Line.from_substation,
        Line.to_substation,
        Line.length_ckm,
        Line.tower_count,
        Line.zone,
        Line.circle,
        Line.route.isnot(None).label("has_route"),
    )
    if q:
        needle = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Line.feeder_name).like(needle),
                cast(Line.feeder_id, String).like(needle),
                func.lower(Line.from_substation).like(needle),
                func.lower(Line.to_substation).like(needle),
            )
        )
    if volt_class:
        stmt = stmt.where(Line.volt_class == volt_class)
    if zone:
        stmt = stmt.where(Line.zone == zone)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.execute(stmt.order_by(Line.feeder_id).limit(limit).offset(offset)).all()
    return LinePage(
        items=[LineListItem(**r._mapping) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


def _load(db: Session, feeder_id: int) -> Line:
    line = db.get(Line, feeder_id)
    if line is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Line {feeder_id} not found")
    return line


def get_line(db: Session, feeder_id: int) -> LineDetail:
    line = _load(db, feeder_id)
    geojson = db.scalar(
        select(func.ST_AsGeoJSON(cast(Line.route, Geometry))).where(Line.feeder_id == feeder_id)
    )
    route = None
    if geojson:
        route = [MapPoint(lat=lat, lng=lng) for lng, lat in json.loads(geojson)["coordinates"]]

    # built explicitly: route on the ORM object is a WKBElement, which would
    # fail validation against list[MapPoint]
    return LineDetail(
        feeder_id=line.feeder_id,
        route=route,
        date_of_charging=line.date_of_charging,
        last_maintenance_date=line.last_maintenance_date,
        tower_count=line.tower_count,
        inserted_by=line.inserted_by,
        inserted_at=line.inserted_at,
        updated_by=line.updated_by,
        updated_at=line.updated_at,
        **{name: getattr(line, name) for name in LineFields.model_fields},
    )


def create_line(db: Session, data: LineCreate, username: str) -> LineDetail:
    line = Line(inserted_by=username, inserted_at=func.now())
    _apply_fields(line, data)
    db.add(line)
    db.commit()
    db.refresh(line)
    return get_line(db, line.feeder_id)


def update_line(db: Session, feeder_id: int, data: LineUpdate, username: str) -> LineDetail:
    line = _load(db, feeder_id)
    _apply_fields(line, data)
    line.updated_by = username
    line.updated_at = func.now()
    db.commit()
    return get_line(db, feeder_id)


def delete_line(db: Session, feeder_id: int) -> None:
    """Towers on the line are not deleted - the FK is ON DELETE SET NULL, so
    they survive as unassigned rather than disappearing with the line."""
    line = _load(db, feeder_id)
    db.delete(line)
    db.commit()


def line_tower_count(db: Session, feeder_id: int) -> int:
    return db.scalar(
        select(func.count(Tower.tower_id)).where(Tower.feeder_id == feeder_id)
    ) or 0
