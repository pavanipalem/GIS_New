from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, require_editor
from app.schemas.assets import (
    EhvConsumerFields,
    EhvConsumerOut,
    SolarPlantFields,
    SolarPlantOut,
)
from app.services import asset_service

solar_router = APIRouter(
    prefix="/solar-plants", tags=["solar plants"], dependencies=[Depends(get_current_user)]
)
ehv_router = APIRouter(
    prefix="/ehv-consumers", tags=["ehv consumers"], dependencies=[Depends(get_current_user)]
)


# -------------------------------------------------------------- solar plants
@solar_router.get("", response_model=list[SolarPlantOut])
def list_solar_plants(db: Session = Depends(get_db)):
    return asset_service.list_solar_plants(db)


@solar_router.get("/{solar_id}", response_model=SolarPlantOut)
def get_solar_plant(solar_id: int, db: Session = Depends(get_db)):
    return asset_service.get_solar_plant(db, solar_id)


@solar_router.post(
    "", response_model=SolarPlantOut, status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_editor)],
)
def create_solar_plant(payload: SolarPlantFields, db: Session = Depends(get_db)):
    return asset_service.create_solar_plant(db, payload)


@solar_router.put(
    "/{solar_id}", response_model=SolarPlantOut, dependencies=[Depends(require_editor)]
)
def update_solar_plant(solar_id: int, payload: SolarPlantFields, db: Session = Depends(get_db)):
    return asset_service.update_solar_plant(db, solar_id, payload)


@solar_router.delete(
    "/{solar_id}", status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_editor)],
)
def delete_solar_plant(solar_id: int, db: Session = Depends(get_db)):
    asset_service.delete_solar_plant(db, solar_id)


# ------------------------------------------------------------- EHV consumers
@ehv_router.get("", response_model=list[EhvConsumerOut])
def list_ehv_consumers(db: Session = Depends(get_db)):
    return asset_service.list_ehv_consumers(db)


@ehv_router.get("/{ehv_id}", response_model=EhvConsumerOut)
def get_ehv_consumer(ehv_id: int, db: Session = Depends(get_db)):
    return asset_service.get_ehv_consumer(db, ehv_id)


@ehv_router.post(
    "", response_model=EhvConsumerOut, status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_editor)],
)
def create_ehv_consumer(payload: EhvConsumerFields, db: Session = Depends(get_db)):
    return asset_service.create_ehv_consumer(db, payload)


@ehv_router.put(
    "/{ehv_id}", response_model=EhvConsumerOut, dependencies=[Depends(require_editor)]
)
def update_ehv_consumer(ehv_id: int, payload: EhvConsumerFields, db: Session = Depends(get_db)):
    return asset_service.update_ehv_consumer(db, ehv_id, payload)


@ehv_router.delete(
    "/{ehv_id}", status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_editor)],
)
def delete_ehv_consumer(ehv_id: int, db: Session = Depends(get_db)):
    asset_service.delete_ehv_consumer(db, ehv_id)
