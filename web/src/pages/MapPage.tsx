import { useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "../auth/AuthContext";
import { mapApi } from "../api/map";
import { useLayerData } from "../components/map/useLayerData";
import { PointLayer } from "../components/map/PointLayer";
import { SubstationLayerGroup } from "../components/map/SubstationLayerGroup";
import { LineLayerGroup } from "../components/map/LineLayerGroup";

// Roughly centers and frames the state of Telangana.
const TELANGANA_CENTER: [number, number] = [17.9, 79.3];
const DEFAULT_ZOOM = 7;

const VOLT_CLASSES = ["400", "220", "132"] as const;
type VoltClass = (typeof VOLT_CLASSES)[number];

const VOLT_COLOR: Record<VoltClass, string> = {
  "400": "#d62728",
  "220": "#ff7f0e",
  "132": "#1f77b4",
};

type LayerKey =
  | `substations-${VoltClass}`
  | `lines-${VoltClass}`
  | "solar"
  | "ehv"
  | "pgcil-substations"
  | "pgcil-lines"
  | "hydel";

const DEFAULT_ON: LayerKey[] = ["substations-400", "substations-220", "substations-132"];

export default function MapPage() {
  const { user, logout } = useAuth();
  const [on, setOn] = useState<Set<LayerKey>>(new Set(DEFAULT_ON));

  const toggle = (key: LayerKey) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const solar = useLayerData(on.has("solar"), mapApi.solarPlants);
  const ehv = useLayerData(on.has("ehv"), mapApi.ehvConsumers);
  const pgcilSs = useLayerData(on.has("pgcil-substations"), mapApi.pgcilSubstations);
  const pgcilLines = useLayerData(on.has("pgcil-lines"), mapApi.pgcilLines);
  const hydel = useLayerData(on.has("hydel"), mapApi.hydelPowerStations);

  return (
    <div className="map-page">
      <aside className="layer-panel">
        <h2>TGTransco GIS</h2>
        <p className="layer-panel-user">
          {user?.username} ({user?.role})
        </p>

        <fieldset>
          <legend>Substations</legend>
          {VOLT_CLASSES.map((vc) => (
            <label key={vc}>
              <input
                type="checkbox"
                checked={on.has(`substations-${vc}`)}
                onChange={() => toggle(`substations-${vc}`)}
              />
              {vc} kV
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Lines</legend>
          {VOLT_CLASSES.map((vc) => (
            <label key={vc}>
              <input
                type="checkbox"
                checked={on.has(`lines-${vc}`)}
                onChange={() => toggle(`lines-${vc}`)}
              />
              {vc} kV
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Other layers</legend>
          <label>
            <input type="checkbox" checked={on.has("solar")} onChange={() => toggle("solar")} />
            Solar plants
          </label>
          <label>
            <input type="checkbox" checked={on.has("ehv")} onChange={() => toggle("ehv")} />
            EHV consumers
          </label>
          <label>
            <input
              type="checkbox"
              checked={on.has("pgcil-substations")}
              onChange={() => toggle("pgcil-substations")}
            />
            PGCIL substations
          </label>
          <label>
            <input
              type="checkbox"
              checked={on.has("pgcil-lines")}
              onChange={() => toggle("pgcil-lines")}
            />
            PGCIL lines
          </label>
          <label>
            <input type="checkbox" checked={on.has("hydel")} onChange={() => toggle("hydel")} />
            Hydel power stations
          </label>
        </fieldset>

        <button type="button" onClick={logout} className="link-button">
          Sign out
        </button>
      </aside>

      <MapContainer center={TELANGANA_CENTER} zoom={DEFAULT_ZOOM} className="map-container">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {VOLT_CLASSES.map((vc) => (
          <SubstationLayerGroup
            key={`substations-${vc}`}
            voltClass={vc}
            enabled={on.has(`substations-${vc}`)}
            color={VOLT_COLOR[vc]}
          />
        ))}

        {VOLT_CLASSES.map((vc) => (
          <LineLayerGroup
            key={`lines-${vc}`}
            voltClass={vc}
            enabled={on.has(`lines-${vc}`)}
            color={VOLT_COLOR[vc]}
          />
        ))}

        {solar.data && on.has("solar") && (
          <PointLayer
            points={solar.data}
            color="#2ca02c"
            radius={5}
            keyOf={(s) => s.solar_id}
            popupContent={(s) => (
              <>
                <strong>{s.plant_name}</strong>
                <br />
                {s.installed_capacity_mw ?? "?"} MW
                {s.interfacing_ss && (
                  <>
                    <br />
                    Interfacing SS: {s.interfacing_ss}
                  </>
                )}
              </>
            )}
          />
        )}

        {ehv.data && on.has("ehv") && (
          <PointLayer
            points={ehv.data}
            color="#9467bd"
            radius={5}
            keyOf={(e) => e.ehv_id}
            popupContent={(e) => (
              <>
                <strong>{e.name}</strong>
                <br />
                {e.installed_capacity_mw ?? "?"} MW
                {e.substation && (
                  <>
                    <br />
                    Substation: {e.substation}
                  </>
                )}
              </>
            )}
          />
        )}

        {pgcilSs.data && on.has("pgcil-substations") && (
          <PointLayer
            points={pgcilSs.data}
            color="#7f7f7f"
            radius={5}
            keyOf={(p) => p.id}
            popupContent={(p) => (
              <>
                <strong>{p.name}</strong>
                <br />
                {p.voltage} kV (PGCIL)
              </>
            )}
          />
        )}

        {pgcilLines.data && on.has("pgcil-lines") && (
          <PointLayer
            points={pgcilLines.data}
            color="#4a4a4a"
            radius={2}
            keyOf={(p) => p.id}
            popupContent={(p) => <>{p.feeder_name} (PGCIL)</>}
          />
        )}

        {hydel.data && on.has("hydel") && (
          <PointLayer
            points={hydel.data}
            color="#17becf"
            radius={6}
            keyOf={(h) => h.hydel_id}
            popupContent={(h) => (
              <>
                <strong>{h.name}</strong>
                <br />
                {h.gen_cap_mw ?? "?"} MW
                {h.connected_ss && (
                  <>
                    <br />
                    Connected SS: {h.connected_ss}
                  </>
                )}
              </>
            )}
          />
        )}
      </MapContainer>
    </div>
  );
}
