# SQL scripts

Hand-run equivalents of the Alembic migrations, plus the data backfill.
Run them in order.

| File | What it does |
|---|---|
| `001_initial_core.sql` | Schema `gis`, both enums, four core tables + indexes. Stamps `alembic_version = '0001'`. |
| `002_add_yoc_year.sql` | Adds `yoc_year` to `transformer` and `substation_equipment`. Stamps `'0002'`. |
| `003_backfill_substations.sql` | Loads `legacy_raw."substations-template"` into `gis.substation` / `transformer` / `substation_equipment`. Re-runnable. |
| `001_initial_core_rollback.sql` | Drops everything `001` created. |

```bash
psql -h 172.17.4.194 -U postgres -d gisdata -f 001_initial_core.sql
psql -h 172.17.4.194 -U postgres -d gisdata -f 002_add_yoc_year.sql
psql -h 172.17.4.194 -U postgres -d gisdata -f 003_backfill_substations.sql
```

## The backfill

`003` truncates the three `gis` tables and rebuilds them from `legacy_raw`, so
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
- **Two-digit years** ≤ 40 map to 2000s, otherwise 1900s. `18-09-15` is 2015.
- **Year-only values** (`2024`, `1985`) fill `yoc_year` and leave
  `year_of_commissioning` NULL. The original text always survives in `yoc_raw`.
- **Boundaries** need ≥ 3 distinct points. 195 of the 408 substations carry a
  single point, so they get `location` only and `boundary = NULL`. Duplicate
  coordinates are dropped (the legacy rows often repeat point 1 to close the
  ring) and the ring is re-closed explicitly. A ring that will not form a valid
  polygon is repaired with `ST_MakeValid`; if that yields anything but one
  polygon the boundary stays NULL and the row is listed in the report.

The script ends with a summary and a list of any substation that had enough
points but still failed to produce a polygon.
