-- =====================================================================
-- 002 — add yoc_year to transformer and substation_equipment
--
-- Legacy ptrN_yoc mixes full dates with year-only values ("2024", "1985")
-- and free text ("not commissioned"). A DATE column cannot hold a bare
-- year honestly, so we keep three columns:
--
--   year_of_commissioning  date      -- set only when a full date parsed
--   yoc_year               smallint  -- set for full dates AND year-only
--   yoc_raw                varchar   -- the original text, always preserved
--
--   psql -h 172.17.4.194 -U postgres -d gisdata -f 002_add_yoc_year.sql
-- =====================================================================

BEGIN;

ALTER TABLE gis.transformer           ADD COLUMN IF NOT EXISTS yoc_year smallint;
ALTER TABLE gis.substation_equipment  ADD COLUMN IF NOT EXISTS yoc_year smallint;

UPDATE gis.alembic_version SET version_num = '0002' WHERE version_num = '0001';

COMMIT;
