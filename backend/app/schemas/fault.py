from pydantic import BaseModel

from app.schemas.map import MapPoint


class FaultTower(BaseModel):
    """One tower on the route, in the order distance is measured along it."""

    tower_id: int
    seq_no: int | None
    location_no: str | None
    tower_type: str | None
    telecom_joint_box: str | None
    lat: float
    lng: float
    # running distance from the measuring end, at this tower
    distance_km: float


class FaultLocation(BaseModel):
    """Where a reported fault distance lands on a line.

    `reversed` says the tower chain was walked back-to-front because the
    substation the user measured from is the one at the far end of the stored
    route. `direction_verified` says that decision was made by comparing the
    route's own end points against the two substations' coordinates rather
    than by trusting the From/To text columns - see fault_service for why
    that matters.
    """

    feeder_id: int
    feeder_name: str | None
    volt_class: str | None
    from_substation: str | None
    to_substation: str | None

    measured_from: str
    reversed: bool
    direction_verified: bool
    direction_note: str | None

    distance_km: float
    route_length_km: float
    recorded_length_ckm: float | None

    fault_point: MapPoint
    before_tower: FaultTower
    after_tower: FaultTower
    cumulative_km_before: float
    section_km: float

    towers: list[FaultTower]
