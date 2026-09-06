# TGTransco GIS — Web

React + TypeScript + Vite frontend, rebuilding `MapView.aspx` against the
FastAPI backend in `../backend`.

## Setup

```bash
npm install
cp .env.example .env.development    # git-ignored; edit if the API is elsewhere
npm run dev                          # http://localhost:5173
```

The backend must be running on the URL in `VITE_API_BASE_URL`
(`http://localhost:8000/api` by default), and that origin must appear in the
backend's `CORS_ORIGINS`.

`npm run build` type-checks then builds; `npm run lint` runs oxlint.

## Layout

```
src/
  api/        client (JWT + refresh-on-401), auth, map, users
  auth/       AuthContext, RequireAuth route guard
  components/AppLayout.tsx   top bar + nav shell
  components/map/
              PointLayer          shared CircleMarker renderer
              LineLayer           polylines + click-to-load towers
              SubstationLayerGroup / LineLayerGroup   one per voltage class
              useLayerData        lazy fetch-once-per-layer hook
  pages/      LoginPage, ChangePasswordPage, MapPage,
              SubstationListPage / DetailPage / EditPage
  types/      mirrors the backend Pydantic schemas field-for-field
```

## Notes

**Layers load lazily.** `useLayerData` fetches a layer the first time its
checkbox is ticked and caches it for the session. These are near-static
reference datasets (largest is 1,959 rows), so there is nothing to refetch.

**Lines are polylines, not tower markers.** `line.route` comes from the server
as a path, so a whole voltage class costs ~900 paths instead of ~105,000
points. Clicking a line fetches that feeder's towers on demand.

**Towers appear on zoom, matching the legacy behaviour.** Past zoom 13,
`TowerViewportLayer` fetches whatever is in the current viewport via
`/api/map/towers?bbox=`, debounced on pan/zoom, and draws each tower the way
`arcgisScript.js` did: a 50 metre real-world circle (so they grow as you zoom),
a hover label of location number + tower type, and a click popup carrying the
line's feeder name, length, circuit and conductor type alongside the tower's
own fields.

Colours follow the legacy precedence exactly: yellow `#FFFF00` when the tower
has a Telecom JointBox, orange `#f58c00` when `ADDITIONAL INFO` is `"UC"`,
otherwise the line's voltage colour, and grey for a tower whose feeder matches
no line.

Zoom 13 is the floor because a 50 m circle renders to roughly 1.4 px at z12 and
is effectively invisible; it is ~2.7 px at z13 and ~5.4 px at z14. The endpoint
refuses more than 5,000 towers in one scope, so the layer shows a "zoom in
further" notice rather than failing silently.

Below zoom 13 the viewport layer is off, and clicking a line still loads that
one feeder's towers — the two never draw at once.

**District boundaries.** The 33 post-reorganisation Telangana districts are
shaded from `public/telangana-districts.json`, copied from the legacy
`Content/TelanganaDistricts.json`. Fill colours are extracted from
`arcgisScript.js` into `districtColours.ts` so the map keeps the shading users
know — all 33 names match the GeoJSON exactly, checked rather than assumed.

The legacy style object itself was not copied: it set `Color` (capital C),
`fillopacity` (lowercase o) and `opacity: 3`, none of which Leaflet reads, so
the districts never rendered the way that code intended. The layer takes the
intent instead — the district fill at 0.45 opacity with a thin dark border —
and sits in its own pane at z-index 350, below Leaflet's overlay pane, so
substations, routes and towers always draw on top.

**CircleMarker everywhere, no marker icons.** Sidesteps the Leaflet
default-icon-path problem under bundlers entirely; colour already carries the
per-layer meaning.

**Legacy users must be reset before they can sign in.** Their plaintext
passwords were never migrated, so `import-legacy-users` gives them an unusable
hash. An admin issues a temp password via `POST /api/users/{id}/reset-password`,
the user signs in with it, and `RequireAuth` forces them through
`/change-password` before anything else.


## Substation pages

List (paged, searchable by name/code/district, filterable by voltage), detail,
and an edit form that mirrors the legacy `SubstationData.aspx` layout: nine
fixed transformer slots, an equipment table for the shunt reactor / capacitor
/ station transformer, and fifteen boundary point pairs.

The boundary points are behind a collapsed section, because nothing on the map
draws substation boundaries - they are kept only because the legacy form
captured them. Leaving latitude/longitude blank falls back to boundary point 1
as the marker position, which is what the old stored procedure did.

Year of commissioning is a free-text field, exactly as the legacy form had it.
The server parses what it can into a real date and a year, and always keeps
the original, so "not commissioned" survives a round trip untouched.

Editing needs the `editor` or `admin` role; viewers get the list and detail
pages without the edit controls, and the API returns 403 if they try anyway.


## Excel import and export

Available on the line list, a line's tower section, solar plants and EHV
consumers. Three actions each: download a blank template, export the current
data, import a filled sheet.

**Templates are generated from the current tables**, not copied from the 2019
workbooks. `backend/app/services/excel_spec.py` holds the column list, and
`validate_specs()` runs at import time to check every column still names a real
schema field — so renaming a field breaks the app loudly rather than producing
a template with a column nothing reads.

Two deliberate differences from the old uploader:

- **Round trips are safe.** A row that keeps its id column updates that record;
  a blank id adds one. The legacy uploader always inserted, so exporting a
  sheet, editing it and re-uploading duplicated every row.
- **All or nothing.** The whole file is applied in one transaction. If any row
  is rejected you get the row number and the reason, and nothing is written —
  a bad cell in row 180 cannot leave 179 rows half-applied.

Towers are always scoped to one line, because the sheet does not carry the
feeder — the same way the old upload took it from whichever line you were
viewing.
