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

Towers are deliberately never fetched for the whole viewport:
`/api/map/towers` takes either `feeder_id` or a point + radius, and refuses an
unfiltered request. If per-line inspection turns out not to be enough, a
bbox/viewport tower endpoint would be the follow-up — it does not exist yet.

**CircleMarker everywhere, no marker icons.** Sidesteps the Leaflet
default-icon-path problem under bundlers entirely; colour already carries the
per-layer meaning.

**Legacy users must be reset before they can sign in.** Their plaintext
passwords were never migrated, so `import-legacy-users` gives them an unusable
hash. An admin issues a temp password via `POST /api/users/{id}/reset-password`,
the user signs in with it, and `RequireAuth` forces them through
`/change-password` before anything else.
