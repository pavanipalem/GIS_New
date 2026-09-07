import { useEffect, useState } from "react";
import { GeoJSON, Pane } from "react-leaflet";
import type { Layer, PathOptions } from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import {
  DISTRICT_COLOURS,
  DISTRICT_FALLBACK,
  OLD_DISTRICT_COLOURS,
} from "./districtColours";
import type { DistrictSet } from "./layerConfig";

interface DistrictProps {
  /** The 33 new districts key on `name`; the 2016 file keys on `D_N`. */
  name?: string;
  D_N?: string;
}

const districtName = (p?: DistrictProps) => p?.name ?? p?.D_N ?? "";

/** Telangana district boundaries - the 33 post-reorganisation districts, or
 * the 10 pre-2016 ones.
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
export function DistrictsLayer({ set }: { set: DistrictSet }) {
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [failed, setFailed] = useState(false);

  const enabled = set !== "none";
  const url = set === "old" ? "/telangana-districts-old.json" : "/telangana-districts.json";
  const colours = set === "old" ? OLD_DISTRICT_COLOURS : DISTRICT_COLOURS;

  // switching sets must drop the previous file, not merge with it
  useEffect(() => {
    setData(null);
    setFailed(false);
  }, [set]);

  useEffect(() => {
    if (!enabled || data || failed) return;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setFailed(true));
  }, [enabled, url, data, failed]);

  if (!enabled || !data) return null;

  const style = (feature?: Feature<Geometry, DistrictProps>): PathOptions => ({
    fillColor: colours[districtName(feature?.properties)] ?? DISTRICT_FALLBACK,
    fillOpacity: 0.45,
    color: "#4a4a4a",
    weight: 0.8,
    opacity: 0.9,
  });

  const onEach = (feature: Feature<Geometry, DistrictProps>, layer: Layer) => {
    const name = districtName(feature.properties);
    if (name) layer.bindTooltip(name, { sticky: true });
  };

  return (
    // Its own pane below Leaflet's overlayPane (400) so district fills never
    // sit on top of substations, routes or towers.
    <Pane name="districts" style={{ zIndex: 350 }}>
      <GeoJSON key={set} data={data} style={style} onEachFeature={onEach} />
    </Pane>
  );
}
