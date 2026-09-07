import { get } from "./client";
import type {
  CountByCategory,
  LayerCounts,
  EhvConsumerMarker,
  HydelPowerStationMarker,
  LineFeature,
  PgcilLineMarker,
  PgcilSubstationMarker,
  SolarPlantMarker,
  SubstationEndpoints,
  SubstationLookup,
  SubstationMarker,
  ThermalPowerStationMarker,
  TowerMarker,
} from "../types/map";

const qs = (params: Record<string, string | number | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string | number)}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

export const mapApi = {
  substations: (voltClass?: string, category?: string) =>
    get<SubstationMarker[]>(`/map/substations${qs({ volt_class: voltClass, category })}`),
  substationsSummary: () => get<CountByCategory[]>("/map/substations/summary"),
  substationsLookup: () => get<SubstationLookup[]>("/map/substations/lookup"),
  solarPlants: () => get<SolarPlantMarker[]>("/map/solar-plants"),
  ehvConsumers: () => get<EhvConsumerMarker[]>("/map/ehv-consumers"),
  lines: (voltClass?: string, underground?: boolean) =>
    get<LineFeature[]>(
      `/map/lines${qs({ volt_class: voltClass, underground: underground === undefined ? undefined : String(underground) })}`
    ),
  lineEndpoints: (voltClass?: string) =>
    get<SubstationEndpoints>(`/map/lines/endpoints${qs({ volt_class: voltClass })}`),
  layerCounts: () => get<LayerCounts>("/map/layer-counts"),
  thermalPowerStations: () => get<ThermalPowerStationMarker[]>("/map/thermal-power-stations"),
  towersByFeeder: (feederId: number) =>
    get<TowerMarker[]>(`/map/towers${qs({ feeder_id: feederId })}`),
  towersNear: (lat: number, lng: number, radiusKm: number) =>
    get<TowerMarker[]>(
      `/map/towers${qs({ near_lat: lat, near_lng: lng, radius_km: radiusKm })}`
    ),
  /** west,south,east,north in WGS84 degrees. Rejects with 400 above 5,000
   * towers, so only call it once zoomed in far enough. */
  towersInBbox: (west: number, south: number, east: number, north: number) =>
    get<TowerMarker[]>(`/map/towers${qs({ bbox: `${west},${south},${east},${north}` })}`),
  pgcilSubstations: () => get<PgcilSubstationMarker[]>("/map/pgcil-substations"),
  hydelPowerStations: () => get<HydelPowerStationMarker[]>("/map/hydel-power-stations"),
  pgcilLines: () => get<PgcilLineMarker[]>("/map/pgcil-lines"),
};
