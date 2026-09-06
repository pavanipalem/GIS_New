import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { linesApi } from "../api/network";
import { ApiError } from "../api/client";
import { AppLayout } from "../components/AppLayout";
import type { LineFields } from "../types/network";

const empty = (): LineFields => ({
  feeder_name: null, volt_class: null, from_substation: null, to_substation: null,
  total_no_of_locations: null, length_ckm: null, length_of_line: null,
  max_load_in_amp: null, circuit_type: null, conductor_type: null,
  earth_wire_type: null, date_of_charging_raw: null, last_maintenance_date_raw: null,
  jurisdiction: null, zone: null, circle: null, sap_fl_code: null, additional_info: null,
});

const str = (v: string) => (v.trim() === "" ? null : v.trim());

export default function LineEditPage() {
  const { feederId } = useParams<{ feederId: string }>();
  const isNew = feederId === undefined;
  const navigate = useNavigate();

  const [form, setForm] = useState<LineFields>(empty());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !feederId) return;
    linesApi
      .get(Number(feederId))
      .then((d) => setForm({ ...d }))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load line"))
      .finally(() => setLoading(false));
  }, [feederId, isNew]);

  const set = <K extends keyof LineFields>(k: K, v: LineFields[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const text = (k: keyof LineFields, label: string) => (
    <label>
      {label}
      <input
        value={(form[k] as string | null) ?? ""}
        onChange={(e) => set(k, str(e.target.value) as LineFields[typeof k])}
      />
    </label>
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (isNew) {
        const created = await linesApi.create(form);
        navigate(`/lines/${created.feeder_id}`);
      } else {
        await linesApi.update(Number(feederId), form);
        navigate(`/lines/${feederId}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <p className="page-loading">Loading…</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <form onSubmit={onSubmit}>
        <div className="page-head">
          <h1>{isNew ? "Add line" : `Edit ${form.feeder_name ?? feederId}`}</h1>
          <div className="page-head-actions">
            <button
              type="button"
              className="link-button"
              onClick={() => navigate(isNew ? "/lines" : `/lines/${feederId}`)}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <section className="card">
          <h2>Line</h2>
          {isNew && (
            <p className="hint">
              The feeder id is allocated automatically, as it was in the old system. From and To
              are required — the old procedure silently refused a line without them.
            </p>
          )}
          <div className="form-grid">
            {text("feeder_name", "Name")}
            {text("volt_class", "Voltage class")}
            <label>
              From{isNew && " *"}
              <input
                value={form.from_substation ?? ""}
                required={isNew}
                onChange={(e) => set("from_substation", str(e.target.value))}
              />
            </label>
            <label>
              To{isNew && " *"}
              <input
                value={form.to_substation ?? ""}
                required={isNew}
                onChange={(e) => set("to_substation", str(e.target.value))}
              />
            </label>
            {text("length_ckm", "Length (ckm)")}
            {text("length_of_line", "Length of line")}
            <label>
              Total locations
              <input
                value={form.total_no_of_locations ?? ""}
                inputMode="numeric"
                onChange={(e) =>
                  set(
                    "total_no_of_locations",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
              />
            </label>
            {text("circuit_type", "Circuit type")}
            {text("conductor_type", "Conductor type")}
            {text("earth_wire_type", "Earth wire / OPGW")}
            {text("max_load_in_amp", "Max load (A)")}
          </div>
        </section>

        <section className="card">
          <h2>Dates</h2>
          <p className="hint">
            Type these exactly as you would have in the old form. Values like
            “01.03.2017(Ckt I),15.06.2018(Ckt II)” are kept verbatim; a single unambiguous date
            is also stored in parsed form for sorting and filtering.
          </p>
          <div className="form-grid">
            {text("date_of_charging_raw", "Date of charging")}
            {text("last_maintenance_date_raw", "Last maintenance date")}
          </div>
        </section>

        <section className="card">
          <h2>Administration</h2>
          <div className="form-grid">
            {text("jurisdiction", "Jurisdiction")}
            {text("zone", "Zone")}
            {text("circle", "Circle")}
            {text("sap_fl_code", "SAP FL code")}
          </div>
          <label style={{ display: "block", marginTop: "0.85rem" }}>
            <span className="field-label">Additional info</span>
            <textarea
              value={form.additional_info ?? ""}
              rows={3}
              onChange={(e) => set("additional_info", str(e.target.value))}
            />
          </label>
        </section>

        <div className="form-footer">
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save line"}
          </button>
        </div>
      </form>
    </AppLayout>
  );
}
