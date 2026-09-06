import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { linesApi, towersApi } from "../api/network";
import { ApiError } from "../api/client";
import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../auth/AuthContext";
import { BulkExcel } from "../components/BulkExcel";
import type { LineDetail, TowerOut } from "../types/network";

const TOWER_PAGE = 100;

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="field-value">{value === null || value === "" ? "—" : value}</span>
    </div>
  );
}

export default function LineDetailPage() {
  const { feederId } = useParams<{ feederId: string }>();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "editor";
  const id = Number(feederId);

  const [line, setLine] = useState<LineDetail | null>(null);
  const [towers, setTowers] = useState<TowerOut[]>([]);
  const [towerTotal, setTowerTotal] = useState(0);
  const [towerOffset, setTowerOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadTowers = useCallback(async () => {
    const page = await towersApi.list({ feeder_id: id, limit: TOWER_PAGE, offset: towerOffset });
    setTowers(page.items);
    setTowerTotal(page.total);
  }, [id, towerOffset]);

  const reload = useCallback(async () => {
    try {
      setLine(await linesApi.get(id));
      await loadTowers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load line");
    }
  }, [id, loadTowers]);

  useEffect(() => {
    if (feederId) reload();
  }, [feederId, reload]);

  const removeTower = async (towerId: number) => {
    if (!confirm(`Delete tower ${towerId}? The line's route will be redrawn.`)) return;
    try {
      await towersApi.remove(towerId);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete tower");
    }
  };

  if (error && !line) {
    return (
      <AppLayout>
        <p className="auth-error">{error}</p>
        <Link to="/lines">Back to list</Link>
      </AppLayout>
    );
  }
  if (!line) {
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
            {line.feeder_name ?? "Unnamed line"}{" "}
            <span className="page-head-sub">#{line.feeder_id}</span>
          </h1>
          <p className="page-head-meta">
            {line.volt_class ? `${line.volt_class} kV` : "voltage unknown"}
            {line.from_substation && ` · ${line.from_substation} → ${line.to_substation ?? "?"}`}
          </p>
        </div>
        <div className="page-head-actions">
          <Link className="button-link" to="/lines">
            Back
          </Link>
          {canEdit && (
            <Link className="button-link primary" to={`/lines/${line.feeder_id}/edit`}>
              Edit
            </Link>
          )}
        </div>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <section className="card">
        <h2>Line</h2>
        <div className="field-grid">
          <Field label="Feeder id" value={line.feeder_id} />
          <Field label="Name" value={line.feeder_name} />
          <Field label="Voltage class" value={line.volt_class} />
          <Field label="From" value={line.from_substation} />
          <Field label="To" value={line.to_substation} />
          <Field label="Length (ckm)" value={line.length_ckm} />
          <Field label="Length of line" value={line.length_of_line} />
          <Field label="Total locations" value={line.total_no_of_locations} />
          <Field label="Circuit type" value={line.circuit_type} />
          <Field label="Conductor type" value={line.conductor_type} />
          <Field label="Earth wire / OPGW" value={line.earth_wire_type} />
          <Field label="Max load (A)" value={line.max_load_in_amp} />
          <Field label="Jurisdiction" value={line.jurisdiction} />
          <Field label="Zone" value={line.zone} />
          <Field label="Circle" value={line.circle} />
          <Field label="SAP FL code" value={line.sap_fl_code} />
        </div>
      </section>

      <section className="card">
        <h2>Dates</h2>
        <p className="hint">
          Many of these hold more than one date — per circuit, per section, or with a qualifier.
          The original text is always kept; the parsed date is only filled when the text is a
          single unambiguous date.
        </p>
        <div className="field-grid">
          <Field label="Date of charging (as entered)" value={line.date_of_charging_raw} />
          <Field label="Date of charging (parsed)" value={line.date_of_charging} />
          <Field label="Last maintenance (as entered)" value={line.last_maintenance_date_raw} />
          <Field label="Last maintenance (parsed)" value={line.last_maintenance_date} />
        </div>
      </section>

      {line.additional_info && (
        <section className="card">
          <h2>Additional info</h2>
          <p>{line.additional_info}</p>
        </section>
      )}

      <section className="card">
        <div className="page-head">
          <h2>
            Towers ({towerTotal}) {line.route ? `· route drawn from ${line.route.length} points` : "· no route"}
          </h2>
          {canEdit && (
            <Link className="link-button" to={`/lines/${line.feeder_id}/towers/new`}>
              Add tower
            </Link>
          )}
        </div>
        <p className="hint">
          The route on the map is these towers joined in sequence order. Adding, moving or
          deleting one redraws it automatically.
        </p>

        <BulkExcel kind="towers" feederId={line.feeder_id} canEdit={canEdit} onImported={reload} />

        {towers.length === 0 ? (
          <p className="empty">No towers on this line.</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="num">Seq</th>
                    <th>Location no</th>
                    <th>Type</th>
                    <th>Extension</th>
                    <th>Circuit</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Joint box</th>
                    {canEdit && <th />}
                  </tr>
                </thead>
                <tbody>
                  {towers.map((t) => (
                    <tr key={t.tower_id}>
                      <td className="num">{t.seq_no ?? "—"}</td>
                      <td>{t.location_no ?? "—"}</td>
                      <td>{t.tower_type ?? "—"}</td>
                      <td>{t.tower_extension ?? "—"}</td>
                      <td>{t.circuit_type ?? "—"}</td>
                      <td>{t.location?.lat ?? "—"}</td>
                      <td>{t.location?.lng ?? "—"}</td>
                      <td>{t.telecom_joint_box ?? "—"}</td>
                      {canEdit && (
                        <td>
                          <Link to={`/towers/${t.tower_id}/edit`}>Edit</Link>{" "}
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => removeTower(t.tower_id)}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {towerTotal > TOWER_PAGE && (
              <div className="pager">
                <button
                  type="button"
                  disabled={towerOffset === 0}
                  onClick={() => setTowerOffset(Math.max(0, towerOffset - TOWER_PAGE))}
                >
                  Previous
                </button>
                <span className="filter-count">
                  {towerOffset + 1}–{Math.min(towerOffset + TOWER_PAGE, towerTotal)} of{" "}
                  {towerTotal}
                </span>
                <button
                  type="button"
                  disabled={towerOffset + TOWER_PAGE >= towerTotal}
                  onClick={() => setTowerOffset(towerOffset + TOWER_PAGE)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <p className="record-audit">
        Created by {line.inserted_by ?? "unknown"}
        {line.inserted_at && ` on ${new Date(line.inserted_at).toLocaleDateString()}`}
        {line.updated_by && ` · last updated by ${line.updated_by}`}
      </p>
    </AppLayout>
  );
}
