import { useEffect, useState } from "react";
import { GeoJSON, Pane } from "react-leaflet";
import type { Layer, PathOptions } from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { DISTRICT_COLOURS, DISTRICT_FALLBACK } from "./districtColours";

interface DistrictProps {
  name?: string;
}

/** The 33 post-reorganisation Telangana districts, shaded per district.
 *
 * Colours come from arcgisScript.js so the map looks familiar, but the style
 * object is not copied verbatim - the legacy one had three mistakes that meant
 * it never rendered as intended:
 *
 *   Color: "#000"    capital C, so Leaflet ignored it and drew default blue
 *   fillopacity: 0   lowercase o, so Leaflet ignored it and used its 0.2
 *   opacity: 3       out of the 0-1 range
 *
 * Taking the intent instead: the district's fill at a low opacity, with a thin
 * dark border, sitting under every data layer so markers and routes stay
 * readable on top.
 */
export function DistrictsLayer({ enabled }: { enabled: boolean }) {
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled || data || failed) return;
    fetch("/telangana-districts.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setFailed(true));
  }, [enabled, data, failed]);

  if (!enabled || !data) return null;

  const style = (feature?: Feature<Geometry, DistrictProps>): PathOptions => {
    const name = feature?.properties?.name ?? "";
    const fill = DISTRICT_COLOURS[name] ?? DISTRICT_FALLBACK;
    return {
      fillColor: fill,
      fillOpacity: 0.45,
      color: "#4a4a4a",
      weight: 0.8,
      opacity: 0.9,
    };
  };

  const onEach = (feature: Feature<Geometry, DistrictProps>, layer: Layer) => {
    const name = feature.properties?.name;
    if (name) layer.bindTooltip(name, { sticky: true });
  };

  return (
    // Its own pane below Leaflet's overlayPane (400) so the district fills
    // never sit on top of substations, routes or towers.
    <Pane name="districts" style={{ zIndex: 350 }}>
      <GeoJSON data={data} style={style} onEachFeature={onEach} />
    </Pane>
  );
}
