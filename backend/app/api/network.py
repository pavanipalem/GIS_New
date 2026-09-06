from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, require_editor
from app.models.user import User
from app.schemas.network import (
    LineCreate,
    LineDetail,
    LinePage,
    LineUpdate,
    TowerCreate,
    TowerOut,
    TowerPage,
    TowerUpdate,
)
from app.services import line_service, tower_service

lines_router = APIRouter(
    prefix="/lines", tags=["lines"], dependencies=[Depends(get_current_user)]
)
towers_router = APIRouter(
    prefix="/towers", tags=["towers"], dependencies=[Depends(get_current_user)]
)


# --------------------------------------------------------------------- lines
@lines_router.get("", response_model=LinePage)
def list_lines(
    q: str | None = Query(default=None, description="Matches name, id, from or to"),
    volt_class: str | None = None,
    zone: str | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return line_service.list_lines(db, q, volt_class, zone, limit, offset)


@lines_router.get("/{feeder_id}", response_model=LineDetail)
def get_line(feeder_id: int, db: Session = Depends(get_db)):
    return line_service.get_line(db, feeder_id)


@lines_router.post("", response_model=LineDetail, status_code=status.HTTP_201_CREATED)
def create_line(
    payload: LineCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_editor),
):
    return line_service.create_line(db, payload, user.username)


@lines_router.put("/{feeder_id}", response_model=LineDetail)
def update_line(
    feeder_id: int,
    payload: LineUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_editor),
):
    return line_service.update_line(db, feeder_id, payload, user.username)


# -------------------------------------------------------------------- towers
@towers_router.get("", response_model=TowerPage)
def list_towers(
    feeder_id: int | None = None,
    q: str | None = Query(default=None, description="Matches location no, id or type"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return tower_service.list_towers(db, feeder_id, q, limit, offset)


@towers_router.get("/{tower_id}", response_model=TowerOut)
def get_tower(tower_id: int, db: Session = Depends(get_db)):
    return tower_service.get_tower(db, tower_id)


@towers_router.post("", response_model=TowerOut, status_code=status.HTTP_201_CREATED)
def create_tower(
    payload: TowerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_editor),
):
    return tower_service.create_tower(db, payload, user.username)


@towers_router.put("/{tower_id}", response_model=TowerOut)
def update_tower(
    tower_id: int,
    payload: TowerUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_editor),
):
    return tower_service.update_tower(db, tower_id, payload, user.username)


@towers_router.delete("/{tower_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tower(
    tower_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_editor),
):
    tower_service.delete_tower(db, tower_id)
