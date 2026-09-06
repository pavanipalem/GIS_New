"""Column specs for the Excel templates.

The headers are derived from the current `gis` tables rather than copied from
the legacy workbooks, which are from 2019 and have drifted. Each spec names a
field that must exist on the matching Pydantic schema; `validate_specs()`
checks that at import time, so a renamed field breaks loudly here instead of
silently producing a template with a column nothing reads.

`key=True` marks the identity column. It is written on export and read on
import: a row that carries one updates that record, a row with it blank
creates a new one. The legacy uploader always inserted, so exporting, editing
and re-uploading duplicated everything - this makes that round trip safe.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.schemas.assets import EhvConsumerFields, SolarPlantFields
from app.schemas.network import LineFields, TowerFields

CellType = Literal["text", "int", "decimal", "latlng"]


@dataclass(frozen=True)
class Column:
    header: str
    field: str
    type: CellType = "text"
    key: bool = False
    note: str = ""


# --------------------------------------------------------------------- towers
TOWER_COLUMNS: list[Column] = [
    Column("Tower id", "tower_id", "int", key=True,
           note="Leave blank to add a new tower. Keep the value to update an existing one."),
    Column("Sequence no", "seq_no", "int",
           note="Position along the route. This is what draws the line on the map."),
    Column("Location no", "location_no", note="Survey label. May run opposite to sequence."),
    Column("Latitude", "lat", "latlng"),
    Column("Longitude", "lng", "latlng"),
    Column("Type of tower", "tower_type"),
    Column("Tower extension", "tower_extension"),
    Column("Type of circuit", "circuit_type"),
    Column("Make of tower", "make"),
    Column("Types of towers utilized", "towers_utilized"),
    Column("Soil strata", "soil_strata"),
    Column("Classification of foundation", "foundation_class"),
    Column("70KN disc insulators", "disc_70kn", "int"),
    Column("120KN disc insulators", "disc_120kn", "int"),
    Column("160KN disc insulators", "disc_160kn", "int"),
    Column("70KN SRC insulators", "src_70kn", "int"),
    Column("120KN SRC insulators", "src_120kn", "int"),
    Column("160KN SRC insulators", "src_160kn", "int"),
    Column("Type of earthing", "earthing_type"),
    Column("Type of earth wire / OPGW", "earth_wire_type"),
    Column("Telecom joint box", "telecom_joint_box",
           note="Any value here draws the tower yellow on the map."),
    Column("Important landmark", "landmark"),
    Column("Additional info", "additional_info",
           note='"UC" draws the tower orange on the map.'),
    Column("Voltage class", "volt_class"),
    Column("Zone", "zone"),
    Column("Circle", "circle"),
    Column("SAP id", "sap_id", "int"),
    Column("RRSC line code", "rrsc_line_code"),
]

# ---------------------------------------------------------------------- lines
LINE_COLUMNS: list[Column] = [
    Column("Feeder id", "feeder_id", "int", key=True,
           note="Leave blank to add a new line. Keep the value to update an existing one."),
    Column("Feeder name", "feeder_name"),
    Column("Voltage class", "volt_class"),
    Column("From", "from_substation", note="Required when adding a new line."),
    Column("To", "to_substation", note="Required when adding a new line."),
    Column("Total no of locations", "total_no_of_locations", "int"),
    Column("Length (ckm)", "length_ckm", "decimal"),
    Column("Length of line", "length_of_line", "decimal"),
    Column("Max load (A)", "max_load_in_amp", "decimal"),
    Column("Type of circuit", "circuit_type"),
    Column("Type of conductor", "conductor_type"),
    Column("Type of earth wire / OPGW", "earth_wire_type"),
    Column("Date of charging", "date_of_charging_raw",
           note="Free text. More than one date is fine - it is kept exactly as typed."),
    Column("Last maintenance date", "last_maintenance_date_raw", note="Free text."),
    Column("Jurisdiction", "jurisdiction"),
    Column("Zone", "zone"),
    Column("Circle", "circle"),
    Column("SAP FL code", "sap_fl_code"),
    Column("Additional info", "additional_info"),
]

# --------------------------------------------------------------- solar plants
SOLAR_COLUMNS: list[Column] = [
    Column("Solar id", "solar_id", "int", key=True,
           note="Leave blank to add a new plant. Keep the value to update an existing one."),
    Column("Plant name", "plant_name"),
    Column("Location", "location_desc"),
    Column("Installed capacity (MW)", "installed_capacity_mw", "decimal"),
    Column("Interfacing substation", "interfacing_ss"),
    Column("Voltage level", "voltage_level"),
    Column("Commercial operation date", "commercial_operation_date_raw", note="Free text."),
    Column("Latitude", "lat", "latlng"),
    Column("Longitude", "lng", "latlng"),
    Column("Division", "division"),
    Column("Circle", "circle"),
    Column("Zone", "zone"),
]

# -------------------------------------------------------------- EHV consumers
EHV_COLUMNS: list[Column] = [
    Column("EHV id", "ehv_id", "int", key=True,
           note="Leave blank to add a new consumer. Keep the value to update an existing one."),
    Column("Name", "name"),
    Column("Location", "location_desc"),
    Column("Installed capacity (MW)", "installed_capacity_mw", "decimal"),
    Column("Substation", "substation"),
    Column("Feeder id", "feeder_id", "int"),
    Column("Feeder name", "feeder_name"),
    Column("Consumer code", "consumer_code"),
    Column("Voltage rate", "voltage_rate"),
    Column("Function location code", "function_loc_code"),
    Column("Connected substation", "connected_ss"),
    Column("Line name", "line_name"),
    Column("Line code", "line_code"),
    Column("Latitude", "lat", "latlng"),
    Column("Longitude", "lng", "latlng"),
    Column("Division", "division"),
    Column("Circle", "circle"),
    Column("Zone", "zone"),
]


SPECS: dict[str, tuple[list[Column], type, str]] = {
    "towers": (TOWER_COLUMNS, TowerFields, "Towers"),
    "lines": (LINE_COLUMNS, LineFields, "Lines"),
    "solar-plants": (SOLAR_COLUMNS, SolarPlantFields, "Solar plants"),
    "ehv-consumers": (EHV_COLUMNS, EhvConsumerFields, "EHV consumers"),
}

# lat/lng are split out of the MapPoint, and the key column is not a schema
# field, so neither is expected to appear on the Pydantic model
_NOT_SCHEMA_FIELDS = {"lat", "lng"}


def validate_specs() -> None:
    """Every non-key, non-coordinate column must name a real schema field.

    Called at import time so a renamed field is a startup failure rather than
    a template column that silently reads nothing.
    """
    problems: list[str] = []
    for name, (columns, schema, _) in SPECS.items():
        fields = set(schema.model_fields)
        for col in columns:
            if col.key or col.field in _NOT_SCHEMA_FIELDS:
                continue
            if col.field not in fields:
                problems.append(f"{name}: column {col.header!r} -> unknown field {col.field!r}")
    if problems:
        raise RuntimeError("Excel column specs are out of sync with the schemas:\n  " +
                           "\n  ".join(problems))


validate_specs()
