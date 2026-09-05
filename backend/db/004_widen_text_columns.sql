-- =====================================================================
-- 004 — size the line/tower text columns from the data, not by eye
--
-- 101 failed with "value too long for type character varying(50)":
-- tower.location_no holds values up to 74 characters. Measuring the rest
-- (diag_column_widths.sql) turned up two more things worth acting on:
--
--   * line.conductor_type and line.earth_wire_type are at exactly 100/100,
--     and tower.soil_strata and tower.make at exactly 100. The legacy line
--     columns really are varchar(100), so that text was already truncated
--     upstream. Re-imposing the same ceiling in an app where users now edit
--     these fields would keep truncating them.
--
--   * tower.volt_class and tower.towers_utilized are NULL in all 105,082
--     rows. The map procs filter on the LINE's VOLT_CLASS through the join,
--     never the tower's, so the index on tower.volt_class is write overhead
--     against a column with nothing in it.
--
-- So: varchar(n) only where a real domain rule exists - usernames, codes,
-- voltage class - and text for descriptive free-text fields. varchar(n) and
-- text perform identically in Postgres; an arbitrary ceiling on free text
-- is a liability with no upside.
--
-- Both tables are empty (101 rolled back), so every ALTER here is instant.
--
--   psql -h 172.17.4.194 -U postgres -d gisdata -f 004_widen_text_columns.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------- tower
-- the column that actually broke the load
ALTER TABLE gis.tower ALTER COLUMN location_no       TYPE varchar(100);

-- descriptive free text
ALTER TABLE gis.tower ALTER COLUMN tower_type        TYPE text;
ALTER TABLE gis.tower ALTER COLUMN circuit_type      TYPE text;
ALTER TABLE gis.tower ALTER COLUMN make              TYPE text;
ALTER TABLE gis.tower ALTER COLUMN towers_utilized   TYPE text;
ALTER TABLE gis.tower ALTER COLUMN soil_strata       TYPE text;
ALTER TABLE gis.tower ALTER COLUMN foundation_class  TYPE text;
ALTER TABLE gis.tower ALTER COLUMN earthing_type     TYPE text;
ALTER TABLE gis.tower ALTER COLUMN earth_wire_type   TYPE text;
ALTER TABLE gis.tower ALTER COLUMN telecom_joint_box TYPE text;

-- empty in every legacy row; the map filters on the line's volt_class
DROP INDEX IF EXISTS gis.ix_tower_volt_class;

-- ----------------------------------------------------------------- line
ALTER TABLE gis.line  ALTER COLUMN feeder_name       TYPE text;
ALTER TABLE gis.line  ALTER COLUMN from_substation   TYPE text;
ALTER TABLE gis.line  ALTER COLUMN to_substation     TYPE text;
ALTER TABLE gis.line  ALTER COLUMN circuit_type      TYPE text;
ALTER TABLE gis.line  ALTER COLUMN conductor_type    TYPE text;
ALTER TABLE gis.line  ALTER COLUMN earth_wire_type   TYPE text;
ALTER TABLE gis.line  ALTER COLUMN jurisdiction      TYPE text;

-- Left as varchar deliberately, because these have real domain rules:
--   inserted_by / updated_by  varchar(50)   - usernames, matches app_user
--   volt_class                varchar(50)   - '132', '220', '400'
--   zone / circle             varchar(100)  - fixed administrative names
--   location_no               varchar(100)  - survey label, max seen 74
--   tower_extension           varchar(50)   - max seen 39
--   sap_fl_code / rrsc_line_code varchar(100) - external system codes

UPDATE gis.alembic_version SET version_num = '0004';

COMMIT;

-- =====================================================================
-- Verify
-- =====================================================================
-- SELECT column_name, data_type, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_schema = 'gis' AND table_name IN ('line','tower')
-- ORDER BY table_name, ordinal_position;
