-- =====================================================================
-- 101 — backfill lines and towers from legacy_raw
--
--   legacy_raw."lines-template"          ->  gis.line    (911 rows)
--   legacy_raw."Feeders-Towers-template" ->  gis.tower   (105,082 rows)
--   then gis.line.route is built from the towers.
--
-- Re-runnable: truncates both gis tables and rebuilds. Never writes to
-- legacy_raw. Requires 100_backfill_substations.sql to have run first,
-- for the gis.tnull / parse_numeric / parse_legacy_date helpers.
--
--   psql -h 172.17.4.194 -U postgres -d gisdata -f 101_backfill_lines_towers.sql
-- =====================================================================

BEGIN;

SET LOCAL search_path = gis, public;

-- Towers reference lines, so clear towers first.
TRUNCATE gis.tower, gis.line;


-- ---------------------------------------------------------------------
-- 1. Lines
-- ---------------------------------------------------------------------
INSERT INTO gis.line (
    feeder_id, feeder_name, volt_class, from_substation, to_substation,
    total_no_of_locations, length_ckm, length_of_line, max_load_in_amp,
    circuit_type, conductor_type, earth_wire_type,
    date_of_charging, last_maintenance_date,
    jurisdiction, zone, circle, sap_fl_code, additional_info,
    inserted_by, inserted_at, updated_by, updated_at
)
SELECT
    l."FEEDER_ID",
    gis.tnull(l."FEEDER_NAME"),
    -- the legacy insert proc strips spaces from volt_class; match it so the
    -- map's volt_class filters line up
    replace(gis.tnull(l."VOLT_CLASS"), ' ', ''),
    gis.tnull(l."FROM"),
    gis.tnull(l."TO"),
    gis.parse_numeric(l."TOTAL_NO_OF_LOCATIONS")::integer,
    gis.parse_numeric(l."LENGTH_CKM"),
    gis.parse_numeric(l."LENGTH_OF_LINE"),
    gis.parse_numeric(l."MAX_LOAD_IN_AMP"),
    gis.tnull(l."TYPE_OF_CIRCUIT"),
    gis.tnull(l."TYPE_OF_CONDUCTOR"),
    gis.tnull(l."TYPE_OF_EARTH_WIRE/OPGW"),
    gis.parse_legacy_date(l."DATE_OF_CHRGING_OF_LINE"),
    gis.parse_legacy_date(l."LAST_MAINTENANCE_DATE"),
    gis.tnull(l."JURISDICTION"),
    gis.tnull(l."ZONE"),
    gis.tnull(l."CIRCLE"),
    gis.tnull(l."SAP_FL_CODE"),
    gis.tnull(l."ADDITIONAL_INFO"),
    gis.tnull(l."InsertedBY"),
    l."InsertedDate",
    gis.tnull(l."UpdatedBy"),
    l."UpdatedDate"
FROM legacy_raw."lines-template" l;


-- ---------------------------------------------------------------------
-- 2. Towers
--
--    Coordinates come from the text tower_long/tower_lat, which is what
--    every map proc reads. The legacy long/lat/long1/lat1 float columns
--    are the same values rounded to 4dp and are ignored.
--
--    feeder_id is double precision in the legacy table but integer in
--    lines-template; cast it and NULL out any that point at a feeder that
--    does not exist, rather than dropping the tower.
-- ---------------------------------------------------------------------
INSERT INTO gis.tower (
    tower_id, feeder_id, location, seq_no, location_no,
    tower_type, tower_extension, circuit_type, make, towers_utilized,
    soil_strata, foundation_class,
    disc_70kn, disc_120kn, disc_160kn, src_70kn, src_120kn, src_160kn,
    earthing_type, earth_wire_type, telecom_joint_box, landmark, additional_info,
    volt_class, zone, circle, sap_id, rrsc_line_code,
    inserted_by, inserted_at, updated_by
)
SELECT
    t.tower_id,
    CASE WHEN l."FEEDER_ID" IS NOT NULL THEN t.feeder_id::integer END,
    CASE
        WHEN gis.parse_numeric(t.tower_long) BETWEEN -180 AND 180
         AND gis.parse_numeric(t.tower_lat)  BETWEEN  -90 AND  90
        THEN ST_SetSRID(ST_MakePoint(
                 gis.parse_numeric(t.tower_long)::float8,
                 gis.parse_numeric(t.tower_lat)::float8), 4326)::geography
    END,
    t."order",
    gis.tnull(t."LOCATION NO"),
    gis.tnull(t."TYPE OF TOWER"),
    gis.tnull(t."TOWER EXTENSION"),
    gis.tnull(t."TYPE OF CIRCUIT"),
    gis.tnull(t."MAKE OF TOWER"),
    gis.tnull(t."Types of Towers Utilized"),
    gis.tnull(t."SOIL STRATA"),
    gis.tnull(t."CLASSIFICATION OF FOUNDATION"),
    gis.parse_numeric(t."70KN DISC INSULATORS")::smallint,
    gis.parse_numeric(t."120KN DISC INSULATORS")::smallint,
    gis.parse_numeric(t."160KN DISC INSULATORS")::smallint,
    gis.parse_numeric(t."70KN SRC INSULATORS")::smallint,
    gis.parse_numeric(t."120KN SRC INSULATORS")::smallint,
    gis.parse_numeric(t."160KN SRC INSULATORS")::smallint,
    gis.tnull(t."TYPE OF EARTHING"),
    gis.tnull(t."TYPE OF EARTH WIRE/OPGW"),
    gis.tnull(t."Telecom JointBox"),
    gis.tnull(t."IMPORTANT LAND MARK"),
    gis.tnull(t."ADDITIONAL INFO"),
    replace(gis.tnull(t.volt_class), ' ', ''),
    gis.tnull(t.zone),
    gis.tnull(t.circle),
    t.sap_id,
    gis.tnull(t.rrsc_line_code),
    gis.tnull(t.insertedby),
    t.inserteddate,
    gis.tnull(t.updatedby)
FROM legacy_raw."Feeders-Towers-template" t
LEFT JOIN legacy_raw."lines-template" l
       ON l."FEEDER_ID" = t.feeder_id::integer;


-- ---------------------------------------------------------------------
-- 3. Line routes
--
--    A feeder's polyline is its towers in seq_no order. seq_no is the
--    legacy "order" column; where it is missing, fall back to a numeric
--    reading of location_no, then to tower_id, so a route is still drawn.
--
--    Consecutive duplicate points are collapsed - ST_MakeLine will happily
--    emit a zero-length segment otherwise - and a feeder needs two distinct
--    points before it gets a route at all.
--
--    This is a function because it has to run again whenever a tower is
--    added, moved or deleted. The API calls it after tower writes.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gis.rebuild_line_routes(p_feeder_id integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    n integer;
BEGIN
    WITH ordered AS (
        SELECT t.feeder_id,
               t.location::geometry AS geom,
               row_number() OVER (
                   PARTITION BY t.feeder_id
                   ORDER BY t.seq_no NULLS LAST,
                            gis.parse_numeric(t.location_no) NULLS LAST,
                            t.tower_id
               ) AS rn
        FROM gis.tower t
        WHERE t.location IS NOT NULL
          AND t.feeder_id IS NOT NULL
          AND (p_feeder_id IS NULL OR t.feeder_id = p_feeder_id)
    ),
    -- drop a point that repeats the one before it
    deduped AS (
        SELECT feeder_id, geom, rn
        FROM (
            SELECT feeder_id, geom, rn,
                   lag(geom) OVER (PARTITION BY feeder_id ORDER BY rn) AS prev
            FROM ordered
        ) x
        WHERE prev IS NULL OR NOT ST_Equals(geom, prev)
    ),
    built AS (
        SELECT feeder_id,
               count(*)                            AS npts,
               ST_MakeLine(geom ORDER BY rn)        AS line
        FROM deduped
        GROUP BY feeder_id
    )
    UPDATE gis.line l
    SET route       = CASE WHEN b.npts >= 2 THEN b.line::geography END,
        tower_count = b.npts
    FROM built b
    WHERE l.feeder_id = b.feeder_id;

    GET DIAGNOSTICS n = ROW_COUNT;

    -- feeders with no usable towers at all
    UPDATE gis.line
    SET route = NULL, tower_count = 0
    WHERE (p_feeder_id IS NULL OR feeder_id = p_feeder_id)
      AND feeder_id NOT IN (
          SELECT feeder_id FROM gis.tower
          WHERE location IS NOT NULL AND feeder_id IS NOT NULL
      );

    RETURN n;
END;
$$;

COMMENT ON FUNCTION gis.rebuild_line_routes(integer) IS
    'Rebuild gis.line.route from gis.tower for one feeder, or all feeders when '
    'passed NULL. Call after any tower insert, move or delete.';

SELECT gis.rebuild_line_routes();

COMMIT;

ANALYZE gis.line;
ANALYZE gis.tower;


-- =====================================================================
-- Report
-- =====================================================================
SELECT 'lines'                 AS item, count(*)::text AS value FROM gis.line
UNION ALL SELECT '  with route',      count(*)::text FROM gis.line WHERE route IS NOT NULL
UNION ALL SELECT '  no route',        count(*)::text FROM gis.line WHERE route IS NULL
UNION ALL SELECT 'towers',            count(*)::text FROM gis.tower
UNION ALL SELECT '  with location',   count(*)::text FROM gis.tower WHERE location IS NOT NULL
UNION ALL SELECT '  no location',     count(*)::text FROM gis.tower WHERE location IS NULL
UNION ALL SELECT '  orphan feeder',   count(*)::text FROM gis.tower WHERE feeder_id IS NULL
UNION ALL SELECT '  no seq_no',       count(*)::text FROM gis.tower WHERE seq_no IS NULL
UNION ALL SELECT '  outside TG box',  count(*)::text FROM gis.tower
          WHERE location IS NOT NULL
            AND NOT ST_Intersects(location,
                    ST_MakeEnvelope(75.0, 15.0, 85.0, 20.0, 4326)::geography);

-- Longest and shortest routes, as a sanity check on the ordering. A route
-- far longer than its line's length_ckm means the towers are being joined
-- in the wrong order and the polyline is zig-zagging.
SELECT l.feeder_id, l.feeder_name, l.volt_class, l.tower_count,
       round((ST_Length(l.route) / 1000)::numeric, 1) AS route_km,
       l.length_ckm
FROM gis.line l
WHERE l.route IS NOT NULL
ORDER BY ST_Length(l.route) DESC
LIMIT 10;

-- Routes that are more than twice their recorded circuit length: the most
-- likely sign of a bad tower order.
SELECT l.feeder_id, l.feeder_name, l.tower_count,
       round((ST_Length(l.route) / 1000)::numeric, 1) AS route_km,
       l.length_ckm
FROM gis.line l
WHERE l.route IS NOT NULL
  AND l.length_ckm > 0
  AND (ST_Length(l.route) / 1000) > (l.length_ckm * 2)
ORDER BY (ST_Length(l.route) / 1000) / l.length_ckm DESC
LIMIT 20;
