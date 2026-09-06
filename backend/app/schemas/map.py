from datetime import date

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
    """Carries everything the legacy tower circle showed.

    arcgisScript.js bound a hover label of LOCATION NO + TYPE OF TOWER, and a
    click popup that mixed tower fields with line fields (feeder name, length,
    circuit/conductor type, date of charging). The line fields are joined in
    here rather than looked up client-side, because the viewport query returns
    towers spanning many feeders - the caller has no guarantee of holding the
    matching line.
    """

    tower_id: int
    feeder_id: int | None
    seq_no: int | None
    location_no: str | None
    tower_type: str | None
    # drives the legacy colour rules: yellow when a joint box is present,
    # orange when additional_info is "UC"
    telecom_joint_box: str | None
    additional_info: str | None
    lat: float
    lng: float

    # joined from gis.line
    line_volt_class: str | None
    line_feeder_name: str | None
    line_length_ckm: float | None
    line_tower_count: int | None
    line_circuit_type: str | None
    line_conductor_type: str | None
    line_date_of_charging: date | None


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
