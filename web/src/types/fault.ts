import type { MapPoint } from "./map";

export interface FaultTower {
  tower_id: number;
  seq_no: number | null;
  location_no: string | null;
  tower_type: string | null;
  telecom_joint_box: string | null;
  lat: number;
  lng: number;
  /** Running distance from the measuring end, at this tower. */
  distance_km: number;
}

export interface FaultLocation {
  feeder_id: number;
  feeder_name: string | null;
  volt_class: string | null;
  from_substation: string | null;
  to_substation: string | null;

  measured_from: string;
  /** The stored tower chain was walked back-to-front. */
  reversed: boolean;
  /** The direction was checked against the substations' coordinates rather
   * than assumed from the From/To text columns. */
  direction_verified: boolean;
  direction_note: string | null;

  distance_km: number;
  route_length_km: number;
  recorded_length_ckm: number | null;

  fault_point: MapPoint;
  before_tower: FaultTower;
  after_tower: FaultTower;
  cumulative_km_before: number;
  section_km: number;

  towers: FaultTower[];
}
