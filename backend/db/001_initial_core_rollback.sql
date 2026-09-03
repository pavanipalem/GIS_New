-- =====================================================================
-- Rollback for 001_initial_core.sql
--
-- Drops the entire `gis` application schema. Does NOT touch `legacy_raw`
-- or the postgis extension.
--
--   psql -h 172.17.4.194 -U postgres -d gisdata -f 001_initial_core_rollback.sql
-- =====================================================================

BEGIN;

DROP TABLE IF EXISTS gis.substation_equipment;
DROP TABLE IF EXISTS gis.transformer;
DROP TABLE IF EXISTS gis.substation;
DROP TABLE IF EXISTS gis.app_user;
DROP TABLE IF EXISTS gis.alembic_version;

DROP TYPE IF EXISTS gis.equipment_kind;
DROP TYPE IF EXISTS gis.user_role;

-- Uncomment to remove the (now empty) schema as well:
-- DROP SCHEMA IF EXISTS gis;

COMMIT;
