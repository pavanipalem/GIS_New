from __future__ import annotations

import json

from fastapi import HTTPException, status
from geoalchemy2 import Geography, Geometry
from sqlalchemy import cast, func, or_, select
from sqlalchemy.orm import Session

from app.models.ehv_consumer import EhvConsumer
from app.models.line import Line
from app.models.pgcil import (
    HydelPowerStation,
    PgcilLine,
    PgcilSubstation,
    ThermalPowerStation,
)
from app.models.solar_plant import SolarPlant
from app.models.substation import Substation
from app.models.tower import Tower
from app.schemas.map import (
    CountByCategory,
    LayerCounts,
    EhvConsumerMarker,
    HydelPowerStationMarker,
    LineFeature,
    MapPoint,
    PgcilLineMarker,
    PgcilSubstationMarker,
    SolarPlantMarker,
    SubstationEndpoints,
    SubstationLookup,
    SubstationMarker,
    ThermalPowerStationMarker,
    TowerMarker,
)

# Substation types the legacy map excludes from every voltage-filtered view
# (GetMapData flags 1-8: "ss_type not in ('LIS','LI','WW')"). The lookup/
# search flag (10) does NOT apply this filter, so list_substation_lookup
# below deliberately does not either - that split is preserved from the
# legacy proc, not invented here.
_EXCLUDED_SS_TYPES = ("LIS", "LI", "WW")


def _lat(col):
    return func.ST_Y(cast(col, Geometry)).label("lat")


def _lng(col):
    return func.ST_X(cast(col, Geometry)).label("lng")


# --------------------------------------------------------------- substations
def list_substations(
    db: Session, volt_class: str | None = None, category: str = "transco"
) -> list[SubstationMarker]:
    """category mirrors the legacy panel's split.

    "transco" excludes ss_type LIS/LI/WW, exactly as GetMapData flags 1-8 did.
    "lis_ww" is the complement, which the panel lists as its own group with its
    own counts. "all" applies no type filter.
    """
    stmt = (
        select(
            Substation.ss_code, Substation.ss_name, Substation.ss_type,
            Substation.volt_class, Substation.no_of_ptrs, Substation.ss_doc,
            Substation.primary_mva_cap, Substation.district, Substation.zone,
            Substation.circle, Substation.division,
            Substation.link_sld, Substation.link_ss_photo,
            _lat(Substation.location), _lng(Substation.location),
        )
        .where(Substation.location.isnot(None))
    )
    if category == "transco":
        stmt = stmt.where(
            or_(Substation.ss_type.notin_(_EXCLUDED_SS_TYPES), Substation.ss_type.is_(None))
        )
    elif category == "lis_ww":
        stmt = stmt.where(Substation.ss_type.in_(_EXCLUDED_SS_TYPES))
    if volt_class:
        stmt = stmt.where(Substation.volt_class == volt_class)
    return [SubstationMarker(**row._mapping) for row in db.execute(stmt)]


def substation_summary(db: Session) -> list[CountByCategory]:
    stmt = (
        select(Substation.volt_class, func.count(Substation.ss_code))
        .where(Substation.ss_type.notin_(_EXCLUDED_SS_TYPES))
        .group_by(Substation.volt_class)
        .order_by(Substation.volt_class)
    )
    return [CountByCategory(category=c or "unknown", count=n) for c, n in db.execute(stmt)]


def list_substation_lookup(db: Session) -> list[SubstationLookup]:
    stmt = (
        select(
            Substation.ss_code,
            func.coalesce(Substation.ss_name, "")
            .concat(" ")
            .concat(func.coalesce(Substation.volt_class, ""))
            .label("title"),
            _lat(Substation.location), _lng(Substation.location),
        )
        .where(Substation.location.isnot(None))
    )
    return [SubstationLookup(**row._mapping) for row in db.execute(stmt)]


# ---------------------------------------------------------------- solar/ehv
def list_solar_plants(db: Session) -> list[SolarPlantMarker]:
    stmt = select(
        SolarPlant.solar_id, SolarPlant.plant_name, SolarPlant.installed_capacity_mw,
        SolarPlant.interfacing_ss, _lat(SolarPlant.location), _lng(SolarPlant.location),
    ).where(SolarPlant.location.isnot(None))
    return [SolarPlantMarker(**row._mapping) for row in db.execute(stmt)]


def list_ehv_consumers(db: Session) -> list[EhvConsumerMarker]:
    stmt = select(
        EhvConsumer.ehv_id, EhvConsumer.name, EhvConsumer.installed_capacity_mw,
        EhvConsumer.substation, EhvConsumer.feeder_id,
        _lat(EhvConsumer.location), _lng(EhvConsumer.location),
    ).where(EhvConsumer.location.isnot(None))
    return [EhvConsumerMarker(**row._mapping) for row in db.execute(stmt)]


# --------------------------------------------------------------------- lines
def list_lines(
    db: Session, volt_class: str | None = None, underground: bool | None = None
) -> list[LineFeature]:
    stmt = select(
        Line.feeder_id, Line.feeder_name, Line.volt_class,
        Line.from_substation, Line.to_substation, Line.tower_count, Line.length_ckm,
        Line.is_underground,
        func.ST_AsGeoJSON(cast(Line.route, Geometry)).label("geojson"),
    ).where(Line.route.isnot(None))
    if volt_class:
        stmt = stmt.where(Line.volt_class == volt_class)
    if underground is not None:
        stmt = stmt.where(Line.is_underground.is_(underground))

    out = []
    for row in db.execute(stmt):
        m = row._mapping
        coords = json.loads(m["geojson"])["coordinates"]  # GeoJSON is [lng, lat]
        path = [MapPoint(lat=c[1], lng=c[0]) for c in coords]
        out.append(LineFeature(**{k: v for k, v in m.items() if k != "geojson"}, path=path))
    return out


# -------------------------------------------------------------------- towers
# A viewport at the zoom where towers become useful holds a few hundred of
# them. This cap exists so a request for a whole-state bbox fails loudly
# instead of quietly serving 100k rows into the browser.
MAX_TOWERS_PER_REQUEST = 5000


def list_towers(
    db: Session,
    feeder_id: int | None = None,
    near_lat: float | None = None,
    near_lng: float | None = None,
    radius_km: float | None = None,
    bbox: tuple[float, float, float, float] | None = None,
) -> list[TowerMarker]:
    """Towers are never returned unfiltered - 105k rows would flood the map.
    Exactly one of three scopes: a feeder, a point + radius, or a viewport
    bbox (west, south, east, north).
    """
    scopes = [feeder_id is not None, radius_km is not None, bbox is not None]
    if sum(scopes) != 1:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Provide exactly one of: feeder_id, near_lat+near_lng+radius_km, or bbox",
        )
    if radius_km is not None and (near_lat is None or near_lng is None):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "radius_km requires near_lat and near_lng"
        )

    stmt = (
        select(
            Tower.tower_id,
            Tower.feeder_id,
            Tower.seq_no,
            Tower.location_no,
            Tower.tower_type,
            Tower.telecom_joint_box,
            Tower.additional_info,
            _lat(Tower.location),
            _lng(Tower.location),
            Line.volt_class.label("line_volt_class"),
            Line.feeder_name.label("line_feeder_name"),
            Line.length_ckm.label("line_length_ckm"),
            Line.tower_count.label("line_tower_count"),
            Line.circuit_type.label("line_circuit_type"),
            Line.conductor_type.label("line_conductor_type"),
            Line.date_of_charging.label("line_date_of_charging"),
        )
        # outer join: an orphan tower (feeder_id pointing at no line) still
        # renders, just without line context
        .outerjoin(Line, Tower.feeder_id == Line.feeder_id)
        .where(Tower.location.isnot(None))
    )

    if feeder_id is not None:
        stmt = stmt.where(Tower.feeder_id == feeder_id).order_by(Tower.seq_no)
    elif radius_km is not None:
        point = func.ST_SetSRID(func.ST_MakePoint(near_lng, near_lat), 4326)
        stmt = stmt.where(
            func.ST_DWithin(Tower.location, cast(point, Geography), radius_km * 1000)
        ).limit(MAX_TOWERS_PER_REQUEST + 1)
    else:
        west, south, east, north = bbox  # type: ignore[misc]
        envelope = func.ST_MakeEnvelope(west, south, east, north, 4326)
        stmt = (
            stmt.where(func.ST_Intersects(Tower.location, cast(envelope, Geography)))
            # seq_no order keeps a feeder's towers contiguous for the client
            .order_by(Tower.feeder_id, Tower.seq_no)
            .limit(MAX_TOWERS_PER_REQUEST + 1)
        )

    rows = [TowerMarker(**row._mapping) for row in db.execute(stmt)]
    if len(rows) > MAX_TOWERS_PER_REQUEST:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"More than {MAX_TOWERS_PER_REQUEST} towers in scope - zoom in further",
        )
    return rows


# --------------------------------------------------------- reference layers
def list_pgcil_substations(db: Session) -> list[PgcilSubstationMarker]:
    stmt = select(
        PgcilSubstation.id, PgcilSubstation.voltage, PgcilSubstation.name,
        _lat(PgcilSubstation.location), _lng(PgcilSubstation.location),
    ).where(PgcilSubstation.location.isnot(None))
    return [PgcilSubstationMarker(**row._mapping) for row in db.execute(stmt)]


def list_hydel_power_stations(db: Session) -> list[HydelPowerStationMarker]:
    stmt = select(
        HydelPowerStation.hydel_id, HydelPowerStation.name, HydelPowerStation.gen_cap_mw,
        HydelPowerStation.connected_ss,
        _lat(HydelPowerStation.location), _lng(HydelPowerStation.location),
    ).where(HydelPowerStation.location.isnot(None))
    return [HydelPowerStationMarker(**row._mapping) for row in db.execute(stmt)]


def list_pgcil_lines(db: Session) -> list[PgcilLineMarker]:
    stmt = select(
        PgcilLine.id, PgcilLine.feeder_name,
        _lat(PgcilLine.location), _lng(PgcilLine.location),
    ).where(PgcilLine.location.isnot(None))
    return [PgcilLineMarker(**row._mapping) for row in db.execute(stmt)]


def list_thermal_power_stations(db: Session) -> list[ThermalPowerStationMarker]:
    stmt = select(
        ThermalPowerStation.thermal_id, ThermalPowerStation.name,
        ThermalPowerStation.gen_cap_mw, ThermalPowerStation.connected_ss,
        _lat(ThermalPowerStation.location), _lng(ThermalPowerStation.location),
    ).where(ThermalPowerStation.location.isnot(None))
    return [ThermalPowerStationMarker(**row._mapping) for row in db.execute(stmt)]


def _counts_by_volt(stmt) -> list[CountByCategory]:
    return [CountByCategory(category=c or "unknown", count=n) for c, n in stmt]


def layer_counts(db: Session) -> LayerCounts:
    """Everything the map panel needs to label its layers, in one call."""
    transco = db.execute(
        select(Substation.volt_class, func.count(Substation.ss_code))
        .where(or_(Substation.ss_type.notin_(_EXCLUDED_SS_TYPES), Substation.ss_type.is_(None)))
        .group_by(Substation.volt_class).order_by(Substation.volt_class.desc())
    )
    lis_ww = db.execute(
        select(Substation.volt_class, func.count(Substation.ss_code))
        .where(Substation.ss_type.in_(_EXCLUDED_SS_TYPES))
        .group_by(Substation.volt_class).order_by(Substation.volt_class.desc())
    )
    lines = db.execute(
        select(Line.volt_class, func.count(Line.feeder_id))
        .group_by(Line.volt_class).order_by(Line.volt_class.desc())
    )
    ug = db.execute(
        select(Line.volt_class, func.count(Line.feeder_id))
        .where(Line.is_underground.is_(True))
        .group_by(Line.volt_class).order_by(Line.volt_class.desc())
    )
    one = lambda model, col: db.scalar(select(func.count(col)).select_from(model)) or 0  # noqa: E731

    return LayerCounts(
        substations_transco=_counts_by_volt(transco),
        substations_lis_ww=_counts_by_volt(lis_ww),
        lines=_counts_by_volt(lines),
        underground_lines=_counts_by_volt(ug),
        pgcil_substations=one(PgcilSubstation, PgcilSubstation.id),
        pgcil_lines=one(PgcilLine, PgcilLine.id),
        solar_plants=one(SolarPlant, SolarPlant.solar_id),
        hydel_stations=one(HydelPowerStation, HydelPowerStation.hydel_id),
        thermal_stations=one(ThermalPowerStation, ThermalPowerStation.thermal_id),
        ehv_consumers=one(EhvConsumer, EhvConsumer.ehv_id),
    )


def line_endpoints(db: Session, volt_class: str | None = None) -> SubstationEndpoints:
    """Distinct From / To values, for the line filter dropdowns.

    Ports GetMapData flag 2, which returned the same list for both ends by
    unioning them. Kept as two lists so the two dropdowns can differ.
    """
    def distinct(col):
        stmt = select(func.distinct(func.btrim(col))).where(col.isnot(None), func.btrim(col) != "")
        if volt_class:
            stmt = stmt.where(Line.volt_class == volt_class)
        return sorted(db.scalars(stmt.order_by(func.btrim(col))).all())

    return SubstationEndpoints(
        from_substations=distinct(Line.from_substation),
        to_substations=distinct(Line.to_substation),
    )
