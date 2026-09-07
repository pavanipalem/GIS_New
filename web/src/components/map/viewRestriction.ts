import L from "leaflet";

/** The map view restriction carried over from drawmap() in arcgisScript.js.
 *
 * The old map refused to show anything above latitude 24, which keeps north
 * India out of view - Telangana's northern tip is around 19.9, so the limit
 * leaves plenty of context above the state without letting the map wander to
 * Delhi. East, west and south were left effectively unrestricted, so the
 * bounds span the full longitude range and run down to Leaflet's southern
 * limit.
 */
export const MAX_ALLOWED_LAT = 24.0;

export const ALLOWED_BOUNDS = L.latLngBounds(
  L.latLng(-85.05112878, -180),
  L.latLng(MAX_ALLOWED_LAT, 180)
);

/** Zoom limits from the same options object. 17 is below what OSM serves,
 * but it is the depth the legacy map allowed and tower detail arrives well
 * before it. */
export const MIN_ZOOM = 5;
export const MAX_ZOOM = 17;
