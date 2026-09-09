import { useState } from "react";
import {
  SUBSTATION_ICON,
  UG_COLOUR,
  VOLT_CLASSES,
  VOLT_COLOUR,
} from "./layerConfig";

/** One legend for the whole site. The same voltage colours and the same
 * substation icon PNGs the Map view uses, so a marker means the same thing
 * on every page. Sits as an overlay in the bottom-left of a map; collapses
 * to a button so it never covers what you are looking at. */
export function MapLegend({
  extras,
}: {
  /** page-specific rows appended under the shared ones */
  extras?: { swatch: string; label: string }[];
}) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        type="button"
        className="map-legend-toggle"
        onClick={() => setOpen(true)}
      >
        Legend
      </button>
    );
  }

  return (
    <div className="map-legend">
      <div className="map-legend-head">
        <span>Legend</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Hide legend">
          ×
        </button>
      </div>

      <p className="map-legend-group">Substations</p>
      {VOLT_CLASSES.map((vc) => (
        <span className="map-legend-row" key={`ss-${vc}`}>
          <img src={SUBSTATION_ICON[vc]} alt="" aria-hidden="true" />
          {vc} kV
        </span>
      ))}

      <p className="map-legend-group">Lines</p>
      {VOLT_CLASSES.map((vc) => (
        <span className="map-legend-row" key={`ln-${vc}`}>
          <i style={{ background: VOLT_COLOUR[vc] }} />
          {vc} kV
        </span>
      ))}

      <p className="map-legend-group">UG cables</p>
      {(["220", "132"] as const).map((vc) => (
        <span className="map-legend-row" key={`ug-${vc}`}>
          <i className="dash" style={{ borderColor: UG_COLOUR[vc] }} />
          {vc} kV
        </span>
      ))}

      {extras && extras.length > 0 && (
        <>
          <p className="map-legend-group">This view</p>
          {extras.map((e) => (
            <span className="map-legend-row" key={e.label}>
              <i style={{ background: e.swatch }} />
              {e.label}
            </span>
          ))}
        </>
      )}
    </div>
  );
}
