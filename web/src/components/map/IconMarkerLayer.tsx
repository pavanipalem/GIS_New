import { useMemo } from "react";
import { Marker, Popup, Tooltip } from "react-leaflet";
import L from "leaflet";
import type { ReactNode } from "react";

interface PointLike {
  lat: number;
  lng: number;
}

/** Marker layer using the legacy PNG icons.
 *
 * Leaflet's default icon breaks under bundlers because it builds its image
 * URLs from a script path that does not survive bundling. Every icon here is
 * explicit, so that never applies - and passing iconAnchor keeps the marker
 * centred on its coordinate rather than hanging below it, which is Leaflet's
 * default for pin-shaped icons.
 */
export function IconMarkerLayer<T extends PointLike>({
  points,
  iconUrl,
  size,
  keyOf,
  tooltip,
  popup,
}: {
  points: T[];
  iconUrl: string;
  size: number;
  keyOf: (p: T) => string | number;
  tooltip?: (p: T) => ReactNode;
  popup?: (p: T) => ReactNode;
}) {
  const icon = useMemo(
    () =>
      L.icon({
        iconUrl,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
      }),
    [iconUrl, size]
  );

  return (
    <>
      {points.map((p) => (
        <Marker key={keyOf(p)} position={[p.lat, p.lng]} icon={icon}>
          {tooltip && <Tooltip direction="top">{tooltip(p)}</Tooltip>}
          {popup && <Popup minWidth={240}>{popup(p)}</Popup>}
        </Marker>
      ))}
    </>
  );
}
