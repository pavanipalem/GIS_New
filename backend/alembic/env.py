from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool, text

from app.core.config import settings
from app.core.db import Base

# Ensure every model is registered on Base.metadata.
import app.models  # noqa: F401

config = context.config
# configparser's default interpolation treats a bare "%" specially, which
# breaks on a URL-encoded password (e.g. "%40" for "@"). Escaping to "%%"
# round-trips correctly - this is Alembic's documented workaround, not a
# change to the actual URL.
config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# PostGIS-managed objects that must never appear in autogenerate diffs.
_IGNORED_TABLES = {"spatial_ref_sys", "geography_columns", "geometry_columns", "raster_columns",
                   "raster_overviews"}


def include_name(name, type_, parent_names):
    """Scope reflection to the gis schema only.

    Without this, include_schemas=True makes Alembic reflect every schema in
    the database - legacy_raw's 23 tables, the abandoned dbo migration
    attempt, all of public - and compare every one of them against metadata
    that only describes gis.*. The result: `alembic check` (and a real
    `revision --autogenerate`) proposes DROP TABLE for all of it. Filtering
    schemas here, before objects within them are even reflected, is the
    documented way to scope a multi-schema database to one schema.
    """
    if type_ == "schema":
        return name in (None, settings.db_schema)
    return True


def include_object(obj, name, type_, reflected, compare_to):
    if type_ == "table" and name in _IGNORED_TABLES:
        return False
    return True


def _configure(connection=None, url=None):
    context.configure(
        connection=connection,
        url=url,
        target_metadata=target_metadata,
        include_schemas=True,
        version_table_schema=settings.db_schema,
        include_name=include_name,
        include_object=include_object,
        compare_type=True,
        compare_server_default=True,
    )


def run_migrations_offline() -> None:
    _configure(url=settings.database_url)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{settings.db_schema}"'))
        connection.commit()
        _configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
