from pydantic import BaseModel


class MapPoint(BaseModel):
    lat: float
    lng: float


class SubstationMarker(BaseModel):
    ss_code: int
    ss_name: str | None
    ss_type: str | None
    volt_class: str | None
    no_of_ptrs: int | None
    ss_doc: str | None
    lat: float
    lng: float


class SubstationLookup(BaseModel):
    ss_code: int
    title: str
    lat: float
    lng: float


class CountByCategory(BaseModel):
    category: str
    count: int


class SolarPlantMarker(BaseModel):
    solar_id: int
    plant_name: str | None
    installed_capacity_mw: float | None
    interfacing_ss: str | None
    lat: float
    lng: float


class EhvConsumerMarker(BaseModel):
    ehv_id: int
    name: str | None
    installed_capacity_mw: float | None
    substation: str | None
    feeder_id: int | None
    lat: float
    lng: float


class LineFeature(BaseModel):
    feeder_id: int
    feeder_name: str | None
    volt_class: str | None
    from_substation: str | None
    to_substation: str | None
    tower_count: int | None
    length_ckm: float | None
    path: list[MapPoint]


class TowerMarker(BaseModel):
    tower_id: int
    feeder_id: int | None
    seq_no: int | None
    location_no: str | None
    tower_type: str | None
    lat: float
    lng: float


class PgcilSubstationMarker(BaseModel):
    id: int
    voltage: str | None
    name: str | None
    lat: float
    lng: float


class HydelPowerStationMarker(BaseModel):
    hydel_id: int
    name: str | None
    gen_cap_mw: float | None
    connected_ss: str | None
    lat: float
    lng: float


class PgcilLineMarker(BaseModel):
    id: int
    feeder_name: str | None
    lat: float
    lng: float
