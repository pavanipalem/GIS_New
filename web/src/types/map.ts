// Mirrors app/schemas/map.py exactly - field-for-field, so a backend schema
// change is a compile error here rather than a silent runtime mismatch.

export interface MapPoint {
  lat: number;
  lng: number;
}

export interface SubstationMarker {
  ss_code: number;
  ss_name: string | null;
  ss_type: string | null;
  volt_class: string | null;
  no_of_ptrs: number | null;
  ss_doc: string | null;
  primary_mva_cap: number | null;
  district: string | null;
  zone: string | null;
  circle: string | null;
  division: string | null;
  /** Filenames only - joined to VITE_DOCUMENT_BASE_URL by the client. */
  link_sld: string | null;
  link_ss_photo: string | null;
  lat: number;
  lng: number;
}

export interface SubstationLookup {
  ss_code: number;
  title: string;
  lat: number;
  lng: number;
}

export interface CountByCategory {
  category: string;
  count: number;
}

export interface SolarPlantMarker {
  solar_id: number;
  plant_name: string | null;
  installed_capacity_mw: number | null;
  interfacing_ss: string | null;
  lat: number;
  lng: number;
}

export interface EhvConsumerMarker {
  ehv_id: number;
  name: string | null;
  installed_capacity_mw: number | null;
  substation: string | null;
  feeder_id: number | null;
  lat: number;
  lng: number;
}

export interface LineFeature {
  feeder_id: number;
  feeder_name: string | null;
  volt_class: string | null;
  from_substation: string | null;
  to_substation: string | null;
  tower_count: number | null;
  length_ckm: number | null;
  path: MapPoint[];
}

export interface TowerMarker {
  tower_id: number;
  feeder_id: number | null;
  seq_no: number | null;
  location_no: string | null;
  tower_type: string | null;
  // drive the legacy colour rules
  telecom_joint_box: string | null;
  additional_info: string | null;
  lat: number;
  lng: number;

  // joined from gis.line, because a viewport query spans many feeders
  line_volt_class: string | null;
  line_feeder_name: string | null;
  line_length_ckm: number | null;
  line_tower_count: number | null;
  line_circuit_type: string | null;
  line_conductor_type: string | null;
  line_date_of_charging: string | null;
}

export interface PgcilSubstationMarker {
  id: number;
  voltage: string | null;
  name: string | null;
  lat: number;
  lng: number;
}

export interface HydelPowerStationMarker {
  hydel_id: number;
  name: string | null;
  gen_cap_mw: number | null;
  connected_ss: string | null;
  lat: number;
  lng: number;
}

export interface PgcilLineMarker {
  id: number;
  feeder_name: string | null;
  lat: number;
  lng: number;
}
