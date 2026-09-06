from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.map import MapPoint

# ---------------------------------------------------------------------------
# Solar plants and EHV consumers. Both are small, flat CRUD tables in the
# legacy system (sp_Solarplant, sp_ehvconsumers) - insert, update, delete,
# then return the whole list. Neither has children or geometry beyond a point.
# ---------------------------------------------------------------------------


class SolarPlantFields(BaseModel):
    plant_name: str | None = None
    location_desc: str | None = None
    installed_capacity_mw: Decimal | None = None
    interfacing_ss: str | None = None
    voltage_level: str | None = Field(default=None, max_length=50)
    # free text as the legacy form had it; parsed server-side where possible
    commercial_operation_date_raw: str | None = Field(default=None, max_length=100)
    division: str | None = Field(default=None, max_length=100)
    circle: str | None = Field(default=None, max_length=100)
    zone: str | None = Field(default=None, max_length=100)
    location: MapPoint | None = None


class SolarPlantOut(SolarPlantFields):
    model_config = ConfigDict(from_attributes=True)

    solar_id: int
    commercial_operation_date: date | None


class EhvConsumerFields(BaseModel):
    name: str | None = None
    location_desc: str | None = None
    installed_capacity_mw: Decimal | None = None
    feeder_id: int | None = None
    feeder_name: str | None = None
    substation: str | None = None
    consumer_code: str | None = Field(default=None, max_length=100)
    voltage_rate: str | None = Field(default=None, max_length=50)
    function_loc_code: str | None = Field(default=None, max_length=100)
    connected_ss: str | None = None
    line_name: str | None = None
    line_code: str | None = Field(default=None, max_length=100)
    division: str | None = Field(default=None, max_length=100)
    circle: str | None = Field(default=None, max_length=100)
    zone: str | None = Field(default=None, max_length=100)
    location: MapPoint | None = None


class EhvConsumerOut(EhvConsumerFields):
    model_config = ConfigDict(from_attributes=True)

    ehv_id: int
