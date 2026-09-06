from __future__ import annotations

import json

from fastapi import HTTPException, status
from geoalchemy2 import Geometry
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.legacy_parse import parse_legacy_date, parse_legacy_year, tnull
from app.models.substation import Substation, SubstationEquipment, Transformer
from app.schemas.map import MapPoint
from app.schemas.substation import (
    EquipmentIn,
    EquipmentOut,
    SubstationCreate,
    SubstationDetail,
    SubstationFields,
    SubstationListItem,
    SubstationPage,
    SubstationUpdate,
    TransformerIn,
    TransformerOut,
)

# ---------------------------------------------------------------------------
# Ports InsertSubstationData. Behaviours carried over deliberately:
#
#   - volt_class has spaces stripped (the proc did REPLACE(@volt_class,' ',''))
#   - creating a substation whose ss_code already exists is rejected rather
#     than silently updating (the proc returned 0 for that case)
#   - link_sld / link_ss_photo keep their existing value when the incoming
#     one is null, so an edit that does not touch the document links cannot
#     blank them (the proc's CASE WHEN ... IS NOT NULL THEN ... ELSE <col> END)
#
# Deliberately NOT carried over: the proc set longitude/latitude = long1/lat1,
# so the marker position was always the first boundary point and could not be
# set independently. Here `location` is its own field; when a caller supplies
# a boundary but no location, the first boundary point is used, which keeps
# existing behaviour for existing forms without locking the two together.
# ---------------------------------------------------------------------------


def _normalise_volt_class(value: str | None) -> str | None:
    v = tnull(value)
    return v.replace(" ", "") if v else None


def _point_wkt(p: MapPoint) -> str:
    return f"SRID=4326;POINT({p.lng} {p.lat})"


def _boundary_wkt(points: list[MapPoint]) -> str | None:
    """A closed ring from the supplied points, or None if they cannot form one.

    Mirrors the backfill: duplicates dropped, at least 3 distinct points
    needed, ring closed explicitly. No attempt is made to reorder points that
    self-intersect - that stays the surveyor's call, as it did during the
    migration.
    """
    seen: list[tuple[float, float]] = []
    for p in points:
        pair = (p.lng, p.lat)
        if pair not in seen:
            seen.append(pair)
    if len(seen) < 3:
        return None
    ring = [*seen, seen[0]]
    coords = ", ".join(f"{lng} {lat}" for lng, lat in ring)
    return f"SRID=4326;POLYGON(({coords}))"


def _apply_children(
    db: Session,
    substation: Substation,
    transformers: list[TransformerIn],
    equipment: list[EquipmentIn],
) -> None:
    """Replace the child rows wholesale.

    The form submits the full set of nine transformer slots every time, so a
    diff would be more machinery than it is worth - and delete-orphan on the
    relationship makes replacement safe.

    The flush between clearing and re-adding is required, not incidental:
    without it SQLAlchemy batches the INSERTs ahead of the DELETEs in one
    flush, and re-adding the same (ss_code, slot_no) trips
    uq_transformer_ss_code before the old row is gone.
    """
    substation.transformers.clear()
    substation.equipment.clear()
    db.flush()

    for t in transformers:
        substation.transformers.append(
            Transformer(
                slot_no=t.slot_no,
                capacity_mva=t.capacity_mva,
                serial_no=tnull(t.serial_no),
                make=tnull(t.make),
                vector_group=tnull(t.vector_group),
                yoc_raw=tnull(t.yoc_raw),
                year_of_commissioning=parse_legacy_date(t.yoc_raw),
                yoc_year=parse_legacy_year(t.yoc_raw),
                po_reference=tnull(t.po_reference),
                volt_level=tnull(t.volt_level),
            )
        )

    for e in equipment:
        substation.equipment.append(
            SubstationEquipment(
                kind=e.kind,
                capacity_mva=e.capacity_mva,
                serial_no=tnull(e.serial_no),
                make=tnull(e.make),
                vector_group=tnull(e.vector_group),
                yoc_raw=tnull(e.yoc_raw),
                year_of_commissioning=parse_legacy_date(e.yoc_raw),
                yoc_year=parse_legacy_year(e.yoc_raw),
                po_reference=tnull(e.po_reference),
            )
        )


def _apply_scalars(substation: Substation, data: SubstationCreate | SubstationUpdate) -> None:
    # exclude_unset so an edit that omits a field leaves it alone instead of
    # nulling it; the form sends everything, but an API client need not.
    fields = data.model_dump(
        exclude={"ss_code", "location", "boundary", "transformers", "equipment"},
        exclude_unset=True,
    )
    for name, value in fields.items():
        if name == "volt_class":
            setattr(substation, name, _normalise_volt_class(value))
        elif name in {"link_sld", "link_ss_photo"}:
            # legacy: a null incoming link leaves the stored one alone
            if value is not None:
                setattr(substation, name, tnull(value))
        elif isinstance(value, str) or value is None:
            setattr(substation, name, tnull(value) if isinstance(value, str) else value)
        else:
            setattr(substation, name, value)


def _apply_geometry(substation: Substation, data: SubstationCreate | SubstationUpdate) -> None:
    if data.boundary is not None:
        substation.boundary = _boundary_wkt(data.boundary)

    if data.location is not None:
        substation.location = _point_wkt(data.location)
    elif data.boundary:
        # legacy behaviour: with no explicit location, the first boundary
        # point is the marker position
        substation.location = _point_wkt(data.boundary[0])


# ------------------------------------------------------------------- queries
def list_substations(
    db: Session,
    q: str | None = None,
    volt_class: str | None = None,
    zone: str | None = None,
    circle: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> SubstationPage:
    transformer_count = (
        select(func.count(Transformer.id))
        .where(Transformer.ss_code == Substation.ss_code)
        .correlate(Substation)
        .scalar_subquery()
    )

    stmt = select(
        Substation.ss_code,
        Substation.ss_name,
        Substation.ss_type,
        Substation.volt_class,
        Substation.volt_levels,
        Substation.district,
        Substation.zone,
        Substation.circle,
        Substation.division,
        Substation.primary_mva_cap,
        Substation.no_of_ptrs,
        transformer_count.label("transformer_count"),
        Substation.location.isnot(None).label("has_location"),
    )

    if q:
        needle = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Substation.ss_name).like(needle),
                cast(Substation.ss_code, String).like(needle),
                func.lower(Substation.district).like(needle),
            )
        )
    if volt_class:
        stmt = stmt.where(Substation.volt_class == volt_class)
    if zone:
        stmt = stmt.where(Substation.zone == zone)
    if circle:
        stmt = stmt.where(Substation.circle == circle)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.execute(stmt.order_by(Substation.ss_code).limit(limit).offset(offset)).all()

    return SubstationPage(
        items=[SubstationListItem(**row._mapping) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


def _load(db: Session, ss_code: int) -> Substation:
    substation = db.scalar(
        select(Substation)
        .options(selectinload(Substation.transformers), selectinload(Substation.equipment))
        .where(Substation.ss_code == ss_code)
    )
    if substation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Substation {ss_code} not found")
    return substation


def _geometry_points(db: Session, ss_code: int) -> tuple[MapPoint | None, list[MapPoint] | None]:
    """Read geometry back as plain lat/lng, via GeoJSON."""
    row = db.execute(
        select(
            func.ST_AsGeoJSON(cast(Substation.location, Geometry)).label("loc"),
            func.ST_AsGeoJSON(cast(Substation.boundary, Geometry)).label("bnd"),
        ).where(Substation.ss_code == ss_code)
    ).one()

    location = None
    if row.loc:
        lng, lat = json.loads(row.loc)["coordinates"]
        location = MapPoint(lat=lat, lng=lng)

    boundary = None
    if row.bnd:
        ring = json.loads(row.bnd)["coordinates"][0]
        # drop the repeated closing point
        boundary = [MapPoint(lat=lat, lng=lng) for lng, lat in ring[:-1]]

    return location, boundary


def get_substation(db: Session, ss_code: int) -> SubstationDetail:
    substation = _load(db, ss_code)
    location, boundary = _geometry_points(db, ss_code)

    # Built explicitly rather than model_validate(substation): the ORM's
    # location/boundary are GeoAlchemy2 WKBElements, which fail validation
    # against MapPoint before the parsed values above can replace them.
    return SubstationDetail(
        ss_code=substation.ss_code,
        location=location,
        boundary=boundary,
        transformers=[TransformerOut.model_validate(t) for t in substation.transformers],
        equipment=[EquipmentOut.model_validate(e) for e in substation.equipment],
        inserted_by=substation.inserted_by,
        inserted_at=substation.inserted_at,
        updated_by=substation.updated_by,
        updated_at=substation.updated_at,
        **{name: getattr(substation, name) for name in SubstationFields.model_fields},
    )


# -------------------------------------------------------------------- writes
def create_substation(db: Session, data: SubstationCreate, username: str) -> SubstationDetail:
    exists = db.scalar(select(Substation.ss_code).where(Substation.ss_code == data.ss_code))
    if exists is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Substation {data.ss_code} already exists"
        )

    substation = Substation(ss_code=data.ss_code, inserted_by=username, inserted_at=func.now())
    _apply_scalars(substation, data)
    _apply_geometry(substation, data)
    _apply_children(db, substation, data.transformers, data.equipment)

    db.add(substation)
    db.commit()
    return get_substation(db, data.ss_code)


def update_substation(
    db: Session, ss_code: int, data: SubstationUpdate, username: str
) -> SubstationDetail:
    substation = _load(db, ss_code)
    _apply_scalars(substation, data)
    _apply_geometry(substation, data)
    _apply_children(db, substation, data.transformers, data.equipment)
    substation.updated_by = username

    db.commit()
    return get_substation(db, ss_code)
