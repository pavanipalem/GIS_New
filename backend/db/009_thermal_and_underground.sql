-- =====================================================================
-- 009 — thermal power stations, and underground cables as real data
--
-- Two gaps found by comparing the rewrite's map panel against the legacy
-- MapView layer list.
--
-- 1. Thermal generating stations were never migrated. The legacy panel has
--    Hydel / Thermal / Solar under "Generating Station"; only hydel and
--    solar came across. legacy_raw.thermalpowerstations has 14 rows and the
--    same shape as hydelpowerstations.
--
-- 2. "UG Cables 220 KV / 132 KV" in the legacy panel are not a separate
--    table - they are ordinary lines whose feeder ids were hardcoded into
--    the stored procedures:
--
--      132 kV: 22,24,25,26,27,28,30,401,411,412,415,426,427,432,434,435,
--              436,437,438,439,465,466,467,468,751,752            (26 ids)
--      220 kV: 505,506,518,519,521,597,598,660,661,669,672,674,675,
--              676,780                                            (15 ids)
--
--    The same two lists are repeated five times each across GetMapData,
--    MapData and MapDatav3. That is business data living in SQL text, so it
--    becomes a column here and the map filters on it.
--
--    Six of the 41 ids no longer match any line - 412 and 435 at 132 kV,
--    505, 506, 669 and 672 at 220 kV. They are left out rather than
--    invented; every surviving id resolves to a line of the expected
--    voltage, so the lists are otherwise sound.
--
--   psql -h 172.17.4.194 -U postgres -d gisdata -f 009_thermal_and_underground.sql
-- =====================================================================

BEGIN;

-- ------------------------------------------------- thermal_power_station
CREATE TABLE IF NOT EXISTS gis.thermal_power_station (
    thermal_id    bigint NOT NULL,
    name          text,
    gen_cap_mw    numeric(10, 2),
    connected_ss  text,
    volt_level    varchar(50),
    division      varchar(100),
    circle        varchar(100),
    zone          varchar(100),
    location      geography(Point, 4326),
    CONSTRAINT pk_thermal_power_station PRIMARY KEY (thermal_id)
);

CREATE INDEX IF NOT EXISTS ix_thermal_power_station_location
    ON gis.thermal_power_station USING gist (location);

TRUNCATE gis.thermal_power_station;

INSERT INTO gis.thermal_power_station (
    thermal_id, name, gen_cap_mw, connected_ss, volt_level,
    division, circle, zone, location
)
SELECT
    t.thermal_id,
    gis.tnull(t.name),
    t.gen_cap,
    gis.tnull(t.connected_ss),
    gis.tnull(t.vtg_rate),
    gis.tnull(t.division),
    gis.tnull(t.circle),
    gis.tnull(t.zone),
    CASE
        WHEN t.long BETWEEN -180 AND 180 AND t.lat BETWEEN -90 AND 90
        THEN ST_SetSRID(ST_MakePoint(t.long, t.lat), 4326)::geography
    END
FROM legacy_raw."thermalpowerstations" t;

CREATE SEQUENCE IF NOT EXISTS gis.thermal_power_station_thermal_id_seq
    AS bigint OWNED BY gis.thermal_power_station.thermal_id;
SELECT setval('gis.thermal_power_station_thermal_id_seq',
              COALESCE((SELECT max(thermal_id) FROM gis.thermal_power_station), 0) + 1, false);
ALTER TABLE gis.thermal_power_station
    ALTER COLUMN thermal_id SET DEFAULT nextval('gis.thermal_power_station_thermal_id_seq');

-- ------------------------------------------------------ underground flag
ALTER TABLE gis.line ADD COLUMN IF NOT EXISTS is_underground boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN gis.line.is_underground IS
    'Underground cable. Replaces the hardcoded FEEDER_ID lists that the legacy '
    'map procedures used to drive the "UG Cables" layers.';

UPDATE gis.line SET is_underground = true
WHERE feeder_id IN (
    -- 132 kV
    22, 24, 25, 26, 27, 28, 30, 401, 411, 412, 415, 426, 427, 432, 434, 435,
    436, 437, 438, 439, 465, 466, 467, 468, 751, 752,
    -- 220 kV
    505, 506, 518, 519, 521, 597, 598, 660, 661, 669, 672, 674, 675, 676, 780
);

CREATE INDEX IF NOT EXISTS ix_line_is_underground
    ON gis.line (is_underground) WHERE is_underground;

UPDATE gis.alembic_version SET version_num = '0009';

COMMIT;

-- =====================================================================
-- Verify: expect 14 thermal stations, and 35 underground lines (24 at
-- 132 kV, 11 at 220 kV) - the other 6 ids in the legacy lists are dead.
-- =====================================================================
SELECT 'thermal stations' AS item, count(*)::text AS value FROM gis.thermal_power_station
UNION ALL SELECT '  with location', count(*)::text FROM gis.thermal_power_station
          WHERE location IS NOT NULL
UNION ALL SELECT 'underground lines', count(*)::text FROM gis.line WHERE is_underground;

SELECT volt_class, count(*) AS underground_lines
FROM gis.line WHERE is_underground GROUP BY volt_class ORDER BY volt_class DESC;
