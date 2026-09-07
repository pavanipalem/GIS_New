import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Popup, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { mapApi } from "../../api/map";
import { ApiError } from "../../api/client";
import { UG_COLOUR, VOLT_COLOUR } from "./layerConfig";
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
const FALLBACK_COLOUR = "#6b6b6b";

function towerColour(t: TowerMarker, underground: boolean): string {
  if (t.telecom_joint_box && t.telecom_joint_box.trim()) return JOINT_BOX_COLOUR;
  if (t.additional_info?.trim() === "UC") return UC_COLOUR;
  // match the line the tower belongs to: UG cables have their own palette
  const vc = t.line_volt_class ?? "";
  const overhead = VOLT_COLOUR as Record<string, string>;
  const ug = UG_COLOUR as Record<string, string>;
  return (underground ? ug[vc] : undefined) ?? overhead[vc] ?? FALLBACK_COLOUR;
}

/** Auto-loads and draws towers for whatever is on screen, once zoomed in
 * past TOWER_ZOOM_THRESHOLD. Refetches on pan/zoom, debounced, and drops
 * responses that arrive after a newer request has already been issued.
 *
 * `voltClasses` is the set of line layers of this kind that are switched on.
 * Towers follow their line: with 220 selected and 132 not, zooming in shows
 * the 220 kV towers along the 220 kV corridors and nothing else. An empty
 * set means no line layer is on, so no towers are drawn or fetched.
 *
 * `underground` picks which line kind this instance draws: the map mounts
 * one for the overhead transmission lines (false) and one for the UG cables
 * (true), each fed its own set of switched-on voltage classes, so a tower is
 * drawn once in the colour of the layer it belongs to. */
export function TowerViewportLayer({
  voltClasses,
  underground = false,
}: {
  voltClasses: string[];
  underground?: boolean;
}) {
  const map = useMap();
  const [towers, setTowers] = useState<TowerMarker[]>([]);
  const [tooMany, setTooMany] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  // a stable primitive for the effect dep, so [220,132] and [132,220] and a
  // fresh array with the same contents do not each trigger a refetch
  const voltKey = [...voltClasses].sort().join(",");

  const refresh = useCallback(() => {
    if (!voltKey || map.getZoom() < TOWER_ZOOM_THRESHOLD) {
      setTowers([]);
      setTooMany(false);
      return;
    }
    const b = map.getBounds();
    const seq = ++requestSeq.current;
    mapApi
      .towersInBbox(
        b.getWest(),
        b.getSouth(),
        b.getEast(),
        b.getNorth(),
        voltKey.split(","),
        underground
      )
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
  }, [voltKey, underground, map]);

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

  if (!voltKey) return null;

  return (
    <>
      {tooMany && (
        <div className="map-notice">Too many towers here - zoom in further to show them</div>
      )}
      {towers.map((t) => {
        const colour = towerColour(t, underground);
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
