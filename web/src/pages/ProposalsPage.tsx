import { useEffect, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AppLayout } from "../components/AppLayout";
import { InvalidateSizeOnResize } from "../components/map/InvalidateSizeOnResize";
import { ClampNorth } from "../components/map/ClampNorth";
import { BaseMapLayer } from "../components/map/BaseMapLayer";
import { DistrictsLayer } from "../components/map/DistrictsLayer";
import { IconMarkerLayer } from "../components/map/IconMarkerLayer";
import { MapLegend } from "../components/map/MapLegend";
import {
  ALLOWED_BOUNDS,
  MAX_ZOOM,
  MIN_ZOOM,
} from "../components/map/viewRestriction";
import {
  SUBSTATION_ICON,
  UG_COLOUR,
  VOLT_CLASSES,
  VOLT_COLOUR,
  VOLT_ICON_SIZE,
  type VoltClass,
} from "../components/map/layerConfig";
import { proposalsApi } from "../api/proposals";
import { ApiError } from "../api/client";
import type { NearbyLine, NearbyResult } from "../types/proposal";
import type { MapPoint } from "../types/map";

const TELANGANA_CENTER: [number, number] = [17.9, 79.3];
const RADIUS_KM = 20;
const CIRCLE_COLOUR = "#1f77b4";

type TabKey = "ss" | "line";
type Point = { lat: number; lng: number };

const proposedIcon = L.divIcon({
  className: "proposed-pin",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  html:
    '<svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true">' +
    '<circle cx="15" cy="15" r="8.5" fill="rgba(192,57,43,.12)" stroke="#c0392b" stroke-width="3"/>' +
    '<path d="M15 1v7M15 22v7M1 15h7M22 15h7" stroke="#c0392b" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="15" cy="15" r="2.4" fill="#c0392b"/></svg>',
});

function lineColour(l: NearbyLine): string {
  const vc = (l.volt_class ?? "") as VoltClass;
  if (l.is_underground) return (UG_COLOUR as Record<string, string>)[vc] ?? "#555";
  return (VOLT_COLOUR as Record<string, string>)[vc] ?? "#555";
}

/** Click anywhere on the map to (re)place the proposed point. */
function ClickToPlace({ onPlace }: { onPlace: (p: Point) => void }) {
  useMapEvents({
    click: (e) => onPlace({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

/** Recentres on the point whenever it moves, framing the 20 km circle. */
function FrameCircle({ point }: { point: Point | null }) {
  const map = useMap();
  const key = point ? `${point.lat.toFixed(5)},${point.lng.toFixed(5)}` : "";
  useEffect(() => {
    if (!point) return;
    map.flyTo([point.lat, point.lng], 10, { duration: 0.6 });
    // point is a fresh object each render; key is its stable form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function ProposedSubstationTab() {
  const [point, setPoint] = useState<Point | null>(null);
  const [volts, setVolts] = useState<Set<VoltClass>>(new Set(VOLT_CLASSES));
  const [place, setPlace] = useState("");
  const [geoErr, setGeoErr] = useState<string | null>(null);

  const [result, setResult] = useState<NearbyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqSeq = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const voltKey = VOLT_CLASSES.filter((v) => volts.has(v)).join(",");

  useEffect(() => {
    if (!point) {
      setResult(null);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const seq = ++reqSeq.current;
      setLoading(true);
      setError(null);
      proposalsApi
        .nearby(point.lat, point.lng, {
          radiusKm: RADIUS_KM,
          voltClasses: voltKey ? voltKey.split(",") : VOLT_CLASSES.slice(),
        })
        .then((r) => {
          if (seq !== reqSeq.current) return;
          setResult(r);
          setLoading(false);
        })
        .catch((e) => {
          if (seq !== reqSeq.current) return;
          setResult(null);
          setLoading(false);
          setError(e instanceof ApiError ? e.message : "Could not load nearby network.");
        });
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [point, voltKey]);

  const toggleVolt = (v: VoltClass) =>
    setVolts((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      // never leave every class off - fall back to all
      return next.size ? next : new Set(VOLT_CLASSES);
    });

  const search = async () => {
    setGeoErr(null);
    const q = place.trim();
    if (!q) return;
    const coord = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coord) {
      setPoint({ lat: Number(coord[1]), lng: Number(coord[2]) });
      return;
    }
    try {
      const res = await fetch(
        "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=" +
          encodeURIComponent(q)
      );
      const hits = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (!hits.length) {
        setGeoErr("No place found. Try a more specific name, or paste “lat, lng”.");
        return;
      }
      setPoint({ lat: Number(hits[0].lat), lng: Number(hits[0].lon) });
    } catch {
      setGeoErr("Place search is unavailable. Click the map or paste “lat, lng”.");
    }
  };

  const shownLines = result?.lines ?? [];
  const overheadCount = shownLines.filter((l) => !l.is_underground).length;
  const ugCount = shownLines.filter((l) => l.is_underground).length;
  const ssByVolt = (vc: VoltClass) =>
    (result?.substations ?? []).filter((s) => s.volt_class === vc);

  return (
    <div className="proposals-body">
      <aside className="proposals-panel">
        <h2>Proposed substation</h2>
        <p className="proposals-hint">
          Click the map to drop the proposed point, or search a place. Everything
          within {RADIUS_KM} km is shown; line routes are clipped to the circle.
        </p>

        <label className="proposals-field">
          <span>Place or coordinates</span>
          <div className="proposals-search">
            <input
              type="text"
              value={place}
              placeholder="e.g. Warangal  ·  17.44, 78.47"
              onChange={(e) => setPlace(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void search();
                }
              }}
            />
            <button type="button" onClick={() => void search()}>
              Go
            </button>
          </div>
          {geoErr && <span className="proposals-warn">{geoErr}</span>}
        </label>

        <div className="proposals-field">
          <span>Proposed point</span>
          {point ? (
            <div className="proposals-point">
              <code>
                {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
              </code>
              <button
                type="button"
                className="link-button"
                onClick={() => setPoint(null)}
              >
                Clear
              </button>
            </div>
          ) : (
            <span className="proposals-muted">Not set — click the map.</span>
          )}
        </div>

        <fieldset className="proposals-field proposals-volts">
          <legend>Voltage levels</legend>
          {VOLT_CLASSES.map((vc) => (
            <label key={vc} className="proposals-check">
              <input
                type="checkbox"
                checked={volts.has(vc)}
                onChange={() => toggleVolt(vc)}
              />
              <span
                className="proposals-swatch"
                style={{ background: VOLT_COLOUR[vc] }}
                aria-hidden="true"
              />
              {vc} kV
            </label>
          ))}
        </fieldset>

        <div className="proposals-field">
          <span>Radius</span>
          <span className="proposals-muted">{RADIUS_KM} km (fixed)</span>
        </div>

        {point && (
          <div className="proposals-result">
            {loading && <p className="proposals-muted">Loading nearby network…</p>}
            {error && <p className="proposals-warn">{error}</p>}
            {result && !loading && (
              <>
                <p className="proposals-count">
                  <strong>{result.substations.length}</strong> substations ·{" "}
                  <strong>{overheadCount}</strong> lines ·{" "}
                  <strong>{ugCount}</strong> UG cables
                </p>
                <ul className="proposals-breakdown">
                  {VOLT_CLASSES.map((vc) => (
                    <li key={vc}>
                      <span
                        className="proposals-swatch"
                        style={{ background: VOLT_COLOUR[vc] }}
                        aria-hidden="true"
                      />
                      {vc} kV — {ssByVolt(vc).length} SS
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

      </aside>

      <div className="proposals-map">
        <MapContainer
          center={TELANGANA_CENTER}
          zoom={7}
          className="proposals-map-container"
          maxBounds={ALLOWED_BOUNDS}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          inertia={false}
        >
          <InvalidateSizeOnResize />
          <ClampNorth />
          <BaseMapLayer baseMap="osm" />
          <DistrictsLayer set="new" />
          <ClickToPlace onPlace={setPoint} />
          <FrameCircle point={point} />
          <MapLegend />

          {!point && (
            <div className="proposals-map-hint">Click to place the proposed substation</div>
          )}

          {point && (
            <>
              <Circle
                center={[point.lat, point.lng]}
                radius={RADIUS_KM * 1000}
                pathOptions={{
                  color: CIRCLE_COLOUR,
                  weight: 2,
                  fillColor: CIRCLE_COLOUR,
                  fillOpacity: 0.06,
                }}
              />
              <Marker
                position={[point.lat, point.lng]}
                icon={proposedIcon}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const ll = (e.target as L.Marker).getLatLng();
                    setPoint({ lat: ll.lat, lng: ll.lng });
                  },
                }}
              />
            </>
          )}

          {result &&
            VOLT_CLASSES.map((vc) => (
              <IconMarkerLayer
                key={vc}
                points={ssByVolt(vc)}
                iconUrl={SUBSTATION_ICON[vc]}
                size={VOLT_ICON_SIZE[vc] + 3}
                keyOf={(s) => s.ss_code}
                tooltip={(s) => s.ss_name ?? `SS ${s.ss_code}`}
                popup={(s) => (
                  <>
                    <strong>
                      {s.volt_class ? `${s.volt_class} kV · ` : ""}
                      {s.ss_name ?? s.ss_code}
                    </strong>
                    <br />
                    {s.ss_type ?? "SS"}
                    {s.district ? ` · ${s.district}` : ""}
                  </>
                )}
              />
            ))}

          {result &&
            result.lines.flatMap((l) =>
              l.segments.map((seg, i) => (
                <Polyline
                  key={`${l.feeder_id}-${i}`}
                  positions={seg.map((p: MapPoint) => [p.lat, p.lng])}
                  pathOptions={{
                    color: lineColour(l),
                    weight: l.is_underground ? 3 : 2,
                    opacity: 0.9,
                    dashArray: l.is_underground ? "5 5" : undefined,
                  }}
                >
                  <Tooltip sticky>
                    {l.feeder_name ?? `Feeder ${l.feeder_id}`}
                    {l.is_underground ? " (UG cable)" : ""}
                  </Tooltip>
                </Polyline>
              ))
            )}
        </MapContainer>
      </div>
    </div>
  );
}

export default function ProposalsPage() {
  const [tab, setTab] = useState<TabKey>("ss");

  return (
    <AppLayout fullBleed>
      <div className="proposals-page">
        <div className="proposals-tabs" role="tablist" aria-label="New proposals">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "ss"}
            className={tab === "ss" ? "active" : ""}
            onClick={() => setTab("ss")}
          >
            Proposed SS
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "line"}
            className={tab === "line" ? "active" : ""}
            onClick={() => setTab("line")}
          >
            Proposed Line
          </button>
        </div>

        {tab === "ss" ? (
          <ProposedSubstationTab />
        ) : (
          <div className="proposals-empty">
            <p>Proposed Line — not started yet.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
