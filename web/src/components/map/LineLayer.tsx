import { useState } from "react";
import { CircleMarker, Polyline, Popup, Tooltip } from "react-leaflet";
import type { LineFeature, TowerMarker } from "../../types/map";
import { mapApi } from "../../api/map";

interface LineLayerProps {
  lines: LineFeature[];
  color: string;
}

/** Draws each feeder as a polyline (this is the whole point of storing
 * line.route server-side instead of shipping every tower on every load -
 * see the tower-marker-vs-polyline comparison from planning). Towers for a
 * specific line are fetched on demand when you click it, rather than
 * fetched for the whole viewport: /api/map/towers has no bbox mode today,
 * only feeder_id or a point+radius, so "click a line to inspect its
 * towers" is what the current API actually supports. A viewport/bbox tower
 * endpoint would be a reasonable follow-up if per-line inspection isn't
 * enough. */
export function LineLayer({ lines, color }: LineLayerProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [towers, setTowers] = useState<TowerMarker[]>([]);
  const [loadingTowers, setLoadingTowers] = useState(false);

  const selectLine = async (feederId: number) => {
    if (selected === feederId) {
      setSelected(null);
      setTowers([]);
      return;
    }
    setSelected(feederId);
    setLoadingTowers(true);
    try {
      setTowers(await mapApi.towersByFeeder(feederId));
    } finally {
      setLoadingTowers(false);
    }
  };

  return (
    <>
      {lines.map((line) => (
        <Polyline
          key={line.feeder_id}
          positions={line.path.map((p) => [p.lat, p.lng])}
          pathOptions={{
            color,
            weight: selected === line.feeder_id ? 4 : 2,
            opacity: 0.8,
          }}
          eventHandlers={{ click: () => selectLine(line.feeder_id) }}
        >
          <Tooltip sticky>{line.feeder_name ?? `Feeder ${line.feeder_id}`}</Tooltip>
          <Popup>
            <strong>{line.feeder_name ?? `Feeder ${line.feeder_id}`}</strong>
            <br />
            {line.from_substation} → {line.to_substation}
            <br />
            {line.volt_class} kV · {line.tower_count ?? "?"} towers
            {line.length_ckm != null && <> · {line.length_ckm} ckm</>}
            <br />
            {selected === line.feeder_id
              ? loadingTowers
                ? "Loading towers…"
                : "Click line to hide towers"
              : "Click line to show towers"}
          </Popup>
        </Polyline>
      ))}

      {selected !== null &&
        towers.map((t) => (
          <CircleMarker
            key={t.tower_id}
            center={[t.lat, t.lng]}
            radius={3}
            pathOptions={{ color, fillColor: color, fillOpacity: 1, weight: 1 }}
          >
            <Popup>
              Tower {t.location_no ?? t.tower_id}
              {t.tower_type && <> · {t.tower_type}</>}
            </Popup>
          </CircleMarker>
        ))}
    </>
  );
}
