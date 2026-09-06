import { CircleMarker, Popup, Tooltip } from "react-leaflet";
import { Link } from "react-router-dom";
import { mapApi } from "../../api/map";
import { useLayerData } from "./useLayerData";
import type { SubstationMarker } from "../../types/map";

/** Where the legacy SLD PDFs and site photos are served from. The database
 * stores only filenames ("2513link_sld.pdf"); the old IIS site served them
 * from Upload/links/. */
const DOCUMENT_BASE_URL: string =
  (import.meta.env.VITE_DOCUMENT_BASE_URL as string | undefined) ?? "/documents";

const docUrl = (filename: string) =>
  `${DOCUMENT_BASE_URL.replace(/\/$/, "")}/${encodeURIComponent(filename)}`;

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="ss-popup-row">
      <span className="ss-popup-label">{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** One component instance per voltage class, so useLayerData is called once
 * per component rather than in a loop. Keeps the hook call order stable even
 * if the voltage-class list later becomes dynamic (e.g. driven by
 * /api/map/substations/summary). */
export function SubstationLayerGroup({
  voltClass,
  enabled,
  color,
}: {
  voltClass: string;
  enabled: boolean;
  color: string;
}) {
  const { data } = useLayerData<SubstationMarker>(enabled, () => mapApi.substations(voltClass));
  if (!enabled || !data) return null;

  return (
    <>
      {data.map((s) => (
        <CircleMarker
          key={s.ss_code}
          center={[s.lat, s.lng]}
          radius={6}
          pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 1 }}
        >
          {/* legacy bindLabel(ss_name, { noHide: false }) - name on hover */}
          <Tooltip direction="top">{s.ss_name ?? `Substation ${s.ss_code}`}</Tooltip>

          <Popup minWidth={260}>
            <div className="ss-popup">
              <strong className="ss-popup-title">
                {s.volt_class ? `${s.volt_class} kV SS ` : ""}
                {s.ss_name ?? s.ss_code}
              </strong>

              <Row label="Date of commissioning" value={s.ss_doc} />
              <Row label="Type" value={s.ss_type} />
              <Row label="No. of PTRs" value={s.no_of_ptrs} />
              <Row label="Primary MVA capacity" value={s.primary_mva_cap} />
              <Row label="Latitude" value={s.lat} />
              <Row label="Longitude" value={s.lng} />
              <Row label="District" value={s.district} />
              <Row label="Zone" value={s.zone} />
              <Row label="Circle" value={s.circle} />
              <Row label="Division" value={s.division} />

              {s.link_ss_photo && (
                <a
                  className="ss-popup-photo"
                  href={docUrl(s.link_ss_photo)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={docUrl(s.link_ss_photo)}
                    alt={`${s.ss_name ?? s.ss_code} site photo`}
                    loading="lazy"
                    // the documents may not be reachable yet; hide rather
                    // than showing a broken-image icon in the popup
                    onError={(e) => {
                      (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                    }}
                  />
                </a>
              )}

              <div className="ss-popup-actions">
                {s.link_sld ? (
                  <a href={docUrl(s.link_sld)} target="_blank" rel="noreferrer">
                    View SLD
                  </a>
                ) : (
                  <span className="ss-popup-muted">No SLD on record</span>
                )}
                <Link to={`/substations/${s.ss_code}`}>More</Link>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}
