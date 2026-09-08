import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { AppLayout } from "../components/AppLayout";
import { InvalidateSizeOnResize } from "../components/map/InvalidateSizeOnResize";
import { FitBounds } from "../components/map/FitBounds";
import { mapApi } from "../api/map";
import { faultApi } from "../api/fault";
import { ApiError } from "../api/client";
import { VOLT_CLASSES, VOLT_COLOUR, type VoltClass } from "../components/map/layerConfig";
import type { FaultLocation } from "../types/fault";

/** Fault mapping: given a distance-to-fault reported from one end of a line,
 * show where on the line that lands.
 *
 * Ports Forms/FaultMappingLine.aspx. The dropdowns treat a line's two ends as
 * an unordered pair, so the source can be either substation - the legacy page
 * only listed stored From values, which made its own "measure from the far
 * end" path unreachable.
 */
export default function FaultMappingPage() {
  const [pairs, setPairs] = useState<[string, string, string][]>([]);
  const [voltClass, setVoltClass] = useState<VoltClass | "">("");
  const [fromSs, setFromSs] = useState("");
  const [toSs, setToSs] = useState("");
  const [distance, setDistance] = useState("");

  const [result, setResult] = useState<FaultLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mapApi
      .lineEndpoints()
      .then((e) => setPairs(e.pairs))
      .catch(() => setPairs([]));
  }, []);

  /** Ends of every line at this voltage, and which ends each connects to.
   * Undirected: a line stored A -> B contributes both A->B and B->A, so the
   * relay's source end can always be chosen as "From". */
  const { ends, reachable } = useMemo(() => {
    const reach = new Map<string, Set<string>>();
    const add = (a: string, b: string) => {
      const s = reach.get(a) ?? new Set<string>();
      s.add(b);
      reach.set(a, s);
    };
    for (const [vc, a, b] of pairs) {
      if (voltClass && vc !== voltClass) continue;
      add(a, b);
      add(b, a);
    }
    return { ends: [...reach.keys()].sort(), reachable: reach };
  }, [pairs, voltClass]);

  const toOptions = fromSs ? [...(reachable.get(fromSs) ?? [])].sort() : [];

  const canSubmit =
    voltClass !== "" && fromSs !== "" && toSs !== "" && distance.trim() !== "" && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const km = Number(distance);
    if (!Number.isFinite(km) || km < 0) {
      setError("Enter the fault distance in km as a positive number.");
      setResult(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await faultApi.locate({
        voltClass,
        fromSubstation: fromSs,
        toSubstation: toSs,
        // the relay measured from the substation chosen as From
        measuredFrom: fromSs,
        distanceKm: km,
      });
      setResult(r);
    } catch (err) {
      setResult(null);
      setError(
        err instanceof ApiError ? err.message : "Could not locate the fault. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setVoltClass("");
    setFromSs("");
    setToSs("");
    setDistance("");
    setResult(null);
    setError(null);
  };

  const routeColour = result?.volt_class
    ? (VOLT_COLOUR as Record<string, string>)[result.volt_class] ?? "#1f77b4"
    : "#1f77b4";
  const path = result?.towers.map((t) => [t.lat, t.lng] as [number, number]) ?? [];

  return (
    <AppLayout>
      <div className="page-head">
        <h1>Fault mapping on a line</h1>
      </div>
      <p className="page-head-sub">
        Enter the distance to fault reported from one end of a line and this finds the
        point on the mapped tower route. Distance is measured along the towers, on the
        WGS84 spheroid.
      </p>

      <form className="fault-form" onSubmit={submit}>
        <label>
          <span>Voltage class</span>
          <select
            value={voltClass}
            onChange={(e) => {
              setVoltClass(e.target.value as VoltClass | "");
              setFromSs("");
              setToSs("");
              setResult(null);
            }}
          >
            <option value="">Select…</option>
            {VOLT_CLASSES.map((vc) => (
              <option key={vc} value={vc}>
                {vc} kV
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>From (fault distance measured from here)</span>
          <select
            value={fromSs}
            onChange={(e) => {
              setFromSs(e.target.value);
              setToSs("");
              setResult(null);
            }}
            disabled={!voltClass}
          >
            <option value="">Select…</option>
            {ends.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>To (other end of the line)</span>
          <select
            value={toSs}
            onChange={(e) => {
              setToSs(e.target.value);
              setResult(null);
            }}
            disabled={!fromSs}
          >
            <option value="">Select…</option>
            {toOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Fault distance from source (km)</span>
          <input
            type="number"
            min="0"
            step="0.001"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="e.g. 12.4"
          />
        </label>

        <div className="fault-form-actions">
          <button type="submit" disabled={!canSubmit}>
            {busy ? "Locating…" : "Find fault"}
          </button>
          <button type="button" className="link-button" onClick={reset}>
            Clear
          </button>
        </div>
      </form>

      {error && <p className="fault-error">{error}</p>}

      {result && (
        <>
          <div className="fault-summary">
            <h2>{result.feeder_name ?? `Feeder ${result.feeder_id}`}</h2>
            <p>
              <strong>{result.distance_km} km</strong> from <strong>{result.measured_from}</strong>{" "}
              lands between location <strong>{result.before_tower.location_no ?? "—"}</strong> and{" "}
              <strong>{result.after_tower.location_no ?? "—"}</strong>, at{" "}
              <strong>
                {result.fault_point.lat.toFixed(6)}, {result.fault_point.lng.toFixed(6)}
              </strong>
              .
            </p>

            <dl className="fault-facts">
              <div>
                <dt>Mapped route length</dt>
                <dd>{result.route_length_km} km</dd>
              </div>
              <div>
                <dt>Recorded length (ckm)</dt>
                <dd>{result.recorded_length_ckm ?? "—"}</dd>
              </div>
              <div>
                <dt>Distance before this span</dt>
                <dd>{result.cumulative_km_before} km</dd>
              </div>
              <div>
                <dt>Span length</dt>
                <dd>{result.section_km} km</dd>
              </div>
              <div>
                <dt>Tower order walked</dt>
                <dd>
                  {result.reversed ? "Reversed" : "As stored"}
                  {result.direction_verified ? " (checked against substation coordinates)" : ""}
                </dd>
              </div>
            </dl>

            {!result.direction_verified && result.direction_note && (
              <p className="fault-warning">{result.direction_note}</p>
            )}

            {result.recorded_length_ckm != null &&
              result.recorded_length_ckm > result.route_length_km * 1.5 && (
                <p className="fault-warning">
                  The recorded length ({result.recorded_length_ckm} ckm) is well over the
                  mapped route length ({result.route_length_km} km) — this is usually a
                  double-circuit line, where the recorded figure counts both circuits.
                  Distance here is measured along the route, once.
                </p>
              )}

            <table className="data-table fault-table">
              <thead>
                <tr>
                  <th>Location no</th>
                  <th>Type</th>
                  <th className="num">Distance from {result.measured_from}</th>
                  <th className="num">Latitude</th>
                  <th className="num">Longitude</th>
                </tr>
              </thead>
              <tbody>
                {[result.before_tower, result.after_tower].map((t) => (
                  <tr key={t.tower_id}>
                    <td>{t.location_no ?? "—"}</td>
                    <td>{t.tower_type ?? "—"}</td>
                    <td className="num">{t.distance_km.toFixed(3)} km</td>
                    <td className="num">{t.lat.toFixed(6)}</td>
                    <td className="num">{t.lng.toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <a
              className="fault-directions"
              href={`https://www.google.com/maps/dir/?api=1&destination=${result.fault_point.lat},${result.fault_point.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Directions to the fault point
            </a>
          </div>

          <MapContainer center={[result.fault_point.lat, result.fault_point.lng]} zoom={13} className="fault-map">
            <InvalidateSizeOnResize />
            <FitBounds points={path} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <Polyline positions={path} pathOptions={{ color: routeColour, weight: 3, opacity: 0.8 }} />

            {result.towers.map((t) => (
              <CircleMarker
                key={t.tower_id}
                center={[t.lat, t.lng]}
                radius={4}
                pathOptions={{
                  color: routeColour,
                  fillColor: routeColour,
                  fillOpacity: 0.9,
                  weight: 1,
                }}
              >
                <Tooltip direction="top">
                  {t.location_no ?? t.tower_id}
                  <br />
                  {t.distance_km.toFixed(3)} km from {result.measured_from}
                </Tooltip>
              </CircleMarker>
            ))}

            {/* the span the fault falls in, and the two towers bracketing it */}
            <Polyline
              positions={[
                [result.before_tower.lat, result.before_tower.lng],
                [result.after_tower.lat, result.after_tower.lng],
              ]}
              pathOptions={{ color: "#c0392b", weight: 7, opacity: 1 }}
            />
            {[result.before_tower, result.after_tower].map((t) => (
              <CircleMarker
                key={`b-${t.tower_id}`}
                center={[t.lat, t.lng]}
                radius={10}
                pathOptions={{ color: "#c0392b", fillColor: "#c0392b", fillOpacity: 0.5, weight: 3 }}
              >
                <Popup>
                  Location {t.location_no ?? t.tower_id}
                  <br />
                  {t.distance_km.toFixed(3)} km from {result.measured_from}
                </Popup>
              </CircleMarker>
            ))}

            <CircleMarker
              center={[result.fault_point.lat, result.fault_point.lng]}
              radius={8}
              pathOptions={{ color: "#111", fillColor: "#ffd400", fillOpacity: 1, weight: 2 }}
            >
              <Popup>
                Estimated fault point
                <br />
                {result.distance_km} km from {result.measured_from}
                <br />
                {result.fault_point.lat.toFixed(6)}, {result.fault_point.lng.toFixed(6)}
              </Popup>
            </CircleMarker>
          </MapContainer>
        </>
      )}
    </AppLayout>
  );
}
