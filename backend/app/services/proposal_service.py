"""Backing queries for the New Proposals page.

`nearby` answers one question: given a point and a radius, what existing
network is close enough to matter for a proposed substation - every
substation inside the circle, and every transmission line or UG cable that
enters it, with each line's route clipped to the circle so the map shows
only what falls within the radius.
"""

from __future__ import annotations

import json

from fastapi import HTTPException, status
from geoalchemy2 import Geography, Geometry
from sqlalchemy import cast, func, select, text
from sqlalchemy.orm import Session

from app.models.substation import Substation
from app.schemas.map import MapPoint, SubstationMarker
from app.schemas.proposal import NearbyLine, NearbyResult

VALID_VOLT_CLASSES = ("132", "220", "400")
MAX_RADIUS_KM = 50.0


def _segments(gj: dict) -> list[list[MapPoint]]:
    """Flatten whatever ST_Intersection returned (LineString, MultiLineString,
    or a GeometryCollection when the clip also grazes a point) into a list of
    coordinate runs. GeoJSON coordinates are [lng, lat]."""
    t = gj.get("type")
    if t == "LineString":
        return [[MapPoint(lat=c[1], lng=c[0]) for c in gj["coordinates"] if len(c) >= 2]]
    if t == "MultiLineString":
        return [
            [MapPoint(lat=c[1], lng=c[0]) for c in seg if len(c) >= 2]
            for seg in gj["coordinates"]
        ]
    if t == "GeometryCollection":
        out: list[list[MapPoint]] = []
        for g in gj.get("geometries", []):
            out.extend(_segments(g))
        return out
    return []


def nearby(
    db: Session,
    lat: float,
    lng: float,
    radius_km: float,
    volt_classes: list[str] | None,
) -> NearbyResult:
    if not (0 < radius_km <= MAX_RADIUS_KM):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Radius must be between 0 and {MAX_RADIUS_KM:g} km.",
        )
    vcs = [v for v in (volt_classes or []) if v in VALID_VOLT_CLASSES]
    if not vcs:
        vcs = list(VALID_VOLT_CLASSES)
    radius_m = radius_km * 1000.0

    geog = cast(func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326), Geography)

    # ---- substations inside the circle, nearest first ------------------
    s_stmt = (
        select(
            Substation.ss_code, Substation.ss_name, Substation.ss_type,
            Substation.volt_class, Substation.no_of_ptrs, Substation.ss_doc,
            Substation.primary_mva_cap, Substation.district, Substation.zone,
            Substation.circle, Substation.division,
            Substation.link_sld, Substation.link_ss_photo,
            func.ST_Y(cast(Substation.location, Geometry)).label("lat"),
            func.ST_X(cast(Substation.location, Geometry)).label("lng"),
        )
        .where(Substation.location.isnot(None))
        .where(Substation.volt_class.in_(vcs))
        .where(func.ST_DWithin(Substation.location, geog, radius_m))
        .order_by(func.ST_Distance(Substation.location, geog))
    )
    substations = [SubstationMarker(**r._mapping) for r in db.execute(s_stmt)]

    # ---- lines + UG cables, route clipped to the circle ---------------
    rows = (
        db.execute(
            text(
                """
                WITH circle AS (
                    SELECT ST_Buffer(
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                        :radius_m
                    )::geometry AS g
                )
                SELECT l.feeder_id, l.feeder_name, l.volt_class,
                       l.from_substation, l.to_substation, l.length_ckm,
                       l.is_underground,
                       ST_AsGeoJSON(ST_Intersection(l.route::geometry, circle.g)) AS clipped
                FROM gis.line l, circle
                WHERE l.route IS NOT NULL
                  AND l.volt_class = ANY(:vcs)
                  AND ST_Intersects(l.route::geometry, circle.g)
                ORDER BY ST_Distance(
                    l.route,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                )
                """
            ),
            {"lat": lat, "lng": lng, "radius_m": radius_m, "vcs": vcs},
        )
        .mappings()
        .all()
    )

    lines: list[NearbyLine] = []
    for row in rows:
        segs = _segments(json.loads(row["clipped"]))
        segs = [s for s in segs if len(s) >= 2]
        if not segs:
            continue
        lines.append(
            NearbyLine(
                feeder_id=row["feeder_id"],
                feeder_name=row["feeder_name"],
                volt_class=row["volt_class"],
                from_substation=row["from_substation"],
                to_substation=row["to_substation"],
                length_ckm=(
                    float(row["length_ckm"]) if row["length_ckm"] is not None else None
                ),
                is_underground=row["is_underground"],
                segments=segs,
            )
        )

    return NearbyResult(
        center=MapPoint(lat=lat, lng=lng),
        radius_km=radius_km,
        volt_classes=vcs,
        substations=substations,
        lines=lines,
    )
