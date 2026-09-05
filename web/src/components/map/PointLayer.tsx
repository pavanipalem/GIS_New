import { CircleMarker, Popup } from "react-leaflet";
import type { ReactNode } from "react";

interface PointLike {
  lat: number;
  lng: number;
}

interface PointLayerProps<T extends PointLike> {
  points: T[];
  color: string;
  radius?: number;
  popupContent: (point: T) => ReactNode;
  keyOf: (point: T) => string | number;
}

/** Every reference/marker layer (substations, solar, EHV, PGCIL, hydel)
 * renders through here as a CircleMarker rather than L.Marker + icon image -
 * sidesteps the well-known Leaflet default-icon-path bug under Vite/webpack
 * bundling entirely, and color already carries the per-layer meaning. */
export function PointLayer<T extends PointLike>({
  points,
  color,
  radius = 6,
  popupContent,
  keyOf,
}: PointLayerProps<T>) {
  return (
    <>
      {points.map((p) => (
        <CircleMarker
          key={keyOf(p)}
          center={[p.lat, p.lng]}
          radius={radius}
          pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 1 }}
        >
          <Popup>{popupContent(p)}</Popup>
        </CircleMarker>
      ))}
    </>
  );
}
