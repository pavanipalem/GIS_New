// Mirrors app/schemas/assets.py.
import type { MapPoint } from "./map";

export interface SolarPlantFields {
  plant_name: string | null;
  location_desc: string | null;
  installed_capacity_mw: string | null;
  interfacing_ss: string | null;
  voltage_level: string | null;
  /** Free text as the legacy form accepted it. */
  commercial_operation_date_raw: string | null;
  division: string | null;
  circle: string | null;
  zone: string | null;
  location: MapPoint | null;
}

export interface SolarPlantOut extends SolarPlantFields {
  solar_id: number;
  commercial_operation_date: string | null;
}

export interface EhvConsumerFields {
  name: string | null;
  location_desc: string | null;
  installed_capacity_mw: string | null;
  feeder_id: number | null;
  feeder_name: string | null;
  substation: string | null;
  consumer_code: string | null;
  voltage_rate: string | null;
  function_loc_code: string | null;
  connected_ss: string | null;
  line_name: string | null;
  line_code: string | null;
  division: string | null;
  circle: string | null;
  zone: string | null;
  location: MapPoint | null;
}

export interface EhvConsumerOut extends EhvConsumerFields {
  ehv_id: number;
}
