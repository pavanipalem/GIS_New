# SQL scripts

Hand-run equivalents of the Alembic migrations, for when you want to apply
schema changes yourself and see exactly what happens.

| File | What it does |
|---|---|
| `001_initial_core.sql` | Creates the `gis` schema, both enums, and the four core tables (`app_user`, `substation`, `transformer`, `substation_equipment`) with their indexes. Stamps `gis.alembic_version = '0001'`. |
| `001_initial_core_rollback.sql` | Drops everything `001` created. Leaves `legacy_raw` and the postgis extension alone. |

Run:

```bash
psql -h 172.17.4.194 -U postgres -d gisdata -f 001_initial_core.sql
```

## Important

These are kept **in sync by hand** with `alembic/versions/`. Pick one path per
environment and stick to it:

- **Alembic** (`alembic upgrade head`) — normal path for dev and deployment.
- **These scripts** — when a DBA needs to review or apply the DDL directly.

Because `001_initial_core.sql` stamps `gis.alembic_version`, running the script
first and Alembic later is safe: Alembic sees `0001` as already applied and
carries on from `0002`.

Nothing here writes to `legacy_raw`.
