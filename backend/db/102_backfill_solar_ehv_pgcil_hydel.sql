-- =====================================================================
-- 102 — backfill solar plants, EHV consumers, and the three reference
-- layers from legacy_raw.
--
-- Re-runnable: truncates the five gis tables and rebuilds. Never writes
-- to legacy_raw. Requires 100_backfill_substations.sql to have run first
-- (gis.tnull / parse_numeric / parse_legacy_date helpers).
--
--   psql -h 172.17.4.194 -U postgres -d gisdata -f 102_backfill_solar_ehv_pgcil_hydel.sql
-- =====================================================================

BEGIN;

SET LOCAL search_path = gis, public;

TRUNCATE gis.ehv_consumer, gis.solar_plant,
         gis.pgcil_substation, gis.hydel_power_station, gis.pgcil_line;


-- ---------------------------------------------------------------------
-- 1. Solar plants
-- ---------------------------------------------------------------------
INSERT INTO gis.solar_plant (
    solar_id, plant_name, location_desc, installed_capacity_mw,
    interfacing_ss, voltage_level, commercial_operation_date,
    location, division, circle, zone
)
SELECT
    s.solar_id,
    gis.tnull(s.plantname),
    gis.tnull(s.location),
    gis.parse_numeric(s.installedcapacity),
    gis.tnull(s.interfacingss),
    gis.tnull(s.voltagelevel),
    gis.parse_legacy_date(s.commercialoperationdate),
    CASE
        WHEN gis.parse_numeric(s.long) BETWEEN -180 AND 180
         AND gis.parse_numeric(s.lat)  BETWEEN  -90 AND  90
        THEN ST_SetSRID(ST_MakePoint(
                 gis.parse_numeric(s.long)::float8,
                 gis.parse_numeric(s.lat)::float8), 4326)::geography
    END,
    gis.tnull(s.division),
    gis.tnull(s.circle),
    gis.tnull(s.zone)
FROM legacy_raw."Solar Plants" s;


-- ---------------------------------------------------------------------
-- 2. EHV consumers
-- ---------------------------------------------------------------------
INSERT INTO gis.ehv_consumer (
    ehv_id, name, location_desc, installed_capacity_mw, location,
    feeder_id, feeder_name, substation, consumer_code, voltage_rate,
    function_loc_code, connected_ss, line_name, line_code,
    division, circle, zone
)
SELECT
    e.ehv_id,
    gis.tnull(e.name),
    gis.tnull(e.location),
    gis.parse_numeric(e.installedcapacity),
    CASE
        WHEN gis.parse_numeric(e.long) BETWEEN -180 AND 180
         AND gis.parse_numeric(e.lat)  BETWEEN  -90 AND  90
        THEN ST_SetSRID(ST_MakePoint(
                 gis.parse_numeric(e.long)::float8,
                 gis.parse_numeric(e.lat)::float8), 4326)::geography
    END,
    CASE WHEN l."FEEDER_ID" IS NOT NULL THEN e.feeder_id END,
    gis.tnull(e."FEEDER NAME"),
    gis.tnull(e.substation),
    gis.tnull(e.consumercode),
    gis.tnull(e.vtlgrate),
    gis.tnull(e.floc_code),
    gis.tnull(e.connected_ss),
    gis.tnull(e.l_name),
    gis.tnull(e.l_code),
    gis.tnull(e.division),
    gis.tnull(e.circle),
    gis.tnull(e.zone)
FROM legacy_raw."ehvconsumers" e
LEFT JOIN legacy_raw."lines-template" l ON l."FEEDER_ID" = e.feeder_id;


-- ---------------------------------------------------------------------
-- 3. PGCIL substations (reference points)
-- ---------------------------------------------------------------------
INSERT INTO gis.pgcil_substation (voltage, name, location)
SELECT
    gis.tnull(p.voltage),
    gis.tnull(p.name),
    CASE
        WHEN p.long BETWEEN -180 AND 180 AND p.lat BETWEEN -90 AND 90
        THEN ST_SetSRID(ST_MakePoint(p.long, p.lat), 4326)::geography
    END
FROM legacy_raw."pgcil" p;


-- ---------------------------------------------------------------------
-- 4. Hydel power stations
-- ---------------------------------------------------------------------
INSERT INTO gis.hydel_power_station (
    hydel_id, name, gen_cap_mw, connected_ss, volt_level,
    division, circle, zone, location
)
SELECT
    h."Hydel_ID",
    gis.tnull(h."Name"),
    h.gen_cap,
    gis.tnull(h.connected_ss),
    gis.tnull(h.vtg_rate),
    gis.tnull(h.division),
    gis.tnull(h.circle),
    gis.tnull(h.zone),
    CASE
        WHEN h."Long" BETWEEN -180 AND 180 AND h."Lat" BETWEEN -90 AND 90
        THEN ST_SetSRID(ST_MakePoint(h."Long", h."Lat"), 4326)::geography
    END
FROM legacy_raw."hydelpowerstations" h;


-- ---------------------------------------------------------------------
-- 5. PGCIL lines (points only - no ordering column in the source)
-- ---------------------------------------------------------------------
INSERT INTO gis.pgcil_line (feeder_name, location)
SELECT
    gis.tnull(pl.feeder_name),
    CASE
        WHEN pl.long BETWEEN -180 AND 180 AND pl.lat BETWEEN -90 AND 90
        THEN ST_SetSRID(ST_MakePoint(pl.long, pl.lat), 4326)::geography
    END
FROM legacy_raw."pgcillines" pl;

COMMIT;

ANALYZE gis.solar_plant;
ANALYZE gis.ehv_consumer;
ANALYZE gis.pgcil_substation;
ANALYZE gis.hydel_power_station;
ANALYZE gis.pgcil_line;


-- =====================================================================
-- Report
-- =====================================================================
SELECT 'solar_plant'         AS item, count(*)::text AS value FROM gis.solar_plant
UNION ALL SELECT '  with location',  count(*)::text FROM gis.solar_plant WHERE location IS NOT NULL
UNION ALL SELECT 'ehv_consumer',     count(*)::text FROM gis.ehv_consumer
UNION ALL SELECT '  with location',  count(*)::text FROM gis.ehv_consumer WHERE location IS NOT NULL
UNION ALL SELECT '  with feeder',    count(*)::text FROM gis.ehv_consumer WHERE feeder_id IS NOT NULL
UNION ALL SELECT 'pgcil_substation', count(*)::text FROM gis.pgcil_substation
UNION ALL SELECT 'hydel_power_station', count(*)::text FROM gis.hydel_power_station
UNION ALL SELECT 'pgcil_line',       count(*)::text FROM gis.pgcil_line
UNION ALL SELECT '  with location',  count(*)::text FROM gis.pgcil_line WHERE location IS NOT NULL;
