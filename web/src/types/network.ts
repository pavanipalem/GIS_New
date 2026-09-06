// Mirrors app/schemas/network.py field-for-field.
import type { MapPoint } from "./map";

export interface LineFields {
  feeder_name: string | null;
  volt_class: string | null;
  from_substation: string | null;
  to_substation: string | null;
  total_no_of_locations: number | null;
  length_ckm: string | null;
  length_of_line: string | null;
  max_load_in_amp: string | null;
  circuit_type: string | null;
  conductor_type: string | null;
  earth_wire_type: string | null;
  /** Free text as the legacy form accepted it. Many hold more than one date. */
  date_of_charging_raw: string | null;
  last_maintenance_date_raw: string | null;
  jurisdiction: string | null;
  zone: string | null;
  circle: string | null;
  sap_fl_code: string | null;
  additional_info: string | null;
}

export interface LineDetail extends LineFields {
  feeder_id: number;
  date_of_charging: string | null;
  last_maintenance_date: string | null;
  tower_count: number | null;
  route: MapPoint[] | null;
  inserted_by: string | null;
  inserted_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

export interface LineListItem {
  feeder_id: number;
  feeder_name: string | null;
  volt_class: string | null;
  from_substation: string | null;
  to_substation: string | null;
  length_ckm: string | null;
  tower_count: number | null;
  zone: string | null;
  circle: string | null;
  has_route: boolean;
}

export interface LinePage {
  items: LineListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface TowerFields {
  location_no: string | null;
  seq_no: number | null;
  tower_type: string | null;
  tower_extension: string | null;
  circuit_type: string | null;
  make: string | null;
  towers_utilized: string | null;
  soil_strata: string | null;
  foundation_class: string | null;
  disc_70kn: number | null;
  disc_120kn: number | null;
  disc_160kn: number | null;
  src_70kn: number | null;
  src_120kn: number | null;
  src_160kn: number | null;
  earthing_type: string | null;
  earth_wire_type: string | null;
  telecom_joint_box: string | null;
  landmark: string | null;
  additional_info: string | null;
  volt_class: string | null;
  zone: string | null;
  circle: string | null;
  sap_id: number | null;
  rrsc_line_code: string | null;
  location: MapPoint | null;
}

export interface TowerOut extends TowerFields {
  tower_id: number;
  feeder_id: number | null;
  inserted_by: string | null;
  inserted_at: string | null;
  updated_by: string | null;
}

export interface TowerPage {
  items: TowerOut[];
  total: number;
  limit: number;
  offset: number;
}
