-- =====================================================================
-- Follow-up verification, round 2.
--
-- Round 1 (verify_101_routes.sql) gave two strong signals that seq_no
-- ordering is correct - check 4 (hop distance, independent of any legacy
-- length field): 902 of 906 feeders under 2km; and check 6: seq_no's total
-- drawn length is a third of location_no's.
--
-- But check 3 put 198 of 906 feeders (22%) in "route_km under half of
-- length_ckm", and check 5's worst offenders had suspiciously round
-- length_ckm values (0.79, 2.000, 8.000, 30.000). Two competing
-- explanations, and this file is here to tell them apart instead of
-- assuming one:
--
--   (a) length_ckm is "circuit kilometres", not route kilometres - e.g. it
--       counts a double-circuit line's two circuits separately, so a
--       correctly-drawn route is legitimately about half of it, and the
--       round numbers are placeholder/estimated entries from data entry,
--       not measurements. Not a routing bug - a source-data quality issue
--       that predates this migration.
--
--   (b) the tower order really is wrong for a meaningful chunk of feeders,
--       and check 4 missed it because a wrong order can still keep every
--       individual hop short (e.g. reversed sub-segments).
--
-- Read-only. Plain SQL, runs in pgAdmin.
-- =====================================================================


-- =====================================================================
-- CHECK 7 — does length_of_line explain the "under 0.5" bucket better
-- than length_ckm does? lines-template carries both. If route_km tracks
-- length_of_line closely for these feeders, length_ckm is measuring
-- something else (circuit-km) and (a) is confirmed for that bucket.
-- =====================================================================
SELECT '7. route_km vs length_of_line, for the under-0.5-by-ckm bucket' AS check,
       count(*) AS feeders_in_bucket,
       count(*) FILTER (WHERE length_of_line > 0)                              AS have_length_of_line,
       round(avg(route_km / nullif(length_ckm, 0))::numeric, 2)                AS avg_ratio_vs_ckm,
       round(avg(route_km / nullif(length_of_line, 0))
             FILTER (WHERE length_of_line > 0)::numeric, 2)                    AS avg_ratio_vs_length_of_line
FROM (
    SELECT feeder_id,
           ST_Length(route) / 1000.0 AS route_km,
           length_ckm,
           length_of_line
    FROM gis.line
    WHERE route IS NOT NULL AND length_ckm > 0
) x
WHERE (route_km / length_ckm) < 0.5;


-- =====================================================================
-- CHECK 8 — the ONE feeder that failed check 4 (hop > 15km). Named
-- explicitly, with its full length context, so it can be looked at
-- directly rather than trusted as "just one, ignore it".
-- =====================================================================
SELECT '8. the check-4 outlier' AS check,
       l.feeder_id, l.feeder_name, l.volt_class, l.tower_count,
       round((ST_Length(l.route) / 1000)::numeric, 1) AS route_km,
       l.length_ckm, l.length_of_line,
       round(h.maxhop_km::numeric, 1) AS worst_hop_km
FROM gis.line l
JOIN (
    SELECT ln.feeder_id,
           max(ST_Distance(
               ST_PointN(ln.route::geometry, gs)::geography,
               ST_PointN(ln.route::geometry, gs + 1)::geography
           )) / 1000.0 AS maxhop_km
    FROM gis.line ln
    CROSS JOIN LATERAL generate_series(1, ST_NPoints(ln.route::geometry) - 1) AS gs
    WHERE ln.route IS NOT NULL AND ST_NPoints(ln.route::geometry) >= 2
    GROUP BY ln.feeder_id
    HAVING max(ST_Distance(
               ST_PointN(ln.route::geometry, gs)::geography,
               ST_PointN(ln.route::geometry, gs + 1)::geography
           )) / 1000.0 > 15
) h ON h.feeder_id = l.feeder_id;


-- =====================================================================
-- CHECK 9 — round-number test on length_ckm. A value ending exactly in
-- .0, .00 or .000 with no finer precision is far more likely a typed
-- estimate than a survey measurement. If the worst-ratio feeders are
-- disproportionately round, that is a source-data flag, not a routing one.
-- =====================================================================
SELECT '9. length_ckm precision by ratio bucket' AS check, bucket,
       count(*) AS feeders,
       count(*) FILTER (WHERE length_ckm = round(length_ckm, 0)) AS whole_number_ckm,
       round(100.0 * count(*) FILTER (WHERE length_ckm = round(length_ckm, 0))
             / count(*), 0) AS pct_whole_number
FROM (
    SELECT length_ckm,
           CASE
             WHEN r < 1.5 THEN 'a. ratio under 1.5 (fine)'
             ELSE               'b. ratio 1.5+ (flagged in check 3/5)'
           END AS bucket
    FROM (
        SELECT length_ckm, (ST_Length(route) / 1000.0) / length_ckm AS r
        FROM gis.line
        WHERE route IS NOT NULL AND length_ckm > 0
    ) x
) y
GROUP BY bucket
ORDER BY bucket;


-- =====================================================================
-- CHECK 10 — direct re-walk of the worst offenders from check 5, this
-- time with length_of_line alongside length_ckm, so each one can be
-- judged instead of assumed.
-- =====================================================================
SELECT '10. worst offenders with length_of_line' AS check,
       l.feeder_id, left(l.feeder_name, 40) AS feeder_name, l.tower_count,
       round((ST_Length(l.route) / 1000)::numeric, 1) AS route_km,
       l.length_ckm, l.length_of_line,
       round(((ST_Length(l.route) / 1000) / nullif(l.length_ckm, 0))::numeric, 1) AS ratio_vs_ckm,
       round(((ST_Length(l.route) / 1000) / nullif(l.length_of_line, 0))::numeric, 1) AS ratio_vs_length_of_line
FROM gis.line l
WHERE l.route IS NOT NULL AND l.length_ckm > 0
ORDER BY (ST_Length(l.route) / 1000) / l.length_ckm DESC
LIMIT 15;
