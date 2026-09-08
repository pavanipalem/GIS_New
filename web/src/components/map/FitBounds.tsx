import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

/** Fits the map to a set of points once they are known. The fault map is
 * built after its result arrives, so the initial center/zoom is only a
 * placeholder - this frames the whole route instead. */
export function FitBounds({
  points,
  padding = 40,
}: {
  points: [number, number][];
  padding?: number;
}) {
  const map = useMap();
  // a stable key so a fresh array with the same points does not refit
  const key = points.length
    ? `${points.length}:${points[0].join()}:${points[points.length - 1].join()}`
    : "";

  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(L.latLngBounds(points), { padding: [padding, padding] });
    // points is rebuilt each render; key is its stable form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map, padding]);

  return null;
}
