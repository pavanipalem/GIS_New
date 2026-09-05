from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.schemas.map import (
    CountByCategory,
    EhvConsumerMarker,
    HydelPowerStationMarker,
    LineFeature,
    PgcilLineMarker,
    PgcilSubstationMarker,
    SolarPlantMarker,
    SubstationLookup,
    SubstationMarker,
    TowerMarker,
)
from app.services import map_service

# Every layer here just needs a logged-in viewer; write access is gated
# per-resource in the substation/tower/line CRUD routers, not here.
router = APIRouter(
    prefix="/map", tags=["map"], dependencies=[Depends(get_current_user)]
)


@router.get("/substations", response_model=list[SubstationMarker])
def substations(volt_class: str | None = None, db: Session = Depends(get_db)):
    return map_service.list_substations(db, volt_class)


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
def lines(volt_class: str | None = None, db: Session = Depends(get_db)):
    return map_service.list_lines(db, volt_class)


@router.get("/towers", response_model=list[TowerMarker])
def towers(
    feeder_id: int | None = None,
    near_lat: float | None = Query(default=None, ge=-90, le=90),
    near_lng: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, gt=0, le=100),
    db: Session = Depends(get_db),
):
    return map_service.list_towers(db, feeder_id, near_lat, near_lng, radius_km)


@router.get("/pgcil-substations", response_model=list[PgcilSubstationMarker])
def pgcil_substations(db: Session = Depends(get_db)):
    return map_service.list_pgcil_substations(db)


@router.get("/hydel-power-stations", response_model=list[HydelPowerStationMarker])
def hydel_power_stations(db: Session = Depends(get_db)):
    return map_service.list_hydel_power_stations(db)


@router.get("/pgcil-lines", response_model=list[PgcilLineMarker])
def pgcil_lines(db: Session = Depends(get_db)):
    return map_service.list_pgcil_lines(db)
