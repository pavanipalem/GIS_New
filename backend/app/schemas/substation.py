from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.substation import EquipmentKind
from app.schemas.map import MapPoint

# ---------------------------------------------------------------------------
# The legacy SubstationData.aspx form is the reference for what is editable:
# scalar substation fields, nine transformer slots, a shunt reactor, a
# capacitor, a station transformer, and fifteen boundary point pairs.
#
# Year-of-commissioning stays free text on input (yoc_raw) because the legacy
# form accepted anything - "28.12.2018", "2019", "not commissioned". The
# server parses it into year_of_commissioning / yoc_year and always keeps the
# original, so nothing a user types is ever lost.
# ---------------------------------------------------------------------------


class TransformerIn(BaseModel):
    slot_no: int = Field(ge=1, le=9)
    capacity_mva: Decimal | None = None
    serial_no: str | None = Field(default=None, max_length=150)
    make: str | None = Field(default=None, max_length=150)
    vector_group: str | None = Field(default=None, max_length=50)
    yoc_raw: str | None = Field(default=None, max_length=100)
    po_reference: str | None = None
    volt_level: str | None = Field(default=None, max_length=50)


class TransformerOut(TransformerIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    year_of_commissioning: date | None
    yoc_year: int | None


class EquipmentIn(BaseModel):
    kind: EquipmentKind
    capacity_mva: Decimal | None = None
    serial_no: str | None = Field(default=None, max_length=150)
    make: str | None = Field(default=None, max_length=150)
    vector_group: str | None = Field(default=None, max_length=50)
    yoc_raw: str | None = Field(default=None, max_length=100)
    po_reference: str | None = None


class EquipmentOut(EquipmentIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    year_of_commissioning: date | None
    yoc_year: int | None


class SubstationFields(BaseModel):
    """Everything on the legacy form except the children and the geometry."""

    ss_name: str | None = Field(default=None, max_length=200)
    ss_type: str | None = Field(default=None, max_length=50)
    volt_class: str | None = Field(default=None, max_length=50)
    volt_levels: str | None = Field(default=None, max_length=50)
    primary_mva_cap: Decimal | None = None
    no_of_ptrs: int | None = Field(default=None, ge=0, le=99)

    district: str | None = Field(default=None, max_length=150)
    zone: str | None = Field(default=None, max_length=100)
    circle: str | None = Field(default=None, max_length=100)
    division: str | None = Field(default=None, max_length=150)
    plant_circle: str | None = Field(default=None, max_length=100)

    manned: str | None = Field(default=None, max_length=50)
    generation: str | None = Field(default=None, max_length=50)
    gen_type: str | None = Field(default=None, max_length=100)
    scada: str | None = Field(default=None, max_length=50)
    railway_tss: str | None = Field(default=None, max_length=50)
    gis_type: str | None = Field(default=None, max_length=50)
    ehv_consumer: str | None = Field(default=None, max_length=50)
    rad_grid: str | None = Field(default=None, max_length=50)
    dg_set: str | None = Field(default=None, max_length=50)
    dg_and_ff_system: str | None = Field(default=None, max_length=50)
    contact_no: str | None = Field(default=None, max_length=50)

    function_loc_code: str | None = Field(default=None, max_length=100)
    sap_erp_connectivity: str | None = Field(default=None, max_length=50)
    rrsc_ss_code: str | None = Field(default=None, max_length=50)
    ss_erp_source: str | None = Field(default=None, max_length=100)

    ss_doc: str | None = None
    link_sld: str | None = None
    link_ss_photo: str | None = None
    link_ss_layout: str | None = None


class SubstationWrite(SubstationFields):
    location: MapPoint | None = None
    # Up to 15 points, as the legacy form captured. Fewer than 3 distinct
    # points cannot form a polygon and are stored as no boundary.
    boundary: list[MapPoint] | None = Field(default=None, max_length=15)
    transformers: list[TransformerIn] = Field(default_factory=list, max_length=9)
    equipment: list[EquipmentIn] = Field(default_factory=list)


class SubstationCreate(SubstationWrite):
    ss_code: int = Field(gt=0)


class SubstationUpdate(SubstationWrite):
    pass


class SubstationListItem(BaseModel):
    """Row shape for the grid - deliberately narrow, since the list can
    return every substation."""

    model_config = ConfigDict(from_attributes=True)

    ss_code: int
    ss_name: str | None
    ss_type: str | None
    volt_class: str | None
    volt_levels: str | None
    district: str | None
    zone: str | None
    circle: str | None
    division: str | None
    primary_mva_cap: Decimal | None
    no_of_ptrs: int | None
    transformer_count: int
    has_location: bool


class SubstationPage(BaseModel):
    items: list[SubstationListItem]
    total: int
    limit: int
    offset: int


class SubstationDetail(SubstationFields):
    model_config = ConfigDict(from_attributes=True)

    ss_code: int
    location: MapPoint | None
    boundary: list[MapPoint] | None

    transformers: list[TransformerOut]
    equipment: list[EquipmentOut]

    inserted_by: str | None
    inserted_at: datetime | None
    updated_by: str | None
    updated_at: datetime | None
