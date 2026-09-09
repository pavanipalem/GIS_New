import { get } from "./client";
import type { NearbyResult } from "../types/proposal";

export const proposalsApi = {
  /** Existing substations, lines and UG cables within `radiusKm` of the
   * point. `voltClasses` empty means all three. Line routes come back
   * clipped to the circle. */
  nearby: (
    lat: number,
    lng: number,
    opts: { radiusKm?: number; voltClasses?: string[] } = {}
  ) => {
    const p = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (opts.radiusKm) p.set("radius_km", String(opts.radiusKm));
    for (const v of opts.voltClasses ?? []) p.append("volt_class", v);
    return get<NearbyResult>(`/proposals/nearby?${p.toString()}`);
  },
};
