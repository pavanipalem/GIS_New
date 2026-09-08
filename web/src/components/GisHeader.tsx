import { Link } from "react-router-dom";

/** The institutional header carried on every page: the TGTRANSCO mark, the
 * corporation identity, and the Telangana Rising emblem.
 *
 * Both marks are served from public/brand/. tgtransco.png is the official
 * logo (from the legacy app's Images folder). telangana-rising.png is a
 * stand-in Rising mark until the current "Cure · Pure · Rare" artwork is
 * supplied - replace that one file, keeping the name, and nothing here
 * changes; the header sizes each by height and lets the width follow. */
export function GisHeader() {
  return (
    <header className="gis-header">
      <Link to="/" className="gis-header-mark" aria-label="TGTRANSCO — Home">
        <img src="/brand/tgtransco.png" alt="TGTRANSCO" />
      </Link>

      <div className="gis-header-titles">
        <p className="gis-header-corp">Transmission Corporation of Telangana Limited</p>
        <p className="gis-header-addr">
          Vidyut Soudha : Hyderabad-500 082 : Telangana State : India
        </p>
        <p className="gis-header-portal">Graphical Information System (GIS) Portal</p>
      </div>

      <img
        className="gis-header-emblem"
        src="/brand/telangana-rising.png"
        alt="Telangana Rising"
      />
    </header>
  );
}
