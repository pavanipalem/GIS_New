from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.schemas.fault import FaultLocation
from app.services import fault_service

router = APIRouter(
    prefix="/fault", tags=["fault"], dependencies=[Depends(get_current_user)]
)


@router.get("/locate", response_model=FaultLocation)
def locate(
    distance_km: float = Query(ge=0, description="Distance to fault, from the source end"),
    measured_from: str = Query(
        description="The substation the distance is measured from - must be one "
        "of the line's two ends"
    ),
    volt_class: str | None = None,
    from_substation: str | None = None,
    to_substation: str | None = None,
    feeder_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Place a reported distance-to-fault on a line.

    Identify the line either by feeder_id or by volt_class + from/to, which is
    how the page's three dropdowns narrow it down. `measured_from` says which
    end the relay measured from; the tower chain is walked from that end,
    whichever way it happens to be stored.
    """
    return fault_service.locate_fault(
        db,
        distance_km=distance_km,
        measured_from=measured_from,
        volt_class=volt_class,
        from_substation=from_substation,
        to_substation=to_substation,
        feeder_id=feeder_id,
    )
