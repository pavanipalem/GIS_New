"""sequences for line.feeder_id and tower.tower_id

Both were IDENTITY columns in SQL Server - Insertlines-template and
Inserttowers-template never supply them. The backfill inserted the migrated
values explicitly, so the columns have no default and a record created
through the API would have nothing to assign. Each sequence starts above the
highest migrated value so new rows cannot collide with migrated ones.

substation.ss_code deliberately gets no sequence: InsertSubstationData takes
@ss_codes from the caller, so those are chosen rather than allocated.

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-06

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "gis"


def upgrade() -> None:
    op.execute(
        f"CREATE SEQUENCE IF NOT EXISTS {SCHEMA}.line_feeder_id_seq "
        f"AS integer OWNED BY {SCHEMA}.line.feeder_id"
    )
    op.execute(
        f"CREATE SEQUENCE IF NOT EXISTS {SCHEMA}.tower_tower_id_seq "
        f"AS bigint OWNED BY {SCHEMA}.tower.tower_id"
    )
    op.execute(
        f"SELECT setval('{SCHEMA}.line_feeder_id_seq', "
        f"COALESCE((SELECT max(feeder_id) FROM {SCHEMA}.line), 0) + 1, false)"
    )
    op.execute(
        f"SELECT setval('{SCHEMA}.tower_tower_id_seq', "
        f"COALESCE((SELECT max(tower_id) FROM {SCHEMA}.tower), 0) + 1, false)"
    )
    op.execute(
        f"ALTER TABLE {SCHEMA}.line ALTER COLUMN feeder_id "
        f"SET DEFAULT nextval('{SCHEMA}.line_feeder_id_seq')"
    )
    op.execute(
        f"ALTER TABLE {SCHEMA}.tower ALTER COLUMN tower_id "
        f"SET DEFAULT nextval('{SCHEMA}.tower_tower_id_seq')"
    )


def downgrade() -> None:
    op.execute(f"ALTER TABLE {SCHEMA}.tower ALTER COLUMN tower_id DROP DEFAULT")
    op.execute(f"ALTER TABLE {SCHEMA}.line ALTER COLUMN feeder_id DROP DEFAULT")
    op.execute(f"DROP SEQUENCE IF EXISTS {SCHEMA}.tower_tower_id_seq")
    op.execute(f"DROP SEQUENCE IF EXISTS {SCHEMA}.line_feeder_id_seq")
