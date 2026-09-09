from pydantic import BaseModel

from app.schemas.map import MapPoint, SubstationMarker


class NearbyLine(BaseModel):
    """A transmission line or UG cable that comes within the search circle.

    `segments` is the route clipped to the circle - one entry per stretch
    inside it, since a line can cross the boundary more than once. Nothing
    outside the circle is returned, so the client can draw exactly what falls
    within the radius.
    """

    feeder_id: int
    feeder_name: str | None
    volt_class: str | None
    from_substation: str | None
    to_substation: str | None
    length_ckm: float | None
    is_underground: bool
    segments: list[list[MapPoint]]


class NearbyResult(BaseModel):
    center: MapPoint
    radius_km: float
    volt_classes: list[str]
    substations: list[SubstationMarker]
    lines: list[NearbyLine]
