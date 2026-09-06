-- =====================================================================
-- 007 — keep the original text of the line date columns (repair)
--
-- 101_backfill_lines_towers.sql parsed DATE_OF_CHRGING_OF_LINE and
-- LAST_MAINTENANCE_DATE straight into date columns and kept nothing else,
-- so anything the parser could not read was silently dropped:
--
--     date_of_charging       899 non-blank, 276 unparseable  (31% lost)
--     last_maintenance_date  144 non-blank,  57 unparseable  (40% lost)
--
-- Those values are not noise. They carry real operational detail a single
-- date cannot hold:
--
--     01.03.2017(Ckt I),15.06.2018(Ckt II)          per-circuit dates
--     31-12-1991 (RSS-DCPL) 21-05-2012(MDRM-DCPL)   per-section dates
--     09-08-2007(01-44) 24-12-2005(44A-44A/3)       per-location-range dates
--     01.03.2024 (Idle charged)                     date plus qualifier
--
-- gis.transformer already did the right thing with yoc_raw. This brings the
-- line columns in line: parse what is parseable, always keep the original.
-- The repair reads from legacy_raw, which still holds every original value,
-- so nothing is lost permanently.
--
--   psql -h 172.17.4.194 -U postgres -d gisdata -f 007_line_date_raw.sql
-- =====================================================================

BEGIN;

ALTER TABLE gis.line ADD COLUMN IF NOT EXISTS date_of_charging_raw      text;
ALTER TABLE gis.line ADD COLUMN IF NOT EXISTS last_maintenance_date_raw text;

COMMENT ON COLUMN gis.line.date_of_charging_raw IS
    'Original DATE_OF_CHRGING_OF_LINE text. date_of_charging holds the parsed '
    'value when there is one; this always holds what was actually entered.';
COMMENT ON COLUMN gis.line.last_maintenance_date_raw IS
    'Original LAST_MAINTENANCE_DATE text, as above.';

-- recover the text that the first backfill discarded
UPDATE gis.line l
SET date_of_charging_raw      = gis.tnull(src."DATE_OF_CHRGING_OF_LINE"),
    last_maintenance_date_raw = gis.tnull(src."LAST_MAINTENANCE_DATE")
FROM legacy_raw."lines-template" src
WHERE src."FEEDER_ID" = l.feeder_id;

UPDATE gis.alembic_version SET version_num = '0007';

COMMIT;

-- =====================================================================
-- Verify: recovered should equal the "unparseable" counts above
-- =====================================================================
SELECT 'charging text recovered'    AS item,
       count(*) FILTER (WHERE date_of_charging_raw IS NOT NULL
                          AND date_of_charging IS NULL)::text AS value
FROM gis.line
UNION ALL
SELECT 'maintenance text recovered',
       count(*) FILTER (WHERE last_maintenance_date_raw IS NOT NULL
                          AND last_maintenance_date IS NULL)::text
FROM gis.line;
