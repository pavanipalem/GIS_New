-- =====================================================================
-- 003 — backfill gis.substation / transformer / substation_equipment
--       from legacy_raw."substations-template" (408 rows, 143 flat columns)
--
-- RE-RUNNABLE: truncates the three gis tables first, so you can fix a
-- parsing rule and run it again. Reads legacy_raw, never writes to it.
--
--   psql -h 172.17.4.194 -U postgres -d gisdata -f 003_backfill_substations.sql
--
-- What it does:
--   ptr1_*..ptr9_* (+ "PTRn_Volt Level")  -> gis.transformer, one row per slot
--   shnt_rctr__* / capacitor_* / station_transformer_*
--                                         -> gis.substation_equipment
--   longitude / latitude                  -> substation.location  (Point)
--   long1/lat1 .. long15/lat15            -> substation.boundary  (Polygon)
--   free-text numerics and dates          -> parsed, originals kept in *_raw
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Parsing helpers
-- ---------------------------------------------------------------------

-- Legacy numeric columns are text and often blank.
CREATE OR REPLACE FUNCTION gis.parse_numeric(raw text)
RETURNS numeric AS $$
DECLARE
    s text := btrim(coalesce(raw, ''));
BEGIN
    IF s = '' OR s !~ '^-?[0-9]+(\.[0-9]+)?$' THEN
        RETURN NULL;
    END IF;
    RETURN s::numeric;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ptrN_yoc formats seen in the data:
--   28.12.2018   25-11-2015   10-1-2015   18-09-15   25.7.2024   7/8/2009
-- Day-first throughout (Indian convention): 7/8/2009 is 7 August 2009.
-- Two-digit years <= 40 map to 2000s, otherwise 1900s.
-- Year-only values and free text return NULL here — see parse_legacy_year.
CREATE OR REPLACE FUNCTION gis.parse_legacy_date(raw text)
RETURNS date AS $$
DECLARE
    s   text := btrim(coalesce(raw, ''));
    m   text[];
    dd  int;
    mm  int;
    yy  int;
BEGIN
    IF s = '' THEN
        RETURN NULL;
    END IF;

    s := replace(replace(s, '.', '-'), '/', '-');
    m := regexp_match(s, '^([0-9]{1,2})-([0-9]{1,2})-([0-9]{2}|[0-9]{4})$');
    IF m IS NULL THEN
        RETURN NULL;
    END IF;

    dd := m[1]::int;
    mm := m[2]::int;
    yy := m[3]::int;

    IF length(m[3]) = 2 THEN
        yy := CASE WHEN yy <= 40 THEN 2000 + yy ELSE 1900 + yy END;
    END IF;

    IF mm NOT BETWEEN 1 AND 12 OR dd NOT BETWEEN 1 AND 31
       OR yy NOT BETWEEN 1900 AND 2100 THEN
        RETURN NULL;
    END IF;

    RETURN make_date(yy, mm, dd);   -- raises on e.g. 31-02, caught below
EXCEPTION
    WHEN others THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Year from either a full date or a bare "2024" / "1985".
CREATE OR REPLACE FUNCTION gis.parse_legacy_year(raw text)
RETURNS smallint AS $$
DECLARE
    s text := btrim(coalesce(raw, ''));
    d date;
BEGIN
    IF s = '' THEN
        RETURN NULL;
    END IF;

    d := gis.parse_legacy_date(s);
    IF d IS NOT NULL THEN
        RETURN extract(year from d)::smallint;
    END IF;

    IF s ~ '^(19|20)[0-9]{2}$' THEN
        RETURN s::smallint;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trim to NULL, so blank legacy strings do not become empty-string values.
CREATE OR REPLACE FUNCTION gis.tnull(raw text)
RETURNS text AS $$
    SELECT nullif(btrim(coalesce($1, '')), '');
$$ LANGUAGE sql IMMUTABLE;


-- ---------------------------------------------------------------------
-- Clear previous run (children first — FKs cascade, but be explicit)
-- ---------------------------------------------------------------------
TRUNCATE gis.substation_equipment, gis.transformer, gis.substation RESTART IDENTITY;


-- ---------------------------------------------------------------------
-- 1. Substations
-- ---------------------------------------------------------------------
INSERT INTO gis.substation (
    ss_code, ss_name, ss_type, volt_class, volt_levels, primary_mva_cap, no_of_ptrs,
    district, zone, circle, division, plant_circle,
    manned, generation, gen_type, scada, railway_tss, gis_type, ehv_consumer,
    rad_grid, dg_set, dg_and_ff_system, contact_no,
    function_loc_code, sap_erp_connectivity, rrsc_ss_code, ss_erp_source,
    ss_doc, link_sld, link_ss_photo, link_ss_layout,
    location,
    inserted_by, inserted_at, updated_by, updated_at
)
SELECT
    s.ss_codes,
    gis.tnull(s.ss_name),
    gis.tnull(s.ss_type),
    gis.tnull(s.volt_class),
    gis.tnull(s.volt_levels),
    gis.parse_numeric(s.primary_mva_cap),
    gis.parse_numeric(s.no_of_ptrs)::smallint,
    gis.tnull(s.district),
    gis.tnull(s.zone),
    gis.tnull(s.circle),
    gis.tnull(s.division),
    gis.tnull(s.plant_circle),
    gis.tnull(s.manned),
    gis.tnull(s.generation),
    gis.tnull(s.gen_type),
    gis.tnull(s.scada),
    gis.tnull(s.railway_tss),
    gis.tnull(s.gis),                 -- legacy column literally named "gis"
    gis.tnull(s.ehv_consumer),
    gis.tnull(s.rad_grid),
    gis.tnull(s.dg_set),
    gis.tnull(s.dg_and_ff_system),
    gis.tnull(s.contact_no),
    gis.tnull(s.function_loc_code),
    gis.tnull(s.sap_erp_connectivity),
    gis.tnull(s.rrsc_ss_code),
    gis.tnull(s.ss_erp_source),
    gis.tnull(s.ss_doc),
    gis.tnull(s.link_sld),
    gis.tnull(s.link_ss_photo),
    gis.tnull(s.link_ss_layout),
    CASE
        WHEN gis.parse_numeric(s.longitude) BETWEEN -180 AND 180
         AND gis.parse_numeric(s.latitude)  BETWEEN  -90 AND  90
        THEN ST_SetSRID(ST_MakePoint(
                 gis.parse_numeric(s.longitude)::float8,
                 gis.parse_numeric(s.latitude)::float8), 4326)::geography
    END,
    gis.tnull(s.insertedby),
    s.inserteddate,
    gis.tnull(s.updatedby),
    s.updateddate
FROM legacy_raw."substations-template" s;


-- ---------------------------------------------------------------------
-- 2. Boundary polygons from long1/lat1 .. long15/lat15
--
--    195 substations carry a single point and get boundary = NULL.
--    Duplicate coordinates (the legacy data often repeats point 1 to close
--    the ring) are dropped, then the ring is closed explicitly.
--    A ring that will not form a valid polygon is repaired with
--    ST_MakeValid; if repair yields anything but one polygon, NULL is kept
--    and the row is listed in the report at the end.
-- ---------------------------------------------------------------------
WITH raw_pts AS (
    SELECT s.ss_codes,
           p.ord,
           gis.parse_numeric(p.lon)::float8 AS lon,
           gis.parse_numeric(p.lat)::float8 AS lat
    FROM legacy_raw."substations-template" s
    CROSS JOIN LATERAL (VALUES
        ( 1, s.long1,  s.lat1),  ( 2, s.long2,  s.lat2),  ( 3, s.long3,  s.lat3),
        ( 4, s.long4,  s.lat4),  ( 5, s.long5,  s.lat5),  ( 6, s.long6,  s.lat6),
        ( 7, s.long7,  s.lat7),  ( 8, s.long8,  s.lat8),  ( 9, s.long9,  s.lat9),
        (10, s.long10, s.lat10), (11, s.long11, s.lat11), (12, s.long12, s.lat12),
        (13, s.long13, s.lat13), (14, s.long14, s.lat14), (15, s.long15, s.lat15)
    ) AS p(ord, lon, lat)
),
valid_pts AS (
    SELECT * FROM raw_pts
    WHERE lon IS NOT NULL AND lat IS NOT NULL
      AND lon BETWEEN -180 AND 180
      AND lat BETWEEN  -90 AND  90
),
-- keep first occurrence of each distinct coordinate, preserving order
distinct_pts AS (
    SELECT DISTINCT ON (ss_codes, lon, lat) ss_codes, ord, lon, lat
    FROM valid_pts
    ORDER BY ss_codes, lon, lat, ord
),
rings AS (
    SELECT ss_codes,
           count(*) AS npts,
           ST_MakeLine(ST_SetSRID(ST_MakePoint(lon, lat), 4326) ORDER BY ord) AS line
    FROM distinct_pts
    GROUP BY ss_codes
),
polys AS (
    SELECT ss_codes,
           ST_MakePolygon(ST_AddPoint(line, ST_StartPoint(line))) AS geom
    FROM rings
    WHERE npts >= 3
),
repaired AS (
    SELECT ss_codes,
           CASE
               WHEN ST_IsValid(geom) THEN geom
               WHEN ST_NumGeometries(ST_CollectionExtract(ST_MakeValid(geom), 3)) = 1
                   THEN ST_GeometryN(ST_CollectionExtract(ST_MakeValid(geom), 3), 1)
           END AS geom
    FROM polys
)
UPDATE gis.substation s
SET boundary = r.geom::geography
FROM repaired r
WHERE s.ss_code = r.ss_codes
  AND r.geom IS NOT NULL;


-- ---------------------------------------------------------------------
-- 3. Transformers — unpivot ptr1_*..ptr9_* into one row per populated slot
-- ---------------------------------------------------------------------
INSERT INTO gis.transformer (
    ss_code, slot_no, capacity_mva, serial_no, make, vector_group,
    year_of_commissioning, yoc_year, yoc_raw, po_reference, volt_level
)
SELECT
    s.ss_codes,
    t.slot,
    gis.parse_numeric(t.cap),
    gis.tnull(t.slno),
    gis.tnull(t.mk),
    gis.tnull(t.vg),
    gis.parse_legacy_date(t.yoc),
    gis.parse_legacy_year(t.yoc),
    gis.tnull(t.yoc),
    gis.tnull(t.po),
    gis.tnull(t.vl)
FROM legacy_raw."substations-template" s
CROSS JOIN LATERAL (VALUES
    (1, s.ptr1_cap, s.ptr1_slno, s.ptr1_make, s.ptr1_vectorgrp, s.ptr1_yoc, s.ptr1_po, s."PTR1_Volt Level"),
    (2, s.ptr2_cap, s.ptr2_slno, s.ptr2_make, s.ptr2_vectorgrp, s.ptr2_yoc, s.ptr2_po, s."PTR2_Volt Level"),
    (3, s.ptr3_cap, s.ptr3_slno, s.ptr3_make, s.ptr3_vectorgrp, s.ptr3_yoc, s.ptr3_po, s."PTR3_Volt Level"),
    (4, s.ptr4_cap, s.ptr4_slno, s.ptr4_make, s.ptr4_vectorgrp, s.ptr4_yoc, s.ptr4_po, s."PTR4_Volt Level"),
    (5, s.ptr5_cap, s.ptr5_slno, s.ptr5_make, s.ptr5_vectorgrp, s.ptr5_yoc, s.ptr5_po, s."PTR5_Volt Level"),
    (6, s.ptr6_cap, s.ptr6_slno, s.ptr6_make, s.ptr6_vectorgrp, s.ptr6_yoc, s.ptr6_po, s."PTR6_Volt Level"),
    (7, s.ptr7_cap, s.ptr7_slno, s.ptr7_make, s.ptr7_vectorgrp, s.ptr7_yoc, s.ptr7_po, s."PTR7_Volt Level"),
    (8, s.ptr8_cap, s.ptr8_slno, s.ptr8_make, s.ptr8_vectorgrp, s.ptr8_yoc, s.ptr8_po, s."PTR8_Volt Level"),
    (9, s.ptr9_cap, s.ptr9_slno, s.ptr9_make, s.ptr9_vectorgrp, s.ptr9_yoc, s.ptr9_po, s."PTR9_Volt Level")
) AS t(slot, cap, slno, mk, vg, yoc, po, vl)
-- skip slots where every field is blank
WHERE coalesce(gis.tnull(t.cap), gis.tnull(t.slno), gis.tnull(t.mk), gis.tnull(t.vg),
               gis.tnull(t.yoc), gis.tnull(t.po), gis.tnull(t.vl)) IS NOT NULL;


-- ---------------------------------------------------------------------
-- 4. Other equipment — shunt reactor, capacitor, station transformer
-- ---------------------------------------------------------------------
INSERT INTO gis.substation_equipment (
    ss_code, kind, capacity_mva, serial_no, make, vector_group,
    year_of_commissioning, yoc_year, yoc_raw, po_reference
)
SELECT
    s.ss_codes,
    e.kind::gis.equipment_kind,
    gis.parse_numeric(e.cap),
    gis.tnull(e.slno),
    gis.tnull(e.mk),
    gis.tnull(e.vg),
    gis.parse_legacy_date(e.yoc),
    gis.parse_legacy_year(e.yoc),
    gis.tnull(e.yoc),
    gis.tnull(e.po)
FROM legacy_raw."substations-template" s
CROSS JOIN LATERAL (VALUES
    ('shunt_reactor',       s.shnt_rctr__cap, s.shnt_rctr__slno, s.shnt_rctr__make,
                            s.shnt_rctr__vectorgrp, s.shnt_rctr__yoc, s.shnt_rctr__po),
    ('capacitor',           s.capacitor_cap,  s.capacitor_slno,  s.capacitor_make,
                            NULL,                   s.capacitor_yoc,  NULL),
    ('station_transformer', s.station_transformer_capacity, s.station_transformer_serialno,
                            s.station_transformer_make, NULL, NULL, NULL)
) AS e(kind, cap, slno, mk, vg, yoc, po)
WHERE coalesce(gis.tnull(e.cap), gis.tnull(e.slno), gis.tnull(e.mk),
               gis.tnull(e.vg), gis.tnull(e.yoc), gis.tnull(e.po)) IS NOT NULL;

COMMIT;


-- =====================================================================
-- Report
-- =====================================================================
SELECT 'substations'          AS item, count(*)::text AS value FROM gis.substation
UNION ALL SELECT 'with location',  count(*)::text FROM gis.substation WHERE location IS NOT NULL
UNION ALL SELECT 'with boundary',  count(*)::text FROM gis.substation WHERE boundary IS NOT NULL
UNION ALL SELECT 'transformers',   count(*)::text FROM gis.transformer
UNION ALL SELECT '  yoc full date', count(*)::text FROM gis.transformer
          WHERE year_of_commissioning IS NOT NULL
UNION ALL SELECT '  yoc year only', count(*)::text FROM gis.transformer
          WHERE year_of_commissioning IS NULL AND yoc_year IS NOT NULL
UNION ALL SELECT '  yoc unparsed',  count(*)::text FROM gis.transformer
          WHERE yoc_year IS NULL AND yoc_raw IS NOT NULL
UNION ALL SELECT 'equipment rows',  count(*)::text FROM gis.substation_equipment;

-- Substations that had >= 3 points but still ended up without a polygon
-- (ring could not be repaired into a single valid polygon):
SELECT s.ss_code, s.ss_name
FROM gis.substation s
WHERE s.boundary IS NULL
  AND (
    SELECT count(*) FROM (
        SELECT DISTINCT gis.parse_numeric(p.lon), gis.parse_numeric(p.lat)
        FROM legacy_raw."substations-template" l
        CROSS JOIN LATERAL (VALUES
            (l.long1,l.lat1),(l.long2,l.lat2),(l.long3,l.lat3),(l.long4,l.lat4),
            (l.long5,l.lat5),(l.long6,l.lat6),(l.long7,l.lat7),(l.long8,l.lat8),
            (l.long9,l.lat9),(l.long10,l.lat10),(l.long11,l.lat11),(l.long12,l.lat12),
            (l.long13,l.lat13),(l.long14,l.lat14),(l.long15,l.lat15)
        ) AS p(lon, lat)
        WHERE l.ss_codes = s.ss_code
          AND gis.parse_numeric(p.lon) IS NOT NULL
          AND gis.parse_numeric(p.lat) IS NOT NULL
    ) d
  ) >= 3
ORDER BY s.ss_code;

-- Values that did not parse, for eyeballing:
--   SELECT DISTINCT yoc_raw FROM gis.transformer WHERE yoc_year IS NULL AND yoc_raw IS NOT NULL;
--   SELECT ss_codes, no_of_ptrs FROM legacy_raw."substations-template"
--   WHERE gis.tnull(no_of_ptrs) IS NOT NULL AND gis.parse_numeric(no_of_ptrs) IS NULL;
