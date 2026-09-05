import { get } from "./client";
import type {
  CountByCategory,
  EhvConsumerMarker,
  HydelPowerStationMarker,
  LineFeature,
  PgcilLineMarker,
  PgcilSubstationMarker,
  SolarPlantMarker,
  SubstationLookup,
  SubstationMarker,
  TowerMarker,
} from "../types/map";

const qs = (params: Record<string, string | number | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string | number)}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

export const mapApi = {
  substations: (voltClass?: string) =>
    get<SubstationMarker[]>(`/map/substations${qs({ volt_class: voltClass })}`),
  substationsSummary: () => get<CountByCategory[]>("/map/substations/summary"),
  substationsLookup: () => get<SubstationLookup[]>("/map/substations/lookup"),
  solarPlants: () => get<SolarPlantMarker[]>("/map/solar-plants"),
  ehvConsumers: () => get<EhvConsumerMarker[]>("/map/ehv-consumers"),
  lines: (voltClass?: string) => get<LineFeature[]>(`/map/lines${qs({ volt_class: voltClass })}`),
  towersByFeeder: (feederId: number) =>
    get<TowerMarker[]>(`/map/towers${qs({ feeder_id: feederId })}`),
  towersNear: (lat: number, lng: number, radiusKm: number) =>
    get<TowerMarker[]>(
      `/map/towers${qs({ near_lat: lat, near_lng: lng, radius_km: radiusKm })}`
    ),
  pgcilSubstations: () => get<PgcilSubstationMarker[]>("/map/pgcil-substations"),
  hydelPowerStations: () => get<HydelPowerStationMarker[]>("/map/hydel-power-stations"),
  pgcilLines: () => get<PgcilLineMarker[]>("/map/pgcil-lines"),
};
