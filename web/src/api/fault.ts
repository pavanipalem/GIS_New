import { get } from "./client";
import type { FaultLocation } from "../types/fault";

export const faultApi = {
  /** Place a reported distance-to-fault on a line. The line is identified by
   * voltage + From + To (the page's three dropdowns); `measuredFrom` says
   * which of its two ends the relay measured from. */
  locate: (params: {
    voltClass: string;
    fromSubstation: string;
    toSubstation: string;
    measuredFrom: string;
    distanceKm: number;
  }) => {
    const qs = new URLSearchParams({
      volt_class: params.voltClass,
      from_substation: params.fromSubstation,
      to_substation: params.toSubstation,
      measured_from: params.measuredFrom,
      distance_km: String(params.distanceKm),
    });
    return get<FaultLocation>(`/fault/locate?${qs.toString()}`);
  },
};
