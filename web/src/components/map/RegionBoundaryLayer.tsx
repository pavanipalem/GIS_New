import { useEffect, useState } from "react";
import { GeoJSON, Pane } from "react-leaflet";
import { loadRegionGeometry, type RegionGeometry, type RegionKey } from "./regionFilter";

/** The ORR and RRR outlines, drawn while a Region sub-region is selected so
 * the spatial filter has a visible edge (the same idea as the district
 * boundary layer). Same two polygons the filter itself uses.
 *
 *   orr checked            -> ORR outline
 *   rrr_excl_orr checked   -> ORR + RRR outlines (the ring lies between them)
 *   outside_rrr checked    -> RRR outline
 *
 * Nothing is drawn for the default "Telangana" view.
 */
const ORR_STYLE = {
  color: "#8e24aa",
  weight: 2,
  opacity: 0.9,
  fill: false,
  dashArray: "5 3",
} as const;

const RRR_STYLE = {
  color: "#00897b",
  weight: 2,
  opacity: 0.9,
  fill: false,
  dashArray: "5 3",
} as const;

export function RegionBoundaryLayer({ regions }: { regions: ReadonlySet<RegionKey> }) {
  const [geom, setGeom] = useState<RegionGeometry | null>(null);

  const showOrr = regions.has("orr") || regions.has("rrr_excl_orr");
  const showRrr = regions.has("rrr_excl_orr") || regions.has("outside_rrr");
  const wanted = showOrr || showRrr;

  useEffect(() => {
    if (!wanted || geom) return;
    let cancelled = false;
    loadRegionGeometry()
      .then((g) => {
        if (!cancelled) setGeom(g);
      })
      .catch(() => {
        /* leave null - just no outline */
      });
    return () => {
      cancelled = true;
    };
  }, [wanted, geom]);

  if (!wanted || !geom) return null;

  return (
    // above the district pane (350), below Leaflet's overlay/marker panes
    <Pane name="region-boundary" style={{ zIndex: 360 }}>
      {showRrr && <GeoJSON key="rrr" data={geom.rrr} style={() => RRR_STYLE} />}
      {showOrr && <GeoJSON key="orr" data={geom.orr} style={() => ORR_STYLE} />}
    </Pane>
  );
}
