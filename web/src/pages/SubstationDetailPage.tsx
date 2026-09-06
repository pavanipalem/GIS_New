import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { substationsApi } from "../api/substations";
import { ApiError } from "../api/client";
import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../auth/AuthContext";
import { EQUIPMENT_KINDS } from "../types/substation";
import type { SubstationDetail } from "../types/substation";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="field-value">{value === null || value === "" ? "—" : value}</span>
    </div>
  );
}

const kindLabel = (k: string) => EQUIPMENT_KINDS.find((e) => e.value === k)?.label ?? k;

export default function SubstationDetailPage() {
  const { ssCode } = useParams<{ ssCode: string }>();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "editor";

  const [data, setData] = useState<SubstationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ssCode) return;
    substationsApi
      .get(Number(ssCode))
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load substation")
      );
  }, [ssCode]);

  if (error) {
    return (
      <AppLayout>
        <p className="auth-error">{error}</p>
        <Link to="/substations">Back to list</Link>
      </AppLayout>
    );
  }
  if (!data) {
    return (
      <AppLayout>
        <p className="page-loading">Loading…</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-head">
        <div>
          <h1>
            {data.ss_name ?? "Unnamed"}{" "}
            <span className="page-head-sub">#{data.ss_code}</span>
          </h1>
          <p className="page-head-meta">
            {data.volt_class ? `${data.volt_class} kV` : "voltage unknown"}
            {data.ss_type && ` · ${data.ss_type}`}
            {data.division && ` · ${data.division}`}
          </p>
        </div>
        <div className="page-head-actions">
          <Link className="button-link" to="/substations">
            Back
          </Link>
          {canEdit && (
            <Link className="button-link primary" to={`/substations/${data.ss_code}/edit`}>
              Edit
            </Link>
          )}
        </div>
      </div>

      <section className="card">
        <h2>Identity</h2>
        <div className="field-grid">
          <Field label="Substation code" value={data.ss_code} />
          <Field label="Name" value={data.ss_name} />
          <Field label="Type" value={data.ss_type} />
          <Field label="Voltage class" value={data.volt_class} />
          <Field label="Voltage levels" value={data.volt_levels} />
          <Field label="Primary MVA capacity" value={data.primary_mva_cap} />
          <Field label="Number of PTRs" value={data.no_of_ptrs} />
        </div>
      </section>

      <section className="card">
        <h2>Administration</h2>
        <div className="field-grid">
          <Field label="District" value={data.district} />
          <Field label="Zone" value={data.zone} />
          <Field label="Circle" value={data.circle} />
          <Field label="Division" value={data.division} />
          <Field label="Plant circle" value={data.plant_circle} />
          <Field label="Contact no" value={data.contact_no} />
        </div>
      </section>

      <section className="card">
        <h2>Attributes</h2>
        <div className="field-grid">
          <Field label="Manned" value={data.manned} />
          <Field label="Generation" value={data.generation} />
          <Field label="Generation type" value={data.gen_type} />
          <Field label="SCADA" value={data.scada} />
          <Field label="Railway TSS" value={data.railway_tss} />
          <Field label="GIS" value={data.gis_type} />
          <Field label="EHV consumer" value={data.ehv_consumer} />
          <Field label="Radial / grid" value={data.rad_grid} />
          <Field label="DG set" value={data.dg_set} />
          <Field label="DG & FF system" value={data.dg_and_ff_system} />
        </div>
      </section>

      <section className="card">
        <h2>Codes and documents</h2>
        <div className="field-grid">
          <Field label="Function location code" value={data.function_loc_code} />
          <Field label="SAP/ERP connectivity" value={data.sap_erp_connectivity} />
          <Field label="RRSC code" value={data.rrsc_ss_code} />
          <Field label="ERP source" value={data.ss_erp_source} />
          <Field label="Date of commissioning" value={data.ss_doc} />
          <Field label="SLD link" value={data.link_sld} />
          <Field label="Photo link" value={data.link_ss_photo} />
          <Field label="Layout link" value={data.link_ss_layout} />
        </div>
      </section>

      <section className="card">
        <h2>Location</h2>
        <div className="field-grid">
          <Field label="Latitude" value={data.location?.lat ?? null} />
          <Field label="Longitude" value={data.location?.lng ?? null} />
          <Field
            label="Boundary points"
            value={data.boundary ? data.boundary.length : "none stored"}
          />
        </div>
      </section>

      <section className="card">
        <h2>Transformers ({data.transformers.length})</h2>
        {data.transformers.length === 0 ? (
          <p className="empty">No transformers recorded.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="num">Slot</th>
                  <th className="num">Capacity (MVA)</th>
                  <th>Serial no</th>
                  <th>Make</th>
                  <th>Vector group</th>
                  <th>Volt level</th>
                  <th>Commissioned</th>
                </tr>
              </thead>
              <tbody>
                {data.transformers.map((t) => (
                  <tr key={t.id}>
                    <td className="num">{t.slot_no}</td>
                    <td className="num">{t.capacity_mva ?? "—"}</td>
                    <td>{t.serial_no ?? "—"}</td>
                    <td>{t.make ?? "—"}</td>
                    <td>{t.vector_group ?? "—"}</td>
                    <td>{t.volt_level ?? "—"}</td>
                    <td>
                      {t.year_of_commissioning ??
                        (t.yoc_year !== null ? String(t.yoc_year) : t.yoc_raw ?? "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Other equipment ({data.equipment.length})</h2>
        {data.equipment.length === 0 ? (
          <p className="empty">No other equipment recorded.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kind</th>
                  <th className="num">Capacity (MVA)</th>
                  <th>Serial no</th>
                  <th>Make</th>
                  <th>Vector group</th>
                  <th>Commissioned</th>
                </tr>
              </thead>
              <tbody>
                {data.equipment.map((e) => (
                  <tr key={e.id}>
                    <td>{kindLabel(e.kind)}</td>
                    <td className="num">{e.capacity_mva ?? "—"}</td>
                    <td>{e.serial_no ?? "—"}</td>
                    <td>{e.make ?? "—"}</td>
                    <td>{e.vector_group ?? "—"}</td>
                    <td>
                      {e.year_of_commissioning ??
                        (e.yoc_year !== null ? String(e.yoc_year) : e.yoc_raw ?? "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="record-audit">
        Created by {data.inserted_by ?? "unknown"}
        {data.inserted_at && ` on ${new Date(data.inserted_at).toLocaleDateString()}`}
        {data.updated_by && ` · last updated by ${data.updated_by}`}
        {data.updated_at && ` on ${new Date(data.updated_at).toLocaleDateString()}`}
      </p>
    </AppLayout>
  );
}
