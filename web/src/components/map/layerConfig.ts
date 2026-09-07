/** Layer definitions for the map panel, mirroring the legacy MapView list.
 *
 * Icons are the original PNGs from the legacy Images folder, at the sizes
 * arcgisScript.js used them: 15px for 400 kV, 12 for 220, 10 for 132. The
 * "lw" files are the LIS & WW variants - that is what the suffix means.
 */

export type VoltClass = "400" | "220" | "132";

export const VOLT_CLASSES: VoltClass[] = ["400", "220", "132"];

/** Line colours from arcgisScript.js. */
export const VOLT_COLOUR: Record<VoltClass, string> = {
  "400": "#d62728",
  "220": "#ff7f0e",
  "132": "#1f77b4",
};

export const VOLT_ICON_SIZE: Record<VoltClass, number> = {
  "400": 15,
  "220": 12,
  "132": 10,
};

export const SUBSTATION_ICON: Record<VoltClass, string> = {
  "400": "/icons/400ss.png",
  "220": "/icons/220ss.png",
  "132": "/icons/132ss.png",
};

/** LIS & WW substations - the ss_type values the legacy map kept in a
 * separate group with its own counts. */
export const LIS_WW_ICON: Record<VoltClass, string> = {
  "400": "/icons/400lw.png",
  "220": "/icons/220lw.png",
  "132": "/icons/132lw.png",
};

export const POINT_ICON = {
  pgcil: "/icons/pgcilss.png",
  hydel: "/icons/hydro.png",
  thermal: "/icons/Thermal.png",
  solar: "/icons/solarplants.png",
  ehv: "/icons/ehv.png",
} as const;

export const POINT_ICON_SIZE = 18;

/** Underground cable colours, from towersloop() in arcgisScript.js. */
export const UG_COLOUR: Record<"220" | "132", string> = {
  "220": "#4C8002",
  "132": "#0000A0",
};

export type BaseMapId = "none" | "satellite" | "osm" | "gray";

export interface BaseMapOption {
  id: BaseMapId;
  label: string;
  url?: string;
  attribution?: string;
  /** Grey scale is the OSM tiles with a CSS filter, as the legacy
   * L.tileLayer.grayscale plugin did. */
  grayscale?: boolean;
}

export const BASE_MAPS: BaseMapOption[] = [
  { id: "none", label: "None" },
  {
    id: "satellite",
    label: "Satellite view",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery &copy; Esri",
  },
  {
    id: "osm",
    label: "Open street",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  {
    id: "gray",
    label: "Grey scale",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    grayscale: true,
  },
];

export type DistrictSet = "none" | "new" | "old";
