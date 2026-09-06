import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { solarApi } from "../api/assets";
import { ApiError } from "../api/client";
import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../auth/AuthContext";
import type { SolarPlantFields, SolarPlantOut } from "../types/assets";

const empty = (): SolarPlantFields => ({
  plant_name: null, location_desc: null, installed_capacity_mw: null,
  interfacing_ss: null, voltage_level: null, commercial_operation_date_raw: null,
  division: null, circle: null, zone: null, location: null,
});

const str = (v: string) => (v.trim() === "" ? null : v.trim());

export default function SolarPlantsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "editor";

  const [rows, setRows] = useState<SolarPlantOut[]>([]);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<SolarPlantFields>(empty());
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await solarApi.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load solar plants");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startNew = () => {
    setEditingId("new");
    setForm(empty());
    setLat("");
    setLng("");
  };

  const startEdit = (r: SolarPlantOut) => {
    setEditingId(r.solar_id);
    setForm({ ...r });
    setLat(r.location ? String(r.location.lat) : "");
    setLng(r.location ? String(r.location.lng) : "");
  };

  const set = <K extends keyof SolarPlantFields>(k: K, v: SolarPlantFields[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const text = (k: keyof SolarPlantFields, label: string) => (
    <label>
      {label}
      <input
        value={(form[k] as string | null) ?? ""}
        onChange={(e) => set(k, str(e.target.value) as SolarPlantFields[typeof k])}
      />
    </label>
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload: SolarPlantFields = {
      ...form,
      location:
        lat.trim() !== "" && lng.trim() !== "" ? { lat: Number(lat), lng: Number(lng) } : null,
    };
    try {
      if (editingId === "new") await solarApi.create(payload);
      else if (editingId !== null) await solarApi.update(editingId, payload);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: SolarPlantOut) => {
    if (!confirm(`Delete ${r.plant_name ?? `plant ${r.solar_id}`}?`)) return;
    try {
      await solarApi.remove(r.solar_id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete");
    }
  };

  return (
    <AppLayout>
      <div className="page-head">
        <h1>Solar plants</h1>
        {canEdit && editingId === null && (
          <button type="button" onClick={startNew}>
            Add plant
          </button>
        )}
      </div>

      {error && <p className="auth-error">{error}</p>}

      {editingId !== null && (
        <form className="card" onSubmit={onSubmit}>
          <h2>{editingId === "new" ? "New solar plant" : `Edit plant ${editingId}`}</h2>
          <div className="form-grid">
            {text("plant_name", "Plant name")}
            {text("location_desc", "Location")}
            {text("installed_capacity_mw", "Installed capacity (MW)")}
            {text("interfacing_ss", "Interfacing substation")}
            {text("voltage_level", "Voltage level")}
            {text("commercial_operation_date_raw", "Commercial operation date")}
            {text("division", "Division")}
            {text("circle", "Circle")}
            {text("zone", "Zone")}
            <label>
              Latitude
              <input value={lat} inputMode="decimal" onChange={(e) => setLat(e.target.value)} />
            </label>
            <label>
              Longitude
              <input value={lng} inputMode="decimal" onChange={(e) => setLng(e.target.value)} />
            </label>
          </div>
          <p className="hint">
            The date is stored exactly as typed. A single clear date is also parsed for sorting;
            anything else is still kept in full.
          </p>
          <div className="page-head-actions">
            <button type="button" className="link-button" onClick={() => setEditingId(null)}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Id</th>
              <th>Plant name</th>
              <th className="num">Capacity (MW)</th>
              <th>Interfacing SS</th>
              <th>Voltage</th>
              <th>Commissioned</th>
              <th>Zone</th>
              <th>Located</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.solar_id}>
                <td>{r.solar_id}</td>
                <td className="truncate" title={r.plant_name ?? ""}>
                  {r.plant_name ?? "—"}
                </td>
                <td className="num">{r.installed_capacity_mw ?? "—"}</td>
                <td>{r.interfacing_ss ?? "—"}</td>
                <td>{r.voltage_level ?? "—"}</td>
                <td>{r.commercial_operation_date_raw ?? "—"}</td>
                <td>{r.zone ?? "—"}</td>
                <td>{r.location ? "Yes" : "No"}</td>
                {canEdit && (
                  <td>
                    <button type="button" className="link-button" onClick={() => startEdit(r)}>
                      Edit
                    </button>{" "}
                    <button type="button" className="link-button" onClick={() => remove(r)}>
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="empty">
                  No solar plants recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
