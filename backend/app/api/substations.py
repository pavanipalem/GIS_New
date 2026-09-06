from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, require_editor
from app.models.user import User
from app.schemas.substation import (
    SubstationCreate,
    SubstationDetail,
    SubstationPage,
    SubstationUpdate,
)
from app.services import substation_service

# Reads need any signed-in user; writes need editor or admin.
router = APIRouter(
    prefix="/substations",
    tags=["substations"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=SubstationPage)
def list_substations(
    q: str | None = Query(default=None, description="Matches name, code or district"),
    volt_class: str | None = None,
    zone: str | None = None,
    circle: str | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return substation_service.list_substations(db, q, volt_class, zone, circle, limit, offset)


@router.get("/{ss_code}", response_model=SubstationDetail)
def get_substation(ss_code: int, db: Session = Depends(get_db)):
    return substation_service.get_substation(db, ss_code)


@router.post("", response_model=SubstationDetail, status_code=status.HTTP_201_CREATED)
def create_substation(
    payload: SubstationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_editor),
):
    return substation_service.create_substation(db, payload, user.username)


@router.put("/{ss_code}", response_model=SubstationDetail)
def update_substation(
    ss_code: int,
    payload: SubstationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_editor),
):
    return substation_service.update_substation(db, ss_code, payload, user.username)
