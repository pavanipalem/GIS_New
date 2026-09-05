"""Import every model here so Alembic autogenerate sees the full metadata."""

from app.models.ehv_consumer import EhvConsumer
from app.models.line import Line
from app.models.pgcil import HydelPowerStation, PgcilLine, PgcilSubstation
from app.models.solar_plant import SolarPlant
from app.models.substation import Substation, SubstationEquipment, Transformer
from app.models.tower import Tower
from app.models.user import User

__all__ = [
    "User",
    "Substation",
    "Transformer",
    "SubstationEquipment",
    "Line",
    "Tower",
    "SolarPlant",
    "EhvConsumer",
    "PgcilSubstation",
    "HydelPowerStation",
    "PgcilLine",
]
