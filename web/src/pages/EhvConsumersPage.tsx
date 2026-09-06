import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ehvApi } from "../api/assets";
import { ApiError } from "../api/client";
import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../auth/AuthContext";
import type { EhvConsumerFields, EhvConsumerOut } from "../types/assets";

const empty = (): EhvConsumerFields => ({
  name: null, location_desc: null, installed_capacity_mw: null,
  feeder_id: null, feeder_name: null, substation: null, consumer_code: null,
  voltage_rate: null, function_loc_code: null, connected_ss: null,
  line_name: null, line_code: null, division: null, circle: null, zone: null,
  location: null,
});

const str = (v: string) => (v.trim() === "" ? null : v.trim());

export default function EhvConsumersPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "editor";

  const [rows, setRows] = useState<EhvConsumerOut[]>([]);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<EhvConsumerFields>(empty());
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await ehvApi.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load EHV consumers");
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

  const startEdit = (r: EhvConsumerOut) => {
    setEditingId(r.ehv_id);
    setForm({ ...r });
    setLat(r.location ? String(r.location.lat) : "");
    setLng(r.location ? String(r.location.lng) : "");
  };

  const set = <K extends keyof EhvConsumerFields>(k: K, v: EhvConsumerFields[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const text = (k: keyof EhvConsumerFields, label: string) => (
    <label>
      {label}
      <input
        value={(form[k] as string | null) ?? ""}
        onChange={(e) => set(k, str(e.target.value) as EhvConsumerFields[typeof k])}
      />
    </label>
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload: EhvConsumerFields = {
      ...form,
      location:
        lat.trim() !== "" && lng.trim() !== "" ? { lat: Number(lat), lng: Number(lng) } : null,
    };
    try {
      if (editingId === "new") await ehvApi.create(payload);
      else if (editingId !== null) await ehvApi.update(editingId, payload);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: EhvConsumerOut) => {
    if (!confirm(`Delete ${r.name ?? `consumer ${r.ehv_id}`}?`)) return;
    try {
      await ehvApi.remove(r.ehv_id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete");
    }
  };

  const needle = q.trim().toLowerCase();
  const visible = needle
    ? rows.filter((r) =>
        [r.name, r.substation, r.feeder_name, r.consumer_code]
          .some((v) => v?.toLowerCase().includes(needle))
      )
    : rows;

  return (
    <AppLayout>
      <div className="page-head">
        <h1>EHV consumers</h1>
        {canEdit && editingId === null && (
          <button type="button" onClick={startNew}>
            Add consumer
          </button>
        )}
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="filter-bar">
        <input
          placeholder="Search name, substation, feeder or code"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="filter-count">
          {visible.length} of {rows.length}
        </span>
      </div>

      {editingId !== null && (
        <form className="card" onSubmit={onSubmit}>
          <h2>{editingId === "new" ? "New EHV consumer" : `Edit consumer ${editingId}`}</h2>
          <div className="form-grid">
            {text("name", "Name")}
            {text("location_desc", "Location")}
            {text("installed_capacity_mw", "Installed capacity (MW)")}
            {text("substation", "Substation")}
            <label>
              Feeder id
              <input
                value={form.feeder_id ?? ""}
                inputMode="numeric"
                onChange={(e) =>
                  set("feeder_id", e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </label>
            {text("feeder_name", "Feeder name")}
            {text("consumer_code", "Consumer code")}
            {text("voltage_rate", "Voltage rate")}
            {text("function_loc_code", "Function location code")}
            {text("connected_ss", "Connected substation")}
            {text("line_name", "Line name")}
            {text("line_code", "Line code")}
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
              <th>Name</th>
              <th className="num">Capacity (MW)</th>
              <th>Substation</th>
              <th className="num">Feeder</th>
              <th>Consumer code</th>
              <th>Zone</th>
              <th>Located</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.ehv_id}>
                <td>{r.ehv_id}</td>
                <td className="truncate" title={r.name ?? ""}>
                  {r.name ?? "—"}
                </td>
                <td className="num">{r.installed_capacity_mw ?? "—"}</td>
                <td className="truncate" title={r.substation ?? ""}>
                  {r.substation ?? "—"}
                </td>
                <td className="num">{r.feeder_id ?? "—"}</td>
                <td>{r.consumer_code ?? "—"}</td>
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
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="empty">
                  No EHV consumers match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
