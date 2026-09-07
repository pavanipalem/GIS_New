import bpip from "@turf/boolean-point-in-polygon";
import type { Feature, MultiPolygon, Polygon } from "geojson";

/** The three sub-regions that partition Telangana, from the legacy Region
 * filter. Their union is the whole state, which is why selecting all three
 * is the same as "Telangana".
 *
 *   orr            - inside the Outer Ring Road
 *   rrr_excl_orr   - inside the Regional Ring Road but outside the ORR
 *   outside_rrr    - the rest of Telangana, beyond the RRR
 *
 * Geometry comes from Content/orr.json and rrr.json in the legacy app,
 * served here from public/regions/. */
export type RegionKey = "orr" | "rrr_excl_orr" | "outside_rrr";

export const REGION_KEYS: RegionKey[] = ["orr", "rrr_excl_orr", "outside_rrr"];

export const REGION_LABELS: Record<RegionKey, string> = {
  orr: "ORR",
  rrr_excl_orr: "Inside RRR excluding ORR",
  outside_rrr: "In Telangana excluding RRR",
};

type Poly = Feature<Polygon | MultiPolygon>;

export interface RegionGeometry {
  orr: Poly;
  rrr: Poly;
  /** [minLng, minLat, maxLng, maxLat] of the RRR, for a cheap reject before
   * the ray-cast. */
  rrrBbox: [number, number, number, number];
}

function bbox(f: Poly): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const rings =
    f.geometry.type === "MultiPolygon"
      ? f.geometry.coordinates.flat()
      : f.geometry.coordinates;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}

let cache: Promise<RegionGeometry> | null = null;

/** Fetches the two polygons once and caches them. Only called when a
 * non-default Region selection is made, so the 250 KB of GeoJSON is not
 * loaded for the common "whole state" view. */
export function loadRegionGeometry(): Promise<RegionGeometry> {
  if (!cache) {
    cache = Promise.all([
      fetch("/regions/orr.json").then((r) => r.json()),
      fetch("/regions/rrr.json").then((r) => r.json()),
    ]).then(([orr, rrr]) => {
      const orrF = orr.features[0] as Poly;
      const rrrF = rrr.features[0] as Poly;
      return { orr: orrF, rrr: rrrF, rrrBbox: bbox(rrrF) };
    });
    cache.catch(() => {
      cache = null; // let a later selection retry
    });
  }
  return cache;
}

/** Builds the point test for a Region selection, or null when nothing needs
 * restricting - no sub-region selected (the default, "Telangana") or all
 * three selected (their union is the whole state). A null test means "show
 * everything", which the layers treat as a fast path. */
export function buildRegionTest(
  selected: ReadonlySet<RegionKey>,
  geom: RegionGeometry | null
): ((lat: number, lng: number) => boolean) | null {
  if (!geom) return null;
  const active = REGION_KEYS.filter((k) => selected.has(k));
  if (active.length === 0 || active.length === REGION_KEYS.length) return null;

  const [bx0, by0, bx1, by1] = geom.rrrBbox;
  const inRrr = (lng: number, lat: number) =>
    lng >= bx0 &&
    lng <= bx1 &&
    lat >= by0 &&
    lat <= by1 &&
    bpip([lng, lat], geom.rrr);
  const inOrr = (lng: number, lat: number) => bpip([lng, lat], geom.orr);

  const checks: Array<(lng: number, lat: number) => boolean> = [];
  if (selected.has("orr")) checks.push(inOrr);
  if (selected.has("rrr_excl_orr"))
    checks.push((lng, lat) => inRrr(lng, lat) && !inOrr(lng, lat));
  if (selected.has("outside_rrr")) checks.push((lng, lat) => !inRrr(lng, lat));

  return (lat, lng) => checks.some((c) => c(lng, lat));
}

/** A line is in the region if any point of its drawn route is. */
export function routeInRegion(
  path: { lat: number; lng: number }[],
  test: (lat: number, lng: number) => boolean
): boolean {
  return path.some((p) => test(p.lat, p.lng));
}
