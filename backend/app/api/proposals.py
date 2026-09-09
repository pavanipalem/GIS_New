from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.schemas.proposal import NearbyResult
from app.services import proposal_service

router = APIRouter(
    prefix="/proposals", tags=["proposals"], dependencies=[Depends(get_current_user)]
)


@router.get("/nearby", response_model=NearbyResult)
def nearby(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    radius_km: float = Query(default=20, gt=0, le=50),
    volt_class: list[str] | None = Query(
        default=None,
        description="132 / 220 / 400, repeatable. Omitted means all three.",
    ),
    db: Session = Depends(get_db),
):
    """Existing substations, lines and UG cables within `radius_km` of the
    point - the context for siting a proposed substation. Line routes are
    clipped to the circle."""
    return proposal_service.nearby(db, lat, lng, radius_km, volt_class)
