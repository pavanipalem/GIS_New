from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.map import MapPoint

# ---------------------------------------------------------------------------
# Lines and towers. Reference forms: linestemplate.aspx / towerstemplate.aspx,
# and the Insertlines-template / Inserttowers-template procedures.
#
# Dates stay free text on input for the same reason as the substation form:
# DATE_OF_CHRGING_OF_LINE and LAST_MAINTENANCE_DATE were nvarchar and users
# typed whatever they liked. The server parses and keeps the original.
# ---------------------------------------------------------------------------


class LineFields(BaseModel):
    feeder_name: str | None = None
    volt_class: str | None = Field(default=None, max_length=50)
    # legacy FROM / TO, renamed - both are reserved words in SQL
    from_substation: str | None = None
    to_substation: str | None = None

    total_no_of_locations: int | None = Field(default=None, ge=0)
    length_ckm: Decimal | None = None
    length_of_line: Decimal | None = None
    max_load_in_amp: Decimal | None = None

    circuit_type: str | None = None
    conductor_type: str | None = None
    earth_wire_type: str | None = None

    date_of_charging_raw: str | None = Field(default=None, max_length=100)
    last_maintenance_date_raw: str | None = Field(default=None, max_length=100)

    jurisdiction: str | None = None
    zone: str | None = Field(default=None, max_length=100)
    circle: str | None = Field(default=None, max_length=100)
    sap_fl_code: str | None = Field(default=None, max_length=100)
    additional_info: str | None = None


class LineCreate(LineFields):
    # The proc refuses an insert unless both are present, so they are required
    # here rather than silently returning 0 the way the legacy caller did.
    from_substation: str = Field(min_length=1)
    to_substation: str = Field(min_length=1)


class LineUpdate(LineFields):
    pass


class LineListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    feeder_id: int
    feeder_name: str | None
    volt_class: str | None
    from_substation: str | None
    to_substation: str | None
    length_ckm: Decimal | None
    tower_count: int | None
    zone: str | None
    circle: str | None
    has_route: bool


class LinePage(BaseModel):
    items: list[LineListItem]
    total: int
    limit: int
    offset: int


class LineDetail(LineFields):
    model_config = ConfigDict(from_attributes=True)

    feeder_id: int
    date_of_charging: date | None
    last_maintenance_date: date | None
    tower_count: int | None
    route: list[MapPoint] | None

    inserted_by: str | None
    inserted_at: datetime | None
    updated_by: str | None
    updated_at: datetime | None


# ------------------------------------------------------------------- towers
class TowerFields(BaseModel):
    location_no: str | None = Field(default=None, max_length=100)
    seq_no: int | None = None
    tower_type: str | None = None
    tower_extension: str | None = Field(default=None, max_length=50)
    circuit_type: str | None = None
    make: str | None = None
    towers_utilized: str | None = None

    soil_strata: str | None = None
    foundation_class: str | None = None

    disc_70kn: int | None = Field(default=None, ge=0)
    disc_120kn: int | None = Field(default=None, ge=0)
    disc_160kn: int | None = Field(default=None, ge=0)
    src_70kn: int | None = Field(default=None, ge=0)
    src_120kn: int | None = Field(default=None, ge=0)
    src_160kn: int | None = Field(default=None, ge=0)

    earthing_type: str | None = None
    earth_wire_type: str | None = None
    telecom_joint_box: str | None = None
    landmark: str | None = None
    additional_info: str | None = None

    volt_class: str | None = Field(default=None, max_length=50)
    zone: str | None = Field(default=None, max_length=100)
    circle: str | None = Field(default=None, max_length=100)
    sap_id: int | None = None
    rrsc_line_code: str | None = Field(default=None, max_length=100)

    location: MapPoint | None = None


class TowerCreate(TowerFields):
    # the proc refuses an insert without a feeder
    feeder_id: int


class TowerUpdate(TowerFields):
    # Allowed to move a tower to another feeder, which the legacy update did
    # not support - it only ever edited in place. Both the old and the new
    # feeder's route are rebuilt when this changes.
    feeder_id: int | None = None


class TowerOut(TowerFields):
    model_config = ConfigDict(from_attributes=True)

    tower_id: int
    feeder_id: int | None
    inserted_by: str | None
    inserted_at: datetime | None
    updated_by: str | None


class TowerPage(BaseModel):
    items: list[TowerOut]
    total: int
    limit: int
    offset: int
