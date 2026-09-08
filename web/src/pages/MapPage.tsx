import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
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
import { useRegionTest } from "../components/map/useRegionTest";
import { RegionBoundaryLayer } from "../components/map/RegionBoundaryLayer";
import {
  REGION_KEYS,
  REGION_LABELS,
  type RegionKey,
} from "../components/map/regionFilter";
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

/** A collapsible panel section. Replaces the old <fieldset>/<legend>: the
 * legacy MapView grouped its layers under headers that fold away, and with
 * every group now carrying counts and sub-filters the panel is long enough
 * that folding matters. */
function PanelGroup({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="panel-group">
      <button
        type="button"
        className="panel-group-head"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span
          className={open ? "panel-caret panel-caret-open" : "panel-caret"}
          aria-hidden="true"
        >
          ▸
        </span>
        <span className="panel-group-title">{title}</span>
      </button>
      {open && <div className="panel-group-body">{children}</div>}
    </section>
  );
}

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

  // Region spatial filter. The set holds the selected sub-regions; empty
  // means "Telangana" (the default, whole state). All three selected is the
  // whole state too, so useRegionTest returns null - no filtering - for both.
  const [regions, setRegions] = useState<Set<RegionKey>>(new Set());
  const pointInRegion = useRegionTest(regions);
  const telanganaSelected = regions.size === 0 || regions.size === REGION_KEYS.length;
  const toggleRegion = (key: RegionKey) =>
    setRegions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // The From / To line search - one per voltage level, scoped to that level's
  // lines. Picking a From narrows To to the substations a line actually runs
  // to from there within that level, so the pair is never a combination with
  // no line behind it. With neither set the level shows all its lines.
  const [lineFilter, setLineFilter] = useState<
    Record<VoltClass, { from: string; to: string }>
  >({
    "400": { from: "", to: "" },
    "220": { from: "", to: "" },
    "132": { from: "", to: "" },
  });
  // per-level: is the end-point search expanded? Shown by default; the user
  // folds it away when not filtering that level.
  const [lineFilterOpen, setLineFilterOpen] = useState<Record<VoltClass, boolean>>({
    "400": true,
    "220": true,
    "132": true,
  });
  // raw (volt_class, from, to) triples from the API
  const [linePairs, setLinePairs] = useState<[string, string, string][]>([]);

  // collapsed panel groups, by id. Absent = open, so every group starts open.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const groupOpen = (id: string) => !collapsedGroups.has(id);
  const toggleGroup = (id: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
        if (!cancelled) setLinePairs(e.pairs);
      })
      .catch(() => {
        if (!cancelled) setLinePairs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // pairs grouped by voltage: for each level, the distinct From values and,
  // per From, the To values it connects to (plus every To, for when no From
  // is picked).
  const endpointsByVc = useMemo(() => {
    const m = new Map<
      string,
      { froms: string[]; toByFrom: Map<string, string[]>; allTo: string[] }
    >();
    for (const [vc, f, t] of linePairs) {
      let e = m.get(vc);
      if (!e) {
        e = { froms: [], toByFrom: new Map(), allTo: [] };
        m.set(vc, e);
      }
      const tos = e.toByFrom.get(f) ?? [];
      if (!tos.includes(t)) tos.push(t);
      e.toByFrom.set(f, tos);
    }
    for (const e of m.values()) {
      e.froms = [...e.toByFrom.keys()].sort();
      e.allTo = [...new Set([...e.toByFrom.values()].flat())].sort();
      for (const tos of e.toByFrom.values()) tos.sort();
    }
    return m;
  }, [linePairs]);

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

  // Region filter for the point layers MapPage renders inline (the layer-
  // group components take pointInRegion as a prop and filter themselves).
  const inRegion = <T extends { lat: number; lng: number }>(rows: T[]) =>
    pointInRegion ? rows.filter((r) => pointInRegion(r.lat, r.lng)) : rows;

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

          <PanelGroup title="Maps" open={groupOpen("maps")} onToggle={() => toggleGroup("maps")}>
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
          </PanelGroup>

          <PanelGroup
            title="Districts"
            open={groupOpen("districts")}
            onToggle={() => toggleGroup("districts")}
          >
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
          </PanelGroup>

          <PanelGroup
            title="Region"
            open={groupOpen("region")}
            onToggle={() => toggleGroup("region")}
          >
            <label className="layer-row">
              <input
                type="checkbox"
                checked={telanganaSelected}
                // "whole state" - clear the sub-regions back to the default
                onChange={() => setRegions(new Set())}
              />
              <span className="layer-label">Telangana</span>
            </label>
            {REGION_KEYS.map((key) => (
              <label className="layer-row" key={key}>
                <input
                  type="checkbox"
                  checked={regions.has(key)}
                  onChange={() => toggleRegion(key)}
                />
                <span className="layer-label">{REGION_LABELS[key]}</span>
              </label>
            ))}
          </PanelGroup>

          <PanelGroup
            title="Substations"
            open={groupOpen("substations")}
            onToggle={() => toggleGroup("substations")}
          >
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
          </PanelGroup>

          <PanelGroup
            title="Transmission lines"
            open={groupOpen("lines")}
            onToggle={() => toggleGroup("lines")}
          >
            {VOLT_CLASSES.map((vc) => {
              const ep = endpointsByVc.get(vc);
              const f = lineFilter[vc];
              const filterOpen = lineFilterOpen[vc];
              const toOpts = f.from
                ? ep?.toByFrom.get(f.from) ?? []
                : ep?.allTo ?? [];
              return (
                <div className="line-level" key={vc}>
                  <div className="line-level-head">
                    <label className="layer-row">
                      <input
                        type="checkbox"
                        checked={on.has(`line-${vc}`)}
                        onChange={() => toggle(`line-${vc}`)}
                      />
                      <span
                        className="layer-swatch"
                        style={{ background: VOLT_COLOUR[vc] }}
                        aria-hidden="true"
                      />
                      <span className="layer-label">{vc} kV</span>
                      <span className="layer-count">{countFor(counts?.lines, vc)}</span>
                    </label>
                    <button
                      type="button"
                      className="line-level-toggle"
                      aria-expanded={filterOpen}
                      title={
                        filterOpen ? "Hide end-point search" : "Show end-point search"
                      }
                      onClick={() =>
                        setLineFilterOpen((s) => ({ ...s, [vc]: !s[vc] }))
                      }
                    >
                      <span
                        className={
                          filterOpen ? "panel-caret panel-caret-open" : "panel-caret"
                        }
                        aria-hidden="true"
                      >
                        ▸
                      </span>
                    </button>
                  </div>

                  {filterOpen && (
                    <div className="line-filter">
                      <label>
                        <span>From</span>
                        <select
                          value={f.from}
                          onChange={(e) =>
                            // a To the new From does not reach would be a dead
                            // filter, so drop it and let the user re-pick
                            setLineFilter((s) => ({
                              ...s,
                              [vc]: { from: e.target.value, to: "" },
                            }))
                          }
                        >
                          <option value="">All</option>
                          {(ep?.froms ?? []).map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>To</span>
                        <select
                          value={f.to}
                          onChange={(e) =>
                            setLineFilter((s) => ({
                              ...s,
                              [vc]: { ...s[vc], to: e.target.value },
                            }))
                          }
                        >
                          <option value="">All</option>
                          {toOpts.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                      {(f.from || f.to) && (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() =>
                            setLineFilter((s) => ({ ...s, [vc]: { from: "", to: "" } }))
                          }
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="layer-total">Lines total {linesTotal}</div>

            <LayerRow
              checked={on.has("pgcil-lines")}
              onChange={() => toggle("pgcil-lines")}
              label="PGCIL lines"
              count={counts?.pgcil_lines}
              swatch="#4a4a4a"
            />
          </PanelGroup>

          <PanelGroup
            title="UG cables"
            open={groupOpen("ug")}
            onToggle={() => toggleGroup("ug")}
          >
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
          </PanelGroup>

          <PanelGroup
            title="Generating station"
            open={groupOpen("generating")}
            onToggle={() => toggleGroup("generating")}
          >
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
          </PanelGroup>

          <PanelGroup
            title="Consumers"
            open={groupOpen("consumers")}
            onToggle={() => toggleGroup("consumers")}
          >
            <LayerRow
              checked={on.has("ehv")}
              onChange={() => toggle("ehv")}
              label="EHV consumers"
              count={counts?.ehv_consumers}
              icon={POINT_ICON.ehv}
            />
          </PanelGroup>
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
          <RegionBoundaryLayer regions={regions} />

          {VOLT_CLASSES.map((vc) => (
            <SubstationLayerGroup
              key={`ss-${vc}`}
              voltClass={vc}
              category="transco"
              enabled={on.has(`ss-${vc}`)}
              pointInRegion={pointInRegion}
            />
          ))}

          {VOLT_CLASSES.map((vc) => (
            <SubstationLayerGroup
              key={`lisww-${vc}`}
              voltClass={vc}
              category="lis_ww"
              enabled={on.has(`lisww-${vc}`)}
              pointInRegion={pointInRegion}
            />
          ))}

          {/* each overhead level filters by its own From/To pair */}
          {VOLT_CLASSES.map((vc) => (
            <LineLayerGroup
              key={`line-${vc}`}
              voltClass={vc}
              enabled={on.has(`line-${vc}`)}
              color={VOLT_COLOUR[vc]}
              fromSubstation={lineFilter[vc].from}
              toSubstation={lineFilter[vc].to}
              pointInRegion={pointInRegion}
            />
          ))}

          <LineLayerGroup
            voltClass="220"
            enabled={on.has("ug-220")}
            color={UG_COLOUR["220"]}
            underground
            pointInRegion={pointInRegion}
          />
          <LineLayerGroup
            voltClass="132"
            enabled={on.has("ug-132")}
            color={UG_COLOUR["132"]}
            underground
            pointInRegion={pointInRegion}
          />

          {/* one tower layer per line layer, so the towers shown match the
              lines shown - the selected voltage, the level's From/To, and
              nothing from an unselected category. The overhead levels draw
              every line of the voltage (UG-flagged ones included), so no
              `underground` filter here. */}
          {VOLT_CLASSES.filter((vc) => on.has(`line-${vc}`)).map((vc) => (
            <TowerViewportLayer
              key={`tow-oh-${vc}`}
              voltClass={vc}
              fromSubstation={lineFilter[vc].from}
              toSubstation={lineFilter[vc].to}
              pointInRegion={pointInRegion}
            />
          ))}
          {UG_VOLT_CLASSES.filter((vc) => on.has(`ug-${vc}`)).map((vc) => (
            <TowerViewportLayer
              key={`tow-ug-${vc}`}
              voltClass={vc}
              underground
              pointInRegion={pointInRegion}
            />
          ))}

          {pgcilSs.data && on.has("pgcil-ss") && (
            <IconMarkerLayer
              points={inRegion(pgcilSs.data)}
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
              points={inRegion(pgcilLines.data)}
              color="#4a4a4a"
              radius={2}
              keyOf={(p) => p.id}
              popupContent={(p) => <>{p.feeder_name} (PGCIL)</>}
            />
          )}

          {hydel.data && on.has("hydel") && (
            <IconMarkerLayer
              points={inRegion(hydel.data)}
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
              points={inRegion(thermal.data)}
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
              points={inRegion(solar.data)}
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
              points={inRegion(ehv.data)}
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
