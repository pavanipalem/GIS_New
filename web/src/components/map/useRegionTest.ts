import { useEffect, useMemo, useState } from "react";
import {
  buildRegionTest,
  loadRegionGeometry,
  REGION_KEYS,
  type RegionGeometry,
  type RegionKey,
} from "./regionFilter";

/** Turns the selected Region set into a point test, loading the ORR/RRR
 * polygons the first time a real restriction is asked for. Returns null while
 * nothing needs filtering (default "Telangana", or all three sub-regions) or
 * before the geometry has loaded - callers treat null as "show everything".
 */
export function useRegionTest(
  selected: ReadonlySet<RegionKey>
): ((lat: number, lng: number) => boolean) | null {
  const [geom, setGeom] = useState<RegionGeometry | null>(null);

  const needsGeom =
    selected.size > 0 && selected.size < REGION_KEYS.length;

  useEffect(() => {
    if (!needsGeom || geom) return;
    let cancelled = false;
    loadRegionGeometry()
      .then((g) => {
        if (!cancelled) setGeom(g);
      })
      .catch(() => {
        /* leave geom null - the map just shows everything */
      });
    return () => {
      cancelled = true;
    };
  }, [needsGeom, geom]);

  // rebuild only when the selection or the loaded geometry changes
  const key = [...selected].sort().join(",");
  return useMemo(
    () => buildRegionTest(selected, geom),
    // selected is a fresh Set each render; key is its stable form
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, geom]
  );
}
