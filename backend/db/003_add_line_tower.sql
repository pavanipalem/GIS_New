-- =====================================================================
-- 003 — transmission lines and towers
--
-- gis.line   from legacy_raw."lines-template"           (911 rows)
-- gis.tower  from legacy_raw."Feeders-Towers-template"  (105,082 rows)
--
-- legacy_raw.totaltowers gets no table: sp_gisdatamodify deletes it and
-- rebuilds it from exactly this join, filling 9 of its 85 columns. It is a
-- denormalized cache that PostGIS + a GiST index makes unnecessary.
--
-- line.route is the polyline the map draws - this line's towers joined in
-- seq_no order. It is derived from gis.tower, so it is rebuilt rather than
-- edited; see gis.rebuild_line_routes() in 101_backfill_lines_towers.sql.
--
--   psql -h 172.17.4.194 -U postgres -d gisdata -f 003_add_line_tower.sql
-- =====================================================================

BEGIN;

SET LOCAL search_path = gis, public;

-- ----------------------------------------------------------------- line
CREATE TABLE gis.line (
    feeder_id             integer NOT NULL,

    feeder_name           varchar(150),
    volt_class            varchar(50),
    from_substation       varchar(150),
    to_substation         varchar(150),

    total_no_of_locations integer,
    length_ckm            numeric(12, 3),
    length_of_line        numeric(12, 3),
    max_load_in_amp       numeric(12, 2),

    circuit_type          varchar(100),
    conductor_type        varchar(100),
    earth_wire_type       varchar(100),

    date_of_charging      date,
    last_maintenance_date date,

    jurisdiction          varchar(150),
    zone                  varchar(100),
    circle                varchar(100),
    sap_fl_code           varchar(100),
    additional_info       text,

    -- derived from gis.tower; see rebuild_line_routes()
    route                 geography(LineString, 4326),
    tower_count           integer,

    inserted_by           varchar(50),
    inserted_at           timestamptz,
    updated_by            varchar(50),
    updated_at            timestamptz,

    CONSTRAINT pk_line PRIMARY KEY (feeder_id)
);

CREATE INDEX ix_line_route      ON gis.line USING gist (route);
CREATE INDEX ix_line_volt_class ON gis.line (volt_class);
CREATE INDEX ix_line_zone_circle ON gis.line (zone, circle);

-- ---------------------------------------------------------------- tower
CREATE TABLE gis.tower (
    tower_id          bigint  NOT NULL,
    feeder_id         integer,

    location          geography(Point, 4326),
    -- legacy "order": position along the route. Distinct from location_no,
    -- which is the surveyor's label and can run the opposite way (feeder 361
    -- has order 19,20,21 against location numbers 71,70,69).
    seq_no            integer,
    location_no       varchar(50),

    tower_type        varchar(100),
    tower_extension   varchar(50),
    circuit_type      varchar(100),
    make              varchar(150),
    towers_utilized   varchar(150),

    soil_strata       varchar(150),
    foundation_class  varchar(150),

    -- six named insulator ratings, not numbered slots, so they stay flat
    disc_70kn         smallint,
    disc_120kn        smallint,
    disc_160kn        smallint,
    src_70kn          smallint,
    src_120kn         smallint,
    src_160kn         smallint,

    earthing_type     varchar(150),
    earth_wire_type   varchar(150),
    telecom_joint_box varchar(150),
    landmark          text,
    additional_info   text,

    volt_class        varchar(50),
    zone              varchar(100),
    circle            varchar(100),
    sap_id            integer,
    rrsc_line_code    varchar(100),

    inserted_by       varchar(50),
    inserted_at       timestamptz,
    updated_by        varchar(50),

    CONSTRAINT pk_tower PRIMARY KEY (tower_id),
    CONSTRAINT fk_tower_feeder_id_line
        FOREIGN KEY (feeder_id) REFERENCES gis.line (feeder_id) ON DELETE SET NULL
);

CREATE INDEX ix_tower_location   ON gis.tower USING gist (location);
CREATE INDEX ix_tower_feeder_id  ON gis.tower (feeder_id);
CREATE INDEX ix_tower_volt_class ON gis.tower (volt_class);
-- the map draws a feeder's towers in order; this serves both that and the
-- route rebuild
CREATE INDEX ix_tower_feeder_seq ON gis.tower (feeder_id, seq_no);

UPDATE gis.alembic_version SET version_num = '0003';

COMMIT;

-- =====================================================================
-- Verify
-- =====================================================================
-- \dt gis.*
-- SELECT version_num FROM gis.alembic_version;   -- 0003
