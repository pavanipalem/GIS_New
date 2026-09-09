import type { MapPoint, SubstationMarker } from "./map";

export interface NearbyLine {
  feeder_id: number;
  feeder_name: string | null;
  volt_class: string | null;
  from_substation: string | null;
  to_substation: string | null;
  length_ckm: number | null;
  is_underground: boolean;
  /** Route clipped to the search circle - one run of points per stretch
   * inside it. */
  segments: MapPoint[][];
}

export interface NearbyResult {
  center: MapPoint;
  radius_km: number;
  volt_classes: string[];
  substations: SubstationMarker[];
  lines: NearbyLine[];
}
