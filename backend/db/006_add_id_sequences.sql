-- =====================================================================
-- 006 — sequences for line.feeder_id and tower.tower_id
--
-- Both were IDENTITY columns in SQL Server: Insertlines-template and
-- Inserttowers-template never supply them, they let the server allocate.
-- The backfill inserted the migrated values explicitly, so the columns were
-- created without a default and a new record created through the API would
-- have nothing to assign.
--
-- Each sequence starts above the highest migrated value, so new records
-- cannot collide with anything that came from SQL Server.
--
-- substation.ss_code deliberately gets no sequence: InsertSubstationData
-- takes @ss_codes from the caller and checks IF NOT EXISTS, so substation
-- codes are chosen by the user, not allocated.
--
--   psql -h 172.17.4.194 -U postgres -d gisdata -f 006_add_id_sequences.sql
-- =====================================================================

BEGIN;

CREATE SEQUENCE IF NOT EXISTS gis.line_feeder_id_seq AS integer OWNED BY gis.line.feeder_id;
CREATE SEQUENCE IF NOT EXISTS gis.tower_tower_id_seq AS bigint OWNED BY gis.tower.tower_id;

-- start above the migrated maximums
SELECT setval('gis.line_feeder_id_seq',  COALESCE((SELECT max(feeder_id) FROM gis.line), 0) + 1, false);
SELECT setval('gis.tower_tower_id_seq',  COALESCE((SELECT max(tower_id) FROM gis.tower), 0) + 1, false);

ALTER TABLE gis.line  ALTER COLUMN feeder_id SET DEFAULT nextval('gis.line_feeder_id_seq');
ALTER TABLE gis.tower ALTER COLUMN tower_id  SET DEFAULT nextval('gis.tower_tower_id_seq');

UPDATE gis.alembic_version SET version_num = '0006';

COMMIT;

-- =====================================================================
-- Verify
-- =====================================================================
-- SELECT last_value FROM gis.line_feeder_id_seq;   -- > max(feeder_id)
-- SELECT last_value FROM gis.tower_tower_id_seq;   -- > max(tower_id)
