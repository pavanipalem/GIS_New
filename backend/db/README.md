# SQL scripts

Hand-run equivalents of the Alembic migrations, plus the data backfill.
Run them in order.

| File | What it does |
|---|---|
| `001_initial_core.sql` | Schema `gis`, both enums, four core tables + indexes. Stamps `alembic_version = '0001'`. |
| `002_add_yoc_year.sql` | Adds `yoc_year` to `transformer` and `substation_equipment`. Stamps `'0002'`. |
| `100_backfill_substations.sql` | Loads `legacy_raw."substations-template"` into `gis.substation` / `transformer` / `substation_equipment`. Re-runnable. |
| `001_initial_core_rollback.sql` | Drops everything `001` created. |

`0xx` files are schema changes and mirror `alembic/versions/`. `1xx` files are
data loads and have no Alembic counterpart.

```bash
psql -h 172.17.4.194 -U postgres -d gisdata -f 001_initial_core.sql
psql -h 172.17.4.194 -U postgres -d gisdata -f 002_add_yoc_year.sql
psql -h 172.17.4.194 -U postgres -d gisdata -f 100_backfill_substations.sql
```

## The backfill

`100` truncates the three `gis` tables and rebuilds them from `legacy_raw`, so
you can adjust a parsing rule and run it again. It never writes to `legacy_raw`.

It installs four helper functions in the `gis` schema:

| Function | Purpose |
|---|---|
| `gis.tnull(text)` | Trim to NULL, so blank legacy strings do not become `''` |
| `gis.parse_numeric(text)` | Numeric cast that yields NULL instead of erroring |
| `gis.parse_legacy_date(text)` | Day-first date parser covering the ~8 formats in `ptrN_yoc` |
| `gis.parse_legacy_year(text)` | Year from a full date *or* a bare `2024` |

### Decisions baked into the parsing

- **Dates are day-first.** `7/8/2009` is 7 August 2009, `10-1-2015` is 10 January 2015.
- **Two-digit years** 40 or under map to 2000s, otherwise 1900s. `18-09-15` is 2015.
- **Year-only values** (`2024`, `1985`) fill `yoc_year` and leave
  `year_of_commissioning` NULL. The original text always survives in `yoc_raw`.

### Boundary polygons

Nothing renders these. The legacy map (`Content/arcgisScript.js`) draws
substations with `L.marker` and uses `L.geoJson` only for the Telangana
district outlines - there is no `L.polygon` call in it. `GetMapData` does
return all 15 point pairs plus a computed `longcount`, but no frontend code
reads either.

So `boundary` is filled only where the stored point order already forms a
valid ring. Rings that self-intersect are left NULL rather than reordered -
the vertex order is the surveyor's claim to make, not ours. 195 of the 408
substations carry a single point in any case.

Nothing is lost by this: `legacy_raw` is frozen and keeps every point pair,
so footprints can be built properly the day something actually needs them,
with someone who knows the sites deciding how the points connect.

The script ends with a summary, that review list, and a list of any substation
whose points self-intersect in their stored order.
