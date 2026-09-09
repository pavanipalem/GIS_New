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


class FaultEndSubstation(BaseModel):
    """An end of the faulted line, for placing its marker on the map.

    lat/lng are null when the name could not be matched to a substation
    record - the same case that leaves direction_verified false.
    """

    name: str
    lat: float | None
    lng: float | None
    volt_class: str | None


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

    # line context, so the tower popup can show the same fields the Map view
    # popup does
    line_circuit_type: str | None
    line_conductor_type: str | None
    line_date_of_charging: str | None
    line_total_locations: int | None

    # the two ends, for their map markers - source is the measuring end
    source_substation: FaultEndSubstation
    target_substation: FaultEndSubstation

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
