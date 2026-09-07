import { useEffect } from "react";
import { TileLayer, useMap } from "react-leaflet";
import { BASE_MAPS, type BaseMapId } from "./layerConfig";

/** The Maps radio group from the legacy panel: none, satellite, open street,
 * grey scale. Grey scale is OSM with a CSS filter, which is what the legacy
 * L.tileLayer.grayscale plugin did. */
export function BaseMapLayer({ baseMap }: { baseMap: BaseMapId }) {
  const map = useMap();
  const option = BASE_MAPS.find((b) => b.id === baseMap);

  useEffect(() => {
    // the filter has to sit on the tile pane, not the tiles, so it survives
    // Leaflet swapping tiles in and out while panning
    const pane = map.getPane("tilePane");
    if (pane) pane.style.filter = option?.grayscale ? "grayscale(1)" : "";
    return () => {
      if (pane) pane.style.filter = "";
    };
  }, [map, option?.grayscale]);

  if (!option?.url) return null;

  return (
    <TileLayer
      // remounting on id change avoids Leaflet keeping the previous tiles
      key={option.id}
      url={option.url}
      attribution={option.attribution}
    />
  );
}
