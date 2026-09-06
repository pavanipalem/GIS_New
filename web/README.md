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
  components/map/
              PointLayer          shared CircleMarker renderer
              LineLayer           polylines + click-to-load towers
              SubstationLayerGroup / LineLayerGroup   one per voltage class
              useLayerData        lazy fetch-once-per-layer hook
  pages/      LoginPage, ChangePasswordPage, MapPage
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

**CircleMarker everywhere, no marker icons.** Sidesteps the Leaflet
default-icon-path problem under bundlers entirely; colour already carries the
per-layer meaning.

**Legacy users must be reset before they can sign in.** Their plaintext
passwords were never migrated, so `import-legacy-users` gives them an unusable
hash. An admin issues a temp password via `POST /api/users/{id}/reset-password`,
the user signs in with it, and `RequireAuth` forces them through
`/change-password` before anything else.
