from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.schemas.map import (
    CountByCategory,
    LayerCounts,
    EhvConsumerMarker,
    HydelPowerStationMarker,
    LineFeature,
    PgcilLineMarker,
    PgcilSubstationMarker,
    SolarPlantMarker,
    SubstationEndpoints,
    SubstationLookup,
    SubstationMarker,
    ThermalPowerStationMarker,
    TowerMarker,
)
from app.services import map_service

# Every layer here just needs a logged-in viewer; write access is gated
# per-resource in the substation/tower/line CRUD routers, not here.
router = APIRouter(
    prefix="/map", tags=["map"], dependencies=[Depends(get_current_user)]
)


@router.get("/substations", response_model=list[SubstationMarker])
def substations(
    volt_class: str | None = None,
    category: str = Query(
        default="transco",
        pattern="^(transco|lis_ww|all)$",
        description='"transco" excludes ss_type LIS/LI/WW as the legacy map did; '
        '"lis_ww" is that group on its own',
    ),
    db: Session = Depends(get_db),
):
    return map_service.list_substations(db, volt_class, category)


@router.get("/substations/summary", response_model=list[CountByCategory])
def substations_summary(db: Session = Depends(get_db)):
    return map_service.substation_summary(db)


@router.get("/substations/lookup", response_model=list[SubstationLookup])
def substations_lookup(db: Session = Depends(get_db)):
    return map_service.list_substation_lookup(db)


@router.get("/solar-plants", response_model=list[SolarPlantMarker])
def solar_plants(db: Session = Depends(get_db)):
    return map_service.list_solar_plants(db)


@router.get("/ehv-consumers", response_model=list[EhvConsumerMarker])
def ehv_consumers(db: Session = Depends(get_db)):
    return map_service.list_ehv_consumers(db)


@router.get("/lines", response_model=list[LineFeature])
def lines(
    volt_class: str | None = None,
    underground: bool | None = Query(
        default=None, description="Filter to (or exclude) underground cables"
    ),
    db: Session = Depends(get_db),
):
    return map_service.list_lines(db, volt_class, underground)


@router.get("/lines/endpoints", response_model=SubstationEndpoints)
def line_endpoints(volt_class: str | None = None, db: Session = Depends(get_db)):
    """Distinct From / To values for the line filter dropdowns."""
    return map_service.line_endpoints(db, volt_class)


@router.get("/layer-counts", response_model=LayerCounts)
def layer_counts(db: Session = Depends(get_db)):
    """Every count the map panel shows beside a layer name, in one call."""
    return map_service.layer_counts(db)


@router.get("/thermal-power-stations", response_model=list[ThermalPowerStationMarker])
def thermal_power_stations(db: Session = Depends(get_db)):
    return map_service.list_thermal_power_stations(db)


@router.get("/towers", response_model=list[TowerMarker])
def towers(
    feeder_id: int | None = None,
    near_lat: float | None = Query(default=None, ge=-90, le=90),
    near_lng: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, gt=0, le=100),
    bbox: str | None = Query(
        default=None,
        description="Viewport as west,south,east,north in WGS84 degrees",
        examples=["78.3,17.2,78.7,17.6"],
    ),
    db: Session = Depends(get_db),
):
    parsed_bbox: tuple[float, float, float, float] | None = None
    if bbox is not None:
        try:
            west, south, east, north = (float(p) for p in bbox.split(","))
        except ValueError:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "bbox must be west,south,east,north"
            ) from None
        if not (-180 <= west <= 180 and -180 <= east <= 180):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "bbox longitudes out of range")
        if not (-90 <= south <= 90 and -90 <= north <= 90):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "bbox latitudes out of range")
        if west >= east or south >= north:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "bbox must be west<east and south<north"
            )
        parsed_bbox = (west, south, east, north)

    return map_service.list_towers(db, feeder_id, near_lat, near_lng, radius_km, parsed_bbox)


@router.get("/pgcil-substations", response_model=list[PgcilSubstationMarker])
def pgcil_substations(db: Session = Depends(get_db)):
    return map_service.list_pgcil_substations(db)


@router.get("/hydel-power-stations", response_model=list[HydelPowerStationMarker])
def hydel_power_stations(db: Session = Depends(get_db)):
    return map_service.list_hydel_power_stations(db)


@router.get("/pgcil-lines", response_model=list[PgcilLineMarker])
def pgcil_lines(db: Session = Depends(get_db)):
    return map_service.list_pgcil_lines(db)
