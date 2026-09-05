-- =====================================================================
-- 003 — record how each substation boundary polygon was derived
--
-- The legacy long1/lat1 .. long15/lat15 columns store points in
-- data-entry order, not ring order. Connecting them 1->2->3->... produces
-- a self-intersecting ring for 57 of the 213 substations that have three
-- or more points, so those boundaries have to be rebuilt from the same
-- vertices in a different order. This column records which strategy each
-- boundary came from, so the rebuilt ones can be reviewed rather than
-- silently trusted.
--
--   psql -h 172.17.4.194 -U postgres -d gisdata -f 003_add_boundary_method.sql
-- =====================================================================

BEGIN;

ALTER TABLE gis.substation
    ADD COLUMN IF NOT EXISTS boundary_method varchar(20);

COMMENT ON COLUMN gis.substation.boundary_method IS
    'How boundary was derived from the legacy long1..long15/lat1..lat15 columns: '
    'legacy_order = the stored point order already formed a valid ring; '
    'radial_sort = same points re-ordered by angle about their centroid, because '
    'the stored order self-intersected; '
    'convex_hull = radial sort still failed, so the hull of the same points; '
    'NULL = fewer than 3 distinct points, or no polygon possible.';

ALTER TABLE gis.substation
    DROP CONSTRAINT IF EXISTS ck_substation_boundary_method;

ALTER TABLE gis.substation
    ADD CONSTRAINT ck_substation_boundary_method
    CHECK (boundary_method IS NULL
           OR boundary_method IN ('legacy_order', 'radial_sort', 'convex_hull'));

CREATE INDEX IF NOT EXISTS ix_substation_boundary_method
    ON gis.substation (boundary_method);

UPDATE gis.alembic_version SET version_num = '0003';

COMMIT;

-- =====================================================================
-- Verify
-- =====================================================================
-- SELECT boundary_method, count(*) FROM gis.substation GROUP BY 1 ORDER BY 1;
-- SELECT version_num FROM gis.alembic_version;   -- 0003
