import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Popup, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { mapApi } from "../../api/map";
import { ApiError } from "../../api/client";
import type { TowerMarker } from "../../types/map";

// Legacy drew towers as 50 metre circles, which is under a pixel until you
// are zoomed well in: at z12 a 50m radius renders to ~1.4px and the circles
// are effectively invisible, at z13 ~2.7px, at z14 ~5.4px. 13 is the first
// zoom where they actually read as circles, and it also keeps a viewport
// comfortably under the endpoint's 5,000-tower cap.
export const TOWER_ZOOM_THRESHOLD = 13;

// Legacy used L.circle(center, 50, ...) - a 50 metre real-world radius, so
// towers grow as you zoom rather than staying a fixed pixel size.
const TOWER_RADIUS_METRES = 50;

// Colour rules lifted from arcgisScript.js, in its precedence order:
// a joint box wins, then "UC" in ADDITIONAL INFO, else the line's colour.
const JOINT_BOX_COLOUR = "#FFFF00";
const UC_COLOUR = "#f58c00";

const VOLT_COLOUR: Record<string, string> = {
  "400": "#d62728",
  "220": "#ff7f0e",
  "132": "#1f77b4",
};
const FALLBACK_COLOUR = "#6b6b6b";

function towerColour(t: TowerMarker): string {
  if (t.telecom_joint_box && t.telecom_joint_box.trim()) return JOINT_BOX_COLOUR;
  if (t.additional_info?.trim() === "UC") return UC_COLOUR;
  return VOLT_COLOUR[t.line_volt_class ?? ""] ?? FALLBACK_COLOUR;
}

/** Auto-loads and draws towers for whatever is on screen, once zoomed in
 * past TOWER_ZOOM_THRESHOLD. Refetches on pan/zoom, debounced, and drops
 * responses that arrive after a newer request has already been issued. */
export function TowerViewportLayer({ enabled }: { enabled: boolean }) {
  const map = useMap();
  const [towers, setTowers] = useState<TowerMarker[]>([]);
  const [tooMany, setTooMany] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  const refresh = useCallback(() => {
    if (!enabled || map.getZoom() < TOWER_ZOOM_THRESHOLD) {
      setTowers([]);
      setTooMany(false);
      return;
    }
    const b = map.getBounds();
    const seq = ++requestSeq.current;
    mapApi
      .towersInBbox(b.getWest(), b.getSouth(), b.getEast(), b.getNorth())
      .then((data) => {
        if (seq !== requestSeq.current) return; // a newer request superseded this
        setTowers(data);
        setTooMany(false);
      })
      .catch((err) => {
        if (seq !== requestSeq.current) return;
        setTowers([]);
        // 400 here means the viewport holds more than the endpoint will serve
        setTooMany(err instanceof ApiError && err.status === 400);
      });
  }, [enabled, map]);

  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(refresh, 300);
  }, [refresh]);

  useMapEvents({ moveend: scheduleRefresh, zoomend: scheduleRefresh });

  useEffect(() => {
    refresh();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refresh]);

  if (!enabled) return null;

  return (
    <>
      {tooMany && (
        <div className="map-notice">Too many towers here - zoom in further to show them</div>
      )}
      {towers.map((t) => {
        const colour = towerColour(t);
        return (
          <Circle
            key={t.tower_id}
            center={[t.lat, t.lng]}
            radius={TOWER_RADIUS_METRES}
            pathOptions={{ color: colour, fillColor: colour, fillOpacity: 1, weight: 0.5 }}
          >
            {/* legacy bindLabel(locationNo + type, { noHide: false }) - on hover */}
            <Tooltip direction="top">
              {t.location_no ?? t.tower_id}
              <br />
              {t.tower_type ?? "-"}
            </Tooltip>
            <Popup>
              <strong>{t.line_feeder_name ?? `Feeder ${t.feeder_id ?? "unassigned"}`}</strong>
              <br />
              Length (ckm): {t.line_length_ckm ?? "-"}
              <br />
              Total locations: {t.line_tower_count ?? "-"}
              <br />
              Circuit type: {t.line_circuit_type ?? "-"}
              <br />
              Date of charging: {t.line_date_of_charging ?? "-"}
              <br />
              Location no: {t.location_no ?? "-"}
              <br />
              Latitude: {t.lat}
              <br />
              Longitude: {t.lng}
              <br />
              Type of tower: {t.tower_type ?? "-"}
              <br />
              Type of conductor: {t.line_conductor_type ?? "-"}
              {t.telecom_joint_box && (
                <>
                  <br />
                  Telecom: {t.telecom_joint_box}
                </>
              )}
            </Popup>
          </Circle>
        );
      })}
    </>
  );
}
