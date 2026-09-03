# TGTransco GIS — Backend

FastAPI rewrite of the legacy ASP.NET Web Forms GIS application.

## Database layout

| Schema | Role |
|---|---|
| `legacy_raw` | Frozen raw import from SQL Server 2012 (`GISDATA`). Read-only archive — never written to by the app. |
| `gis` | The application schema. Normalized tables, real types, PostGIS geometry, PK/FK constraints. Owned by Alembic. |

A re-runnable backfill reads `legacy_raw` and transforms into `gis`.

## Setup

```bash
python -m venv .venv
.venv/Scripts/activate          # Windows
pip install -e ".[dev]"

cp .env.example .env            # then edit: DATABASE_URL, JWT_SECRET, FIRST_ADMIN_PASSWORD
python -c "import secrets; print(secrets.token_urlsafe(64))"   # value for JWT_SECRET

alembic upgrade head            # creates postgis ext, `gis` schema, core tables
python -m app.cli seed-admin    # first admin from .env
python -m app.cli import-legacy-users   # brings across the 11 legacy usernames
```

Run it:

```bash
uvicorn app.main:app --reload --port 8000
```

Docs at http://localhost:8000/docs

## Auth

- JWT access + refresh tokens. Passwords hashed with bcrypt (legacy stored plaintext — not migrated).
- Roles: `admin` (full access + user management), `editor` (create/update GIS records), `viewer` (read-only).
- Imported legacy users get an unusable password hash and `must_change_password=true`; an admin resets
  them from the web app before they can log in.

## User management

Entirely in the web app — `/api/users` (admin-only):

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/users` | List users |
| POST | `/api/users` | Create user (returns a one-time temp password if none supplied) |
| GET | `/api/users/{id}` | Get one |
| PATCH | `/api/users/{id}` | Change name / role / active flag |
| POST | `/api/users/{id}/reset-password` | Issue a new temp password |

The last active admin cannot be demoted or deactivated.

## Layout

```
app/
  core/       config, db session, security (hash/JWT), dependencies
  models/     SQLAlchemy 2.0 models  -> gis schema
  schemas/    Pydantic request/response
  services/   business logic ported from the legacy stored procedures
  api/        routers
  cli.py      seed-admin / import-legacy-users / list-users
alembic/      migrations (owns the `gis` schema only)
```

## Legacy reference

Source of truth for business logic during the port:

- `../../GIS/` — legacy ASP.NET project (`App_Code/CommonBE.cs`, `CommonBL.cs`, `CommonDBL.cs`, `Forms/*.aspx.cs`)
- `../../script.sql` — dumped SQL Server stored procedures (UTF-16; `script_utf8.sql` is the readable copy)
- `../../PROJECT_HANDOFF.md` — migration + stack decisions
