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
import { TowerViewportLayer } from "../components/map/TowerViewportLayer";
import { InvalidateSizeOnResize } from "../components/map/InvalidateSizeOnResize";
import { ClampNorth } from "../components/map/ClampNorth";
import {
  ALLOWED_BOUNDS,
  MAX_ZOOM,
  MIN_ZOOM,
} from "../components/map/viewRestriction";
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
  | "ehv";

// First load shows only the base map and the district outlines - the two
// radio groups already default to "Open street" and "New districts". No data
// layer is on until the user turns one on.
const DEFAULT_ON: LayerKey[] = [];

const UG_VOLT_CLASSES = ["220", "132"] as const;

/** Whether the layer panel is open is remembered per browser: someone who
 * works mostly at full-map width should not have to collapse it on every
 * visit. Storage can throw (private windows, blocked site data), and the
 * panel open is the safe default either way. */
const PANEL_KEY = "gis.map.panelOpen";

const readPanelOpen = () => {
  try {
    return window.localStorage.getItem(PANEL_KEY) !== "0";
  } catch {
    return true;
  }
};

const writePanelOpen = (open: boolean) => {
  try {
    window.localStorage.setItem(PANEL_KEY, open ? "1" : "0");
  } catch {
    // not worth surfacing - the panel still works, it just won't be remembered
  }
};

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
  const [panelOpen, setPanelOpen] = useState(readPanelOpen);

  // The From / To line search. Always shown, spans every line regardless of
  // which voltage layers are on. Picking a From narrows To to the substations
  // a line actually runs to from there, so the pair is never a combination
  // with no line behind it. With neither set, every enabled line shows.
  const [fromSs, setFromSs] = useState("");
  const [toSs, setToSs] = useState("");
  const [endpoints, setEndpoints] = useState<{
    from: string[];
    toByFrom: Map<string, string[]>;
  }>({ from: [], toByFrom: new Map() });

  useEffect(() => {
    mapApi
      .layerCounts()
      .then(setCounts)
      .catch(() => setCounts(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    mapApi
      .lineEndpoints()
      .then((e) => {
        if (cancelled) return;
        const toByFrom = new Map<string, string[]>();
        for (const [f, t] of e.pairs) {
          const list = toByFrom.get(f) ?? [];
          if (!list.includes(t)) list.push(t);
          toByFrom.set(f, list);
        }
        for (const list of toByFrom.values()) list.sort();
        setEndpoints({ from: e.from_substations, toByFrom });
      })
      .catch(() => {
        if (!cancelled) setEndpoints({ from: [], toByFrom: new Map() });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // To options: the destinations reachable from the chosen From, or every
  // distinct To when no From is picked yet.
  const toOptions = fromSs
    ? endpoints.toByFrom.get(fromSs) ?? []
    : [...new Set([...endpoints.toByFrom.values()].flat())].sort();

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

  // Towers follow the line layers: a class's towers are drawn on zoom-in only
  // while that class's line layer is on. Overhead lines and UG cables are
  // tracked apart so each tower is drawn once, in its own layer's colour.
  const overheadVoltClasses = VOLT_CLASSES.filter((vc) => on.has(`line-${vc}`));
  const ugVoltClasses = UG_VOLT_CLASSES.filter((vc) => on.has(`ug-${vc}`));

  // The write is deliberately outside the state updater: React can call an
  // updater more than once, and that must stay free of side effects.
  const togglePanel = () => {
    const next = !panelOpen;
    setPanelOpen(next);
    writePanelOpen(next);
  };

  return (
    <AppLayout fullBleed>
      <div className={panelOpen ? "map-page" : "map-page map-page-collapsed"}>
        {!panelOpen && (
          <button
            type="button"
            className="layer-panel-open"
            onClick={togglePanel}
            title="Show the layer menu"
          >
            <span aria-hidden="true">☰</span> Layers
          </button>
        )}

        <aside className="layer-panel" hidden={!panelOpen}>
          <div className="layer-panel-head">
            <h2>Layers</h2>
            <button
              type="button"
              className="layer-panel-hide"
              onClick={togglePanel}
              title="Hide the layer menu"
              aria-label="Hide the layer menu"
            >
              <span aria-hidden="true">«</span>
            </button>
          </div>

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
              <span className="line-filter-title">Search by end points</span>
              <label>
                <span>From</span>
                <select
                  value={fromSs}
                  onChange={(e) => {
                    setFromSs(e.target.value);
                    // a To that the new From does not reach would be a dead
                    // filter, so drop it and let the user re-pick
                    setToSs("");
                  }}
                >
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
                  {toOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              {(fromSs || toSs) && (
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

        </aside>

        <MapContainer
          center={TELANGANA_CENTER}
          zoom={DEFAULT_ZOOM}
          className="map-container"
          // the legacy view restriction: no panning up into north India
          maxBounds={ALLOWED_BOUNDS}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          // inertia off, as in drawmap() - a flick that coasts past the
          // limit only to be yanked back reads as the map fighting you
          inertia={false}
        >
          <InvalidateSizeOnResize />
          <ClampNorth />
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

          {/* the From/To search spans every line, so the same pair goes to
              all groups - overhead and UG alike */}
          {VOLT_CLASSES.map((vc) => (
            <LineLayerGroup
              key={`line-${vc}`}
              voltClass={vc}
              enabled={on.has(`line-${vc}`)}
              color={VOLT_COLOUR[vc]}
              fromSubstation={fromSs}
              toSubstation={toSs}
            />
          ))}

          <LineLayerGroup
            voltClass="220"
            enabled={on.has("ug-220")}
            color={UG_COLOUR["220"]}
            underground
            fromSubstation={fromSs}
            toSubstation={toSs}
          />
          <LineLayerGroup
            voltClass="132"
            enabled={on.has("ug-132")}
            color={UG_COLOUR["132"]}
            underground
            fromSubstation={fromSs}
            toSubstation={toSs}
          />

          <TowerViewportLayer voltClasses={overheadVoltClasses} underground={false} />
          <TowerViewportLayer voltClasses={ugVoltClasses} underground />

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
