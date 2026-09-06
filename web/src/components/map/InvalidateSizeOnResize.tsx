import { useEffect } from "react";
import { useMap } from "react-leaflet";

/** Keeps Leaflet's cached container dimensions in sync with the real element.
 *
 * Leaflet measures its container once and then only recalculates on a window
 * resize. If the container itself changes size without the window doing so -
 * the layout settling after mount, a sidebar collapsing, a split pane being
 * dragged - the map keeps the stale dimensions. Tiles still paint, but the
 * overlay pane is sized and offset for the old viewport, so markers and
 * polylines land outside the visible area and the map looks empty.
 *
 * A ResizeObserver on the container covers both cases, window resizes
 * included.
 */
export function InvalidateSizeOnResize() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      // animate:false - this is a correction, not a user-visible transition
      map.invalidateSize(false);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}
