// Mirrors app/schemas/substation.py field-for-field.
import type { MapPoint } from "./map";

export type EquipmentKind = "shunt_reactor" | "capacitor" | "station_transformer";

export const EQUIPMENT_KINDS: { value: EquipmentKind; label: string }[] = [
  { value: "shunt_reactor", label: "Shunt reactor" },
  { value: "capacitor", label: "Capacitor" },
  { value: "station_transformer", label: "Station transformer" },
];

export interface TransformerIn {
  slot_no: number;
  capacity_mva: string | null;
  serial_no: string | null;
  make: string | null;
  vector_group: string | null;
  /** Free text as the legacy form accepted it; the server parses and keeps it. */
  yoc_raw: string | null;
  po_reference: string | null;
  volt_level: string | null;
}

export interface TransformerOut extends TransformerIn {
  id: number;
  year_of_commissioning: string | null;
  yoc_year: number | null;
}

export interface EquipmentIn {
  kind: EquipmentKind;
  capacity_mva: string | null;
  serial_no: string | null;
  make: string | null;
  vector_group: string | null;
  yoc_raw: string | null;
  po_reference: string | null;
}

export interface EquipmentOut extends EquipmentIn {
  id: number;
  year_of_commissioning: string | null;
  yoc_year: number | null;
}

export interface SubstationFields {
  ss_name: string | null;
  ss_type: string | null;
  volt_class: string | null;
  volt_levels: string | null;
  primary_mva_cap: string | null;
  no_of_ptrs: number | null;

  district: string | null;
  zone: string | null;
  circle: string | null;
  division: string | null;
  plant_circle: string | null;

  manned: string | null;
  generation: string | null;
  gen_type: string | null;
  scada: string | null;
  railway_tss: string | null;
  gis_type: string | null;
  ehv_consumer: string | null;
  rad_grid: string | null;
  dg_set: string | null;
  dg_and_ff_system: string | null;
  contact_no: string | null;

  function_loc_code: string | null;
  sap_erp_connectivity: string | null;
  rrsc_ss_code: string | null;
  ss_erp_source: string | null;

  ss_doc: string | null;
  link_sld: string | null;
  link_ss_photo: string | null;
  link_ss_layout: string | null;
}

export interface SubstationWrite extends SubstationFields {
  location: MapPoint | null;
  boundary: MapPoint[] | null;
  transformers: TransformerIn[];
  equipment: EquipmentIn[];
}

export interface SubstationCreate extends SubstationWrite {
  ss_code: number;
}

export interface SubstationDetail extends SubstationFields {
  ss_code: number;
  location: MapPoint | null;
  boundary: MapPoint[] | null;
  transformers: TransformerOut[];
  equipment: EquipmentOut[];
  inserted_by: string | null;
  inserted_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

export interface SubstationListItem {
  ss_code: number;
  ss_name: string | null;
  ss_type: string | null;
  volt_class: string | null;
  volt_levels: string | null;
  district: string | null;
  zone: string | null;
  circle: string | null;
  division: string | null;
  primary_mva_cap: string | null;
  no_of_ptrs: number | null;
  transformer_count: number;
  has_location: boolean;
}

export interface SubstationPage {
  items: SubstationListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface SubstationListParams {
  q?: string;
  volt_class?: string;
  zone?: string;
  circle?: string;
  limit?: number;
  offset?: number;
}
