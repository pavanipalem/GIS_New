-- =====================================================================
-- 008 — sequences for solar_plant.solar_id and ehv_consumer.ehv_id
--
-- Same story as 006: both were IDENTITY columns in SQL Server. sp_Solarplant
-- and sp_ehvconsumers insert without supplying an id, so the API needs the
-- database to allocate one. Each starts above the migrated maximum.
--
--   psql -h 172.17.4.194 -U postgres -d gisdata -f 008_asset_id_sequences.sql
-- =====================================================================

BEGIN;

CREATE SEQUENCE IF NOT EXISTS gis.solar_plant_solar_id_seq  AS bigint OWNED BY gis.solar_plant.solar_id;
CREATE SEQUENCE IF NOT EXISTS gis.ehv_consumer_ehv_id_seq   AS bigint OWNED BY gis.ehv_consumer.ehv_id;

SELECT setval('gis.solar_plant_solar_id_seq', COALESCE((SELECT max(solar_id) FROM gis.solar_plant), 0) + 1, false);
SELECT setval('gis.ehv_consumer_ehv_id_seq',  COALESCE((SELECT max(ehv_id)  FROM gis.ehv_consumer), 0) + 1, false);

ALTER TABLE gis.solar_plant  ALTER COLUMN solar_id SET DEFAULT nextval('gis.solar_plant_solar_id_seq');
ALTER TABLE gis.ehv_consumer ALTER COLUMN ehv_id   SET DEFAULT nextval('gis.ehv_consumer_ehv_id_seq');

-- Keep the original text of the solar commissioning date.
-- All 35 existing values parse cleanly, so nothing was lost historically -
-- but the legacy column was free text, and a future entry like "Q3 2024"
-- would vanish the same way 276 line charging dates did (see 007).
ALTER TABLE gis.solar_plant ADD COLUMN IF NOT EXISTS commercial_operation_date_raw text;

UPDATE gis.solar_plant sp
SET commercial_operation_date_raw = gis.tnull(src.commercialoperationdate)
FROM legacy_raw."Solar Plants" src
WHERE src.solar_id = sp.solar_id;

UPDATE gis.alembic_version SET version_num = '0008';

COMMIT;
