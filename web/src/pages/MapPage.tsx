import { useEffect, useState } from "react";
import { MapContainer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { AppLayout } from "../components/AppLayout";
import { mapApi } from "../api/map";
import { useLayerData } from "../components/map/useLayerData";
import { IconMarkerLayer } from "../components/map/IconMarkerLayer";
import { PointLayer } from "../components/map/PointLayer";
import { SubstationLayerGroup } from "../components/map/SubstationLayerGroup";
import { LineLayerGroup } from "../components/map/LineLayerGroup";
import {
  TowerViewportLayer,
  TOWER_ZOOM_THRESHOLD,
} from "../components/map/TowerViewportLayer";
import { InvalidateSizeOnResize } from "../components/map/InvalidateSizeOnResize";
import { DistrictsLayer } from "../components/map/DistrictsLayer";
import { BaseMapLayer } from "../components/map/BaseMapLayer";
import {
  BASE_MAPS,
  LIS_WW_ICON,
  POINT_ICON,
  POINT_ICON_SIZE,
  SUBSTATION_ICON,
  UG_COLOUR,
  VOLT_CLASSES,
  VOLT_COLOUR,
  type BaseMapId,
  type DistrictSet,
  type VoltClass,
} from "../components/map/layerConfig";
import type { CountByCategory, LayerCounts } from "../types/map";

// Roughly centers and frames the state of Telangana.
const TELANGANA_CENTER: [number, number] = [17.9, 79.3];
const DEFAULT_ZOOM = 7;

type LayerKey =
  | `ss-${VoltClass}`
  | `lisww-${VoltClass}`
  | `line-${VoltClass}`
  | "ug-220"
  | "ug-132"
  | "pgcil-ss"
  | "pgcil-lines"
  | "hydel"
  | "thermal"
  | "solar"
  | "ehv"
  | "towers";

const DEFAULT_ON: LayerKey[] = ["ss-400", "ss-220", "ss-132", "towers"];

const countFor = (list: CountByCategory[] | undefined, voltClass: string) =>
  list?.find((c) => c.category === voltClass)?.count ?? 0;

const total = (list: CountByCategory[] | undefined) =>
  list?.reduce((n, c) => n + c.count, 0) ?? 0;

/** One layer row: its legend icon or colour swatch, its label, and the count
 * the legacy panel showed beside it. */
function LayerRow({
  checked,
  onChange,
  label,
  count,
  icon,
  swatch,
  indent,
  title,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count?: number;
  icon?: string;
  swatch?: string;
  indent?: boolean;
  title?: string;
}) {
  return (
    <label className={indent ? "layer-row layer-row-indent" : "layer-row"} title={title}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {icon && <img className="layer-icon" src={icon} alt="" aria-hidden="true" />}
      {swatch && (
        <span className="layer-swatch" style={{ background: swatch }} aria-hidden="true" />
      )}
      <span className="layer-label">{label}</span>
      {count !== undefined && <span className="layer-count">{count}</span>}
    </label>
  );
}

export default function MapPage() {
  const [on, setOn] = useState<Set<LayerKey>>(new Set(DEFAULT_ON));
  const [baseMap, setBaseMap] = useState<BaseMapId>("osm");
  const [districts, setDistricts] = useState<DistrictSet>("new");
  const [counts, setCounts] = useState<LayerCounts | null>(null);

  // The legacy "From / To" line search: pick a voltage class, then narrow that
  // class's lines to a pair of end substations.
  const [filterVolt, setFilterVolt] = useState<VoltClass | "">("");
  const [fromSs, setFromSs] = useState("");
  const [toSs, setToSs] = useState("");
  const [endpoints, setEndpoints] = useState<{ from: string[]; to: string[] }>({
    from: [],
    to: [],
  });

  useEffect(() => {
    mapApi
      .layerCounts()
      .then(setCounts)
      .catch(() => setCounts(null));
  }, []);

  // The From/To selections are cleared by the voltage-class change handler,
  // not here, so this effect only ever touches the endpoint lists.
  useEffect(() => {
    if (!filterVolt) {
      setEndpoints({ from: [], to: [] });
      return;
    }
    let cancelled = false;
    mapApi
      .lineEndpoints(filterVolt)
      .then((e) => {
        if (!cancelled) setEndpoints({ from: e.from_substations, to: e.to_substations });
      })
      .catch(() => {
        if (!cancelled) setEndpoints({ from: [], to: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [filterVolt]);

  const toggle = (key: LayerKey) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const solar = useLayerData(on.has("solar"), mapApi.solarPlants);
  const ehv = useLayerData(on.has("ehv"), mapApi.ehvConsumers);
  const hydel = useLayerData(on.has("hydel"), mapApi.hydelPowerStations);
  const thermal = useLayerData(on.has("thermal"), mapApi.thermalPowerStations);
  const pgcilSs = useLayerData(on.has("pgcil-ss"), mapApi.pgcilSubstations);
  const pgcilLines = useLayerData(on.has("pgcil-lines"), mapApi.pgcilLines);

  const transcoTotal = total(counts?.substations_transco);
  const lisWwTotal = total(counts?.substations_lis_ww);
  const linesTotal = total(counts?.lines);

  // A voltage class's lines are filtered only while that same class is the one
  // chosen in the From/To search; the other classes keep showing everything.
  const fromFor = (vc: VoltClass) => (filterVolt === vc ? fromSs : "");
  const toFor = (vc: VoltClass) => (filterVolt === vc ? toSs : "");

  return (
    <AppLayout fullBleed>
      <div className="map-page">
        <aside className="layer-panel">
          <fieldset>
            <legend>Maps</legend>
            {BASE_MAPS.map((b) => (
              <label className="layer-row" key={b.id}>
                <input
                  type="radio"
                  name="basemap"
                  checked={baseMap === b.id}
                  onChange={() => setBaseMap(b.id)}
                />
                <span className="layer-label">{b.label}</span>
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>Districts</legend>
            {(
              [
                ["none", "None"],
                ["new", "New districts (33)"],
                ["old", "Old districts (10)"],
              ] as [DistrictSet, string][]
            ).map(([id, label]) => (
              <label className="layer-row" key={id}>
                <input
                  type="radio"
                  name="districts"
                  checked={districts === id}
                  onChange={() => setDistricts(id)}
                />
                <span className="layer-label">{label}</span>
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>Substations</legend>
            {VOLT_CLASSES.map((vc) => (
              <LayerRow
                key={vc}
                checked={on.has(`ss-${vc}`)}
                onChange={() => toggle(`ss-${vc}`)}
                label={`${vc} kV`}
                count={countFor(counts?.substations_transco, vc)}
                icon={SUBSTATION_ICON[vc]}
              />
            ))}
            <div className="layer-total">Transco total {transcoTotal}</div>

            <div className="layer-subgroup">LIS &amp; WW</div>
            {VOLT_CLASSES.map((vc) => (
              <LayerRow
                key={vc}
                indent
                checked={on.has(`lisww-${vc}`)}
                onChange={() => toggle(`lisww-${vc}`)}
                label={`${vc} kV`}
                count={countFor(counts?.substations_lis_ww, vc)}
                icon={LIS_WW_ICON[vc]}
              />
            ))}
            <div className="layer-total">LIS &amp; WW total {lisWwTotal}</div>
            <div className="layer-total">
              Transco, LIS &amp; WW total {transcoTotal + lisWwTotal}
            </div>

            <LayerRow
              checked={on.has("pgcil-ss")}
              onChange={() => toggle("pgcil-ss")}
              label="PGCIL"
              count={counts?.pgcil_substations}
              icon={POINT_ICON.pgcil}
            />
          </fieldset>

          <fieldset>
            <legend>Transmission lines</legend>
            {VOLT_CLASSES.map((vc) => (
              <LayerRow
                key={vc}
                checked={on.has(`line-${vc}`)}
                onChange={() => toggle(`line-${vc}`)}
                label={`${vc} kV`}
                count={countFor(counts?.lines, vc)}
                swatch={VOLT_COLOUR[vc]}
              />
            ))}
            <div className="layer-total">Lines total {linesTotal}</div>

            <div className="line-filter">
              <label>
                <span>Search by end points</span>
                <select
                  value={filterVolt}
                  onChange={(e) => {
                    setFilterVolt(e.target.value as VoltClass | "");
                    setFromSs("");
                    setToSs("");
                  }}
                >
                  <option value="">Off</option>
                  {VOLT_CLASSES.map((vc) => (
                    <option key={vc} value={vc}>
                      {vc} kV
                    </option>
                  ))}
                </select>
              </label>
              {filterVolt && (
                <>
                  <label>
                    <span>From</span>
                    <select value={fromSs} onChange={(e) => setFromSs(e.target.value)}>
                      <option value="">All</option>
                      {endpoints.from.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>To</span>
                    <select value={toSs} onChange={(e) => setToSs(e.target.value)}>
                      <option value="">All</option>
                      {endpoints.to.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setFromSs("");
                      setToSs("");
                    }}
                  >
                    Clear
                  </button>
                </>
              )}
            </div>

            <LayerRow
              checked={on.has("pgcil-lines")}
              onChange={() => toggle("pgcil-lines")}
              label="PGCIL lines"
              count={counts?.pgcil_lines}
              swatch="#4a4a4a"
            />
          </fieldset>

          <fieldset>
            <legend>UG cables</legend>
            <LayerRow
              checked={on.has("ug-220")}
              onChange={() => toggle("ug-220")}
              label="220 kV"
              count={countFor(counts?.underground_lines, "220")}
              swatch={UG_COLOUR["220"]}
            />
            <LayerRow
              checked={on.has("ug-132")}
              onChange={() => toggle("ug-132")}
              label="132 kV"
              count={countFor(counts?.underground_lines, "132")}
              swatch={UG_COLOUR["132"]}
            />
          </fieldset>

          <fieldset>
            <legend>Generating station</legend>
            <LayerRow
              checked={on.has("hydel")}
              onChange={() => toggle("hydel")}
              label="Hydel"
              count={counts?.hydel_stations}
              icon={POINT_ICON.hydel}
            />
            <LayerRow
              checked={on.has("thermal")}
              onChange={() => toggle("thermal")}
              label="Thermal"
              count={counts?.thermal_stations}
              icon={POINT_ICON.thermal}
            />
            <LayerRow
              checked={on.has("solar")}
              onChange={() => toggle("solar")}
              label="Solar"
              count={counts?.solar_plants}
              icon={POINT_ICON.solar}
            />
          </fieldset>

          <fieldset>
            <legend>Consumers</legend>
            <LayerRow
              checked={on.has("ehv")}
              onChange={() => toggle("ehv")}
              label="EHV consumers"
              count={counts?.ehv_consumers}
              icon={POINT_ICON.ehv}
            />
          </fieldset>

          <fieldset>
            <legend>Towers</legend>
            <LayerRow
              checked={on.has("towers")}
              onChange={() => toggle("towers")}
              label="Towers"
              title={`Drawn automatically at zoom ${TOWER_ZOOM_THRESHOLD} and closer`}
            />
            <div className="layer-total">Shown from zoom {TOWER_ZOOM_THRESHOLD}</div>
          </fieldset>
        </aside>

        <MapContainer center={TELANGANA_CENTER} zoom={DEFAULT_ZOOM} className="map-container">
          <InvalidateSizeOnResize />
          <BaseMapLayer baseMap={baseMap} />
          <DistrictsLayer set={districts} />

          {VOLT_CLASSES.map((vc) => (
            <SubstationLayerGroup
              key={`ss-${vc}`}
              voltClass={vc}
              category="transco"
              enabled={on.has(`ss-${vc}`)}
            />
          ))}

          {VOLT_CLASSES.map((vc) => (
            <SubstationLayerGroup
              key={`lisww-${vc}`}
              voltClass={vc}
              category="lis_ww"
              enabled={on.has(`lisww-${vc}`)}
            />
          ))}

          {VOLT_CLASSES.map((vc) => (
            <LineLayerGroup
              key={`line-${vc}`}
              voltClass={vc}
              enabled={on.has(`line-${vc}`)}
              color={VOLT_COLOUR[vc]}
              fromSubstation={fromFor(vc)}
              toSubstation={toFor(vc)}
            />
          ))}

          <LineLayerGroup
            voltClass="220"
            enabled={on.has("ug-220")}
            color={UG_COLOUR["220"]}
            underground
          />
          <LineLayerGroup
            voltClass="132"
            enabled={on.has("ug-132")}
            color={UG_COLOUR["132"]}
            underground
          />

          <TowerViewportLayer enabled={on.has("towers")} />

          {pgcilSs.data && on.has("pgcil-ss") && (
            <IconMarkerLayer
              points={pgcilSs.data}
              iconUrl={POINT_ICON.pgcil}
              size={POINT_ICON_SIZE}
              keyOf={(p) => p.id}
              tooltip={(p) => p.name ?? "PGCIL substation"}
              popup={(p) => (
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
            <IconMarkerLayer
              points={hydel.data}
              iconUrl={POINT_ICON.hydel}
              size={POINT_ICON_SIZE}
              keyOf={(h) => h.hydel_id}
              tooltip={(h) => h.name ?? "Hydel station"}
              popup={(h) => (
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

          {thermal.data && on.has("thermal") && (
            <IconMarkerLayer
              points={thermal.data}
              iconUrl={POINT_ICON.thermal}
              size={POINT_ICON_SIZE}
              keyOf={(t) => t.thermal_id}
              tooltip={(t) => t.name ?? "Thermal station"}
              popup={(t) => (
                <>
                  <strong>{t.name}</strong>
                  <br />
                  {t.gen_cap_mw ?? "?"} MW
                  {t.connected_ss && (
                    <>
                      <br />
                      Connected SS: {t.connected_ss}
                    </>
                  )}
                </>
              )}
            />
          )}

          {solar.data && on.has("solar") && (
            <IconMarkerLayer
              points={solar.data}
              iconUrl={POINT_ICON.solar}
              size={POINT_ICON_SIZE}
              keyOf={(s) => s.solar_id}
              tooltip={(s) => s.plant_name ?? "Solar plant"}
              popup={(s) => (
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
            <IconMarkerLayer
              points={ehv.data}
              iconUrl={POINT_ICON.ehv}
              size={POINT_ICON_SIZE}
              keyOf={(e) => e.ehv_id}
              tooltip={(e) => e.name ?? "EHV consumer"}
              popup={(e) => (
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
        </MapContainer>
      </div>
    </AppLayout>
  );
}
