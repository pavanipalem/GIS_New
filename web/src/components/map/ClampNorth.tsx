import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { ALLOWED_BOUNDS, MAX_ALLOWED_LAT } from "./viewRestriction";

/** Keeps the view below latitude 24, as clampNorth() did in the legacy
 * drawmap().
 *
 * maxBounds on its own only corrects the view after a gesture ends -
 * Leaflet's default maxBoundsViscosity is 0, so a drag leaves the bounds
 * freely and is pulled back on moveend. Watching `move` as well is what
 * makes the limit hold during the drag rather than snapping back after it.
 *
 * Two guards, both needed:
 *
 * - `clamping` stops recursion. panInsideBounds fires move and moveend
 *   synchronously, which would re-enter this handler.
 *
 * - `zooming` skips the whole zoom animation. Leaflet fires `move`
 *   repeatedly while the animation runs, and a panTo against a viewport
 *   that is still mid-transform computes an offset from a size the map
 *   does not have yet. Correcting on every frame compounds those errors:
 *   zooming out to 5 dragged the view roughly 17 degrees south of the
 *   limit instead of stopping at it. Clamping once on zoomend, when the
 *   view is settled, puts the top edge exactly on the limit.
 */
export function ClampNorth() {
  const map = useMap();
  const clamping = useRef(false);
  const zooming = useRef(false);

  useEffect(() => {
    const clamp = () => {
      if (clamping.current || zooming.current) return;
      if (map.getBounds().getNorth() <= MAX_ALLOWED_LAT) return;
      clamping.current = true;
      map.panInsideBounds(ALLOWED_BOUNDS, { animate: false });
      clamping.current = false;
    };

    const onZoomStart = () => {
      zooming.current = true;
    };
    const onZoomEnd = () => {
      zooming.current = false;
      clamp();
    };

    map.on("move", clamp);
    map.on("moveend", clamp);
    map.on("zoomstart", onZoomStart);
    map.on("zoomend", onZoomEnd);
    clamp();

    return () => {
      map.off("move", clamp);
      map.off("moveend", clamp);
      map.off("zoomstart", onZoomStart);
      map.off("zoomend", onZoomEnd);
    };
  }, [map]);

  return null;
}
