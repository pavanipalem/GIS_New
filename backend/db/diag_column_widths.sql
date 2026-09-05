-- =====================================================================
-- Diagnostic: how wide is the legacy text data really?
--
-- The tower columns in legacy_raw are unbounded `text`, so the varchar
-- widths in gis.tower / gis.line were a guess. This measures the real
-- maximum length of every column being loaded into a bounded varchar and
-- flags the ones that do not fit.
--
-- Read-only. Safe to run any time.
--
--   psql -h 172.17.4.194 -U postgres -d gisdata -f diag_column_widths.sql
-- =====================================================================

SELECT source_table, column_name, max_len, target_width,
       CASE WHEN max_len > target_width THEN 'TOO SMALL' ELSE 'ok' END AS status
FROM (
    -- ---------------- towers: legacy_raw."Feeders-Towers-template" ----
    SELECT 'tower' AS source_table, 'location_no'       AS column_name,
           max(length("LOCATION NO"))                  AS max_len,  50 AS target_width
      FROM legacy_raw."Feeders-Towers-template"
    UNION ALL SELECT 'tower', 'tower_extension',
           max(length("TOWER EXTENSION")),              50
      FROM legacy_raw."Feeders-Towers-template"
    UNION ALL SELECT 'tower', 'volt_class',
           max(length(volt_class)),                     50
      FROM legacy_raw."Feeders-Towers-template"
    UNION ALL SELECT 'tower', 'inserted_by',
           max(length(insertedby)),                     50
      FROM legacy_raw."Feeders-Towers-template"
    UNION ALL SELECT 'tower', 'updated_by',
           max(length(updatedby)),                      50
      FROM legacy_raw."Feeders-Towers-template"
    UNION ALL SELECT 'tower', 'tower_type',
           max(length("TYPE OF TOWER")),               100
      FROM legacy_raw."Feeders-Towers-template"
    UNION ALL SELECT 'tower', 'circuit_type',
           max(length("TYPE OF CIRCUIT")),             100
      FROM legacy_raw."Feeders-Towers-template"
    UNION ALL SELECT 'tower', 'zone',
           max(length(zone)),                          100
      FROM legacy_raw."Feeders-Towers-template"
    UNION ALL SELECT 'tower', 'circle',
           max(length(circle)),                        100
      FROM legacy_raw."Feeders-Towers-template"
    UNION ALL SELECT 'tower', 'rrsc_line_code',
           max(length(rrsc_line_code)),                100
      FROM legacy_raw."Feeders-Towers-template"
    UNION ALL SELECT 'tower', 'make',
           max(length("MAKE OF TOWER")),               150
      FROM legacy_raw."Feeders-Towers-template"
    UNION ALL SELECT 'tower', 'towers_utilized',
           max(length("Types of Towers Utilized")),    150
      FROM legacy_raw."Feeders-Towers-template"
    UNION ALL SELECT 'tower', 'soil_strata',
           max(length("SOIL STRATA")),                 150
      FROM legacy_raw."Feeders-Towers-template"
    UNION ALL SELECT 'tower', 'foundation_class',
           max(length("CLASSIFICATION OF FOUNDATION")),150
      FROM legacy_raw."Feeders-Towers-template"
    UNION ALL SELECT 'tower', 'earthing_type',
           max(length("TYPE OF EARTHING")),            150
      FROM legacy_raw."Feeders-Towers-template"
    UNION ALL SELECT 'tower', 'earth_wire_type',
           max(length("TYPE OF EARTH WIRE/OPGW")),     150
      FROM legacy_raw."Feeders-Towers-template"
    UNION ALL SELECT 'tower', 'telecom_joint_box',
           max(length("Telecom JointBox")),            150
      FROM legacy_raw."Feeders-Towers-template"

    -- ---------------- lines: legacy_raw."lines-template" -------------
    UNION ALL SELECT 'line', 'volt_class',
           max(length("VOLT_CLASS")),                   50
      FROM legacy_raw."lines-template"
    UNION ALL SELECT 'line', 'inserted_by',
           max(length("InsertedBY")),                   50
      FROM legacy_raw."lines-template"
    UNION ALL SELECT 'line', 'updated_by',
           max(length("UpdatedBy")),                    50
      FROM legacy_raw."lines-template"
    UNION ALL SELECT 'line', 'circuit_type',
           max(length("TYPE_OF_CIRCUIT")),             100
      FROM legacy_raw."lines-template"
    UNION ALL SELECT 'line', 'conductor_type',
           max(length("TYPE_OF_CONDUCTOR")),           100
      FROM legacy_raw."lines-template"
    UNION ALL SELECT 'line', 'earth_wire_type',
           max(length("TYPE_OF_EARTH_WIRE/OPGW")),     100
      FROM legacy_raw."lines-template"
    UNION ALL SELECT 'line', 'zone',
           max(length("ZONE")),                        100
      FROM legacy_raw."lines-template"
    UNION ALL SELECT 'line', 'circle',
           max(length("CIRCLE")),                      100
      FROM legacy_raw."lines-template"
    UNION ALL SELECT 'line', 'sap_fl_code',
           max(length("SAP_FL_CODE")),                 100
      FROM legacy_raw."lines-template"
    UNION ALL SELECT 'line', 'feeder_name',
           max(length("FEEDER_NAME")),                 150
      FROM legacy_raw."lines-template"
    UNION ALL SELECT 'line', 'from_substation',
           max(length("FROM")),                        150
      FROM legacy_raw."lines-template"
    UNION ALL SELECT 'line', 'to_substation',
           max(length("TO")),                          150
      FROM legacy_raw."lines-template"
    UNION ALL SELECT 'line', 'jurisdiction',
           max(length("JURISDICTION")),                150
      FROM legacy_raw."lines-template"
) w
ORDER BY status DESC, (max_len::float / target_width) DESC NULLS LAST;
