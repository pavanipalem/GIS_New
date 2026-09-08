"""Fault mapping: turn a reported distance-to-fault into a point on a line.

Ports Forms/FaultMappingLine.aspx.cs, with two deliberate departures that the
legacy page got wrong. Both are documented where they happen:

  * distance is geodesic on the WGS84 spheroid (PostGIS geography), not the
    R=6371 km spherical haversine the legacy used;
  * which end of the line to measure from is decided by comparing the route's
    own end points against the two substations' coordinates, not by trusting
    the From/To text columns.
"""

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.orm import Session

from app.models.line import Line
from app.schemas.fault import FaultLocation, FaultTower
from app.schemas.map import MapPoint

# How close the route's end has to be to a substation before we believe the
# match. Gantries sit inside the yard, so a few hundred metres is normal; the
# wrong substation is typically kilometres away (the reversed lines measured
# during verification were 12-32 km out).
_END_MATCH_TOLERANCE_M = 3000.0


def _resolve_line(
    db: Session,
    volt_class: str | None,
    from_substation: str | None,
    to_substation: str | None,
    feeder_id: int | None,
) -> Line:
    """The single line the search identifies, or a 400 explaining why not.

    Mirrors the legacy 'more than one line found' guard: fault mapping is
    meaningless until exactly one line is selected.

    The pair is matched in either direction. The legacy page only ever
    offered stored From values in its first dropdown, so its own reversal
    branch could not be reached - picking the far substation as the source,
    which is the whole point of that branch, was impossible. Here A-B and B-A
    both resolve to the same line and the source end is taken from
    `measured_from`.
    """
    stmt = select(Line).where(Line.route.isnot(None))
    if feeder_id is not None:
        stmt = stmt.where(Line.feeder_id == feeder_id)
    else:
        if volt_class:
            stmt = stmt.where(Line.volt_class == volt_class)
        a = from_substation.strip() if from_substation else None
        b = to_substation.strip() if to_substation else None
        _from, _to = func.btrim(Line.from_substation), func.btrim(Line.to_substation)
        if a and b:
            stmt = stmt.where(
                or_(and_(_from == a, _to == b), and_(_from == b, _to == a))
            )
        elif a:
            stmt = stmt.where(or_(_from == a, _to == a))
        elif b:
            stmt = stmt.where(or_(_from == b, _to == b))

    lines = db.scalars(stmt.limit(3)).all()
    if not lines:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No transmission line with a mapped route matches that selection.",
        )
    if len(lines) > 1:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "More than one line matches. Select the voltage class, From and To exactly.",
        )
    return lines[0]


def _route_direction(db: Session, line: Line) -> tuple[str | None, str | None, bool]:
    """Which substation the stored tower order actually starts at.

    Returns (start_substation_name, note, verified).

    The legacy page assumed the tower numbering always runs from the FROM
    column to the TO column, and reversed the chain whenever the user's
    chosen source did not equal the FROM text. Measured against the data that
    assumption holds for only about 61% of lines: on the 203 feeders whose
    both end-substation names resolve unambiguously, 123 run FROM -> TO and
    80 run TO -> FROM, and 79 of those 80 have both route ends within 2 km of
    the substation the text says is at the other end. Feeder 6,
    "132 KV Bandlaguda-Ghanapur", starts 90 m from Ghanapur (the TO) and ends
    23 m from Bandlaguda (the FROM).

    So the direction is taken from the geometry when the names resolve, and
    only falls back to the text columns when they do not.
    """
    # One query: how far the route's first point is from each named end
    # substation. A name that repeats across voltage classes (32 of them do)
    # takes its nearest row, which is the one on this corridor.
    row = db.execute(
        text(
            """
            WITH r AS (
                SELECT ST_StartPoint(route::geometry)::geography AS sp
                FROM gis.line WHERE feeder_id = :fid
            )
            SELECT
              (SELECT min(ST_Distance(r.sp, s.location))
                 FROM gis.substation s, r
                WHERE s.location IS NOT NULL
                  AND btrim(s.ss_name) = btrim(:from_name)) AS d_from,
              (SELECT min(ST_Distance(r.sp, s.location))
                 FROM gis.substation s, r
                WHERE s.location IS NOT NULL
                  AND btrim(s.ss_name) = btrim(:to_name)) AS d_to
            """
        ),
        {
            "fid": line.feeder_id,
            "from_name": line.from_substation or "",
            "to_name": line.to_substation or "",
        },
    ).one()

    d_from, d_to = row.d_from, row.d_to

    if d_from is not None and d_to is not None:
        return (
            (line.from_substation, None, True)
            if d_from <= d_to
            else (line.to_substation, None, True)
        )
    if d_from is not None and d_from <= _END_MATCH_TOLERANCE_M:
        return line.from_substation, None, True
    if d_to is not None and d_to <= _END_MATCH_TOLERANCE_M:
        return line.to_substation, None, True

    return (
        line.from_substation,
        "Neither end substation could be located by name, so the tower order is "
        "assumed to run From to To as recorded. Check the result against a known "
        "location before acting on it.",
        False,
    )


def _ordered_towers(db: Session, feeder_id: int) -> tuple[list[dict], list[float]]:
    """The feeder's towers in route order, plus the geodesic span to each one
    from the tower before it.

    The order is the one gis.rebuild_line_routes() uses to build line.route,
    so this walk and the drawn polyline cannot disagree. Both the towers and
    every span come back in a single query - a round trip per span would be
    hundreds of them on a long feeder.
    """
    rows = (
        db.execute(
            text(
                """
                WITH ordered AS (
                    SELECT t.tower_id, t.seq_no, t.location_no, t.tower_type,
                           t.telecom_joint_box, t.location,
                           row_number() OVER (
                               ORDER BY t.seq_no NULLS LAST,
                                        gis.parse_numeric(t.location_no) NULLS LAST,
                                        t.tower_id) AS rn
                    FROM gis.tower t
                    WHERE t.feeder_id = :fid AND t.location IS NOT NULL
                )
                SELECT tower_id, seq_no, location_no, tower_type, telecom_joint_box,
                       ST_Y(location::geometry) AS lat,
                       ST_X(location::geometry) AS lng,
                       COALESCE(
                           ST_Distance(location, lag(location) OVER (ORDER BY rn)),
                           0) AS step_m
                FROM ordered
                ORDER BY rn
                """
            ),
            {"fid": feeder_id},
        )
        .mappings()
        .all()
    )
    towers = [
        {k: r[k] for k in
         ("tower_id", "seq_no", "location_no", "tower_type", "telecom_joint_box", "lat", "lng")}
        for r in rows
    ]
    # step_m[i] is the span from tower i-1 to tower i; the first is 0.
    spans = [float(r["step_m"]) / 1000.0 for r in rows[1:]]
    return towers, spans


def locate_fault(
    db: Session,
    distance_km: float,
    measured_from: str,
    volt_class: str | None = None,
    from_substation: str | None = None,
    to_substation: str | None = None,
    feeder_id: int | None = None,
) -> FaultLocation:
    if distance_km < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fault distance cannot be negative.")

    line = _resolve_line(db, volt_class, from_substation, to_substation, feeder_id)
    measured_from = measured_from.strip()

    stored_from = (line.from_substation or "").strip()
    stored_to = (line.to_substation or "").strip()
    if measured_from.casefold() not in {stored_from.casefold(), stored_to.casefold()}:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"'{measured_from}' is not an end of this line. Measure from "
            f"'{stored_from}' or '{stored_to}'.",
        )

    route_starts_at, note, verified = _route_direction(db, line)
    starts_at = (route_starts_at or "").strip()

    # Reverse when the user is measuring from the far end of the stored chain.
    is_reversed = measured_from.casefold() != starts_at.casefold()

    towers, segments = _ordered_towers(db, line.feeder_id)
    if len(towers) < 2:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This line has fewer than two located towers, so a fault distance "
            "cannot be placed on it.",
        )
    if is_reversed:
        # A span is the same stretch of line whichever way it is walked, so
        # the span list reverses with the towers rather than being recomputed.
        towers.reverse()
        segments.reverse()

    # Running distance from the measuring end. The spans are geodesic on the
    # WGS84 spheroid (PostGIS geography); the legacy haversine with R=6371 km
    # matches PostGIS's *sphere* mode instead and reads 0.03-0.40% long on
    # real lines here.
    running = 0.0
    out: list[FaultTower] = [FaultTower(**towers[0], distance_km=0.0)]
    for i, seg_km in enumerate(segments):
        running += seg_km
        out.append(FaultTower(**towers[i + 1], distance_km=round(running, 6)))

    total_km = running
    if distance_km > total_km:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Fault distance {distance_km:g} km is beyond this line's mapped "
            f"length of {total_km:.3f} km (measured tower to tower from "
            f"{measured_from}).",
        )

    # The segment the fault falls in, then a proportional step into it. Over a
    # single span (a few hundred metres) the great-circle and straight-line
    # interpolations differ by millimetres, so the simple ratio is used.
    cumulative = 0.0
    idx = 0
    for i, seg_km in enumerate(segments):
        if distance_km <= cumulative + seg_km or i == len(segments) - 1:
            idx = i
            break
        cumulative += seg_km

    section_km = segments[idx]
    ratio = (distance_km - cumulative) / section_km if section_km > 0 else 0.0
    ratio = min(max(ratio, 0.0), 1.0)
    a, b = towers[idx], towers[idx + 1]
    fault_lat = a["lat"] + (b["lat"] - a["lat"]) * ratio
    fault_lng = a["lng"] + (b["lng"] - a["lng"]) * ratio

    return FaultLocation(
        feeder_id=line.feeder_id,
        feeder_name=line.feeder_name,
        volt_class=line.volt_class,
        from_substation=line.from_substation,
        to_substation=line.to_substation,
        measured_from=measured_from,
        reversed=is_reversed,
        direction_verified=verified,
        direction_note=note,
        distance_km=distance_km,
        route_length_km=round(total_km, 3),
        recorded_length_ckm=float(line.length_ckm) if line.length_ckm is not None else None,
        fault_point=MapPoint(lat=fault_lat, lng=fault_lng),
        before_tower=out[idx],
        after_tower=out[idx + 1],
        cumulative_km_before=round(cumulative, 3),
        section_km=round(section_km, 3),
        towers=out,
    )
