-- =====================================================================
-- Verify the line/tower load, and specifically whether seq_no is a
-- trustworthy route order.
--
-- The polyline design rests on one assumption: that ordering a feeder's
-- towers by seq_no traces the real corridor. If it does not, every route
-- on the map zig-zags. These checks are meant to break that assumption if
-- it is wrong, before anything is built on top of it.
--
-- Read-only.
--
--   psql -h 172.17.4.194 -U postgres -d gisdata -f verify_101_routes.sql
-- =====================================================================

\echo '=== 1. Load counts ==='
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

\echo ''
\echo '=== 2. Is seq_no unique within a feeder? (ties make the order ambiguous) ==='
SELECT
    count(*) FILTER (WHERE dup_seq > 0)  AS feeders_with_duplicate_seq_no,
    count(*)                             AS feeders_checked,
    coalesce(sum(dup_seq), 0)            AS total_duplicate_seq_values
FROM (
    SELECT feeder_id,
           count(*) FILTER (WHERE n > 1) AS dup_seq
    FROM (
        SELECT feeder_id, seq_no, count(*) AS n
        FROM gis.tower
        WHERE feeder_id IS NOT NULL AND seq_no IS NOT NULL
        GROUP BY feeder_id, seq_no
    ) s
    GROUP BY feeder_id
) f;

\echo ''
\echo '=== 3. THE KEY TEST: drawn route length vs recorded circuit length ==='
\echo '    A route ordered correctly tracks length_ckm closely. A zig-zagging'
\echo '    one is far longer. Anything above ~1.5 is suspicious.'
SELECT bucket, count(*) AS feeders
FROM (
    SELECT CASE
             WHEN r IS NULL          THEN 'n/a (no length_ckm)'
             WHEN r < 0.5            THEN 'a. under 0.5  (route too short?)'
             WHEN r < 1.1            THEN 'b. 0.5 - 1.1  GOOD'
             WHEN r < 1.5            THEN 'c. 1.1 - 1.5  plausible'
             WHEN r < 2.0            THEN 'd. 1.5 - 2.0  suspicious'
             WHEN r < 5.0            THEN 'e. 2.0 - 5.0  likely wrong order'
             ELSE                         'f. over 5.0   wrong order'
           END AS bucket
    FROM (
        SELECT CASE WHEN length_ckm > 0
                    THEN (ST_Length(route) / 1000.0) / length_ckm END AS r
        FROM gis.line
        WHERE route IS NOT NULL
    ) x
) y
GROUP BY bucket
ORDER BY bucket;

\echo ''
\echo '=== 4. A second, independent check: longest single hop per feeder ==='
\echo '    Towers on a corridor sit a few hundred metres apart. A route with'
\echo '    a 20km jump in the middle is joining towers in the wrong order,'
\echo '    and this does not depend on length_ckm being accurate.'
SELECT bucket, count(*) AS feeders
FROM (
    SELECT CASE
             WHEN maxhop_km < 2   THEN 'a. under 2km   GOOD'
             WHEN maxhop_km < 5   THEN 'b. 2 - 5km     plausible'
             WHEN maxhop_km < 15  THEN 'c. 5 - 15km    suspicious'
             ELSE                      'd. over 15km   wrong order'
           END AS bucket
    FROM (
        SELECT l.feeder_id,
               max(ST_Distance(
                   ST_PointN(l.route::geometry, gs)::geography,
                   ST_PointN(l.route::geometry, gs + 1)::geography
               )) / 1000.0 AS maxhop_km
        FROM gis.line l
        CROSS JOIN LATERAL generate_series(1, ST_NPoints(l.route::geometry) - 1) AS gs
        WHERE l.route IS NOT NULL
          AND ST_NPoints(l.route::geometry) >= 2
        GROUP BY l.feeder_id
    ) h
) b
GROUP BY bucket
ORDER BY bucket;

\echo ''
\echo '=== 5. The 15 worst offenders, to eyeball ==='
SELECT l.feeder_id, left(l.feeder_name, 42) AS feeder_name, l.volt_class,
       l.tower_count,
       round((ST_Length(l.route) / 1000)::numeric, 1) AS route_km,
       l.length_ckm,
       round(((ST_Length(l.route) / 1000) / nullif(l.length_ckm, 0))::numeric, 1) AS ratio
FROM gis.line l
WHERE l.route IS NOT NULL AND l.length_ckm > 0
ORDER BY (ST_Length(l.route) / 1000) / l.length_ckm DESC
LIMIT 15;

\echo ''
\echo '=== 6. Does ordering by location_no instead do any better? ==='
\echo '    If this total is much lower than the seq_no one, the ordering'
\echo '    rule is backwards and needs changing.'
WITH by_seq AS (
    SELECT sum(ST_Length(route) / 1000.0) AS km FROM gis.line WHERE route IS NOT NULL
),
by_loc AS (
    SELECT sum(ST_Length(ln) / 1000.0) AS km
    FROM (
        SELECT ST_MakeLine(geom ORDER BY rn)::geography AS ln
        FROM (
            SELECT t.feeder_id, t.location::geometry AS geom,
                   row_number() OVER (PARTITION BY t.feeder_id
                                      ORDER BY gis.parse_numeric(t.location_no) NULLS LAST,
                                               t.tower_id) AS rn
            FROM gis.tower t
            WHERE t.location IS NOT NULL AND t.feeder_id IS NOT NULL
        ) o
        GROUP BY feeder_id
        HAVING count(*) >= 2
    ) m
)
SELECT round(by_seq.km::numeric, 0)  AS total_km_ordered_by_seq_no,
       round(by_loc.km::numeric, 0)  AS total_km_ordered_by_location_no,
       CASE WHEN by_seq.km <= by_loc.km
            THEN 'seq_no is the better order (expected)'
            ELSE 'location_no is better - THE ORDERING RULE IS WRONG'
       END AS verdict
FROM by_seq, by_loc;
