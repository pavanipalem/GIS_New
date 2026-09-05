"""Import every model here so Alembic autogenerate sees the full metadata."""

from app.models.line import Line
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
]
