import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { towersApi } from "../api/network";
import { ApiError } from "../api/client";
import { AppLayout } from "../components/AppLayout";
import type { TowerFields } from "../types/network";

const empty = (): TowerFields => ({
  location_no: null, seq_no: null, tower_type: null, tower_extension: null,
  circuit_type: null, make: null, towers_utilized: null,
  soil_strata: null, foundation_class: null,
  disc_70kn: null, disc_120kn: null, disc_160kn: null,
  src_70kn: null, src_120kn: null, src_160kn: null,
  earthing_type: null, earth_wire_type: null, telecom_joint_box: null,
  landmark: null, additional_info: null,
  volt_class: null, zone: null, circle: null, sap_id: null, rrsc_line_code: null,
  location: null,
});

const str = (v: string) => (v.trim() === "" ? null : v.trim());
const num = (v: string) => (v.trim() === "" ? null : Number(v));

export default function TowerEditPage() {
  // /lines/:feederId/towers/new  or  /towers/:towerId/edit
  const { feederId, towerId } = useParams<{ feederId?: string; towerId?: string }>();
  const isNew = towerId === undefined;
  const navigate = useNavigate();

  const [form, setForm] = useState<TowerFields>(empty());
  const [feeder, setFeeder] = useState<number | null>(feederId ? Number(feederId) : null);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !towerId) return;
    towersApi
      .get(Number(towerId))
      .then((t) => {
        setForm({ ...t });
        setFeeder(t.feeder_id);
        setLat(t.location ? String(t.location.lat) : "");
        setLng(t.location ? String(t.location.lng) : "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load tower"))
      .finally(() => setLoading(false));
  }, [towerId, isNew]);

  const set = <K extends keyof TowerFields>(k: K, v: TowerFields[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const text = (k: keyof TowerFields, label: string) => (
    <label>
      {label}
      <input
        value={(form[k] as string | null) ?? ""}
        onChange={(e) => set(k, str(e.target.value) as TowerFields[typeof k])}
      />
    </label>
  );

  const count = (k: keyof TowerFields, label: string) => (
    <label>
      {label}
      <input
        value={(form[k] as number | null) ?? ""}
        inputMode="numeric"
        onChange={(e) => set(k, num(e.target.value) as TowerFields[typeof k])}
      />
    </label>
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: TowerFields = {
      ...form,
      location:
        lat.trim() !== "" && lng.trim() !== ""
          ? { lat: Number(lat), lng: Number(lng) }
          : null,
    };
    setSaving(true);
    try {
      if (isNew) {
        if (feeder === null) throw new ApiError(400, "No line selected for this tower");
        const created = await towersApi.create({ ...payload, feeder_id: feeder });
        navigate(`/lines/${created.feeder_id}`);
      } else {
        const updated = await towersApi.update(Number(towerId), payload);
        navigate(updated.feeder_id ? `/lines/${updated.feeder_id}` : "/lines");
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

  const back = feeder ? `/lines/${feeder}` : "/lines";

  return (
    <AppLayout>
      <form onSubmit={onSubmit}>
        <div className="page-head">
          <h1>{isNew ? "Add tower" : `Edit tower ${towerId}`}</h1>
          <div className="page-head-actions">
            <button type="button" className="link-button" onClick={() => navigate(back)}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <section className="card">
          <h2>Position</h2>
          <p className="hint">
            Sequence order is what draws the line on the map — not the location number, which can
            run the other way. Changing either the position or the sequence redraws the route.
          </p>
          <div className="form-grid">
            <label>
              Line (feeder id)
              <input
                value={feeder ?? ""}
                inputMode="numeric"
                onChange={(e) => setFeeder(e.target.value === "" ? null : Number(e.target.value))}
              />
            </label>
            <label>
              Sequence no
              <input
                value={form.seq_no ?? ""}
                inputMode="numeric"
                onChange={(e) => set("seq_no", num(e.target.value))}
              />
            </label>
            {text("location_no", "Location no")}
            <label>
              Latitude
              <input value={lat} inputMode="decimal" onChange={(e) => setLat(e.target.value)} />
            </label>
            <label>
              Longitude
              <input value={lng} inputMode="decimal" onChange={(e) => setLng(e.target.value)} />
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Structure</h2>
          <div className="form-grid">
            {text("tower_type", "Type of tower")}
            {text("tower_extension", "Tower extension")}
            {text("circuit_type", "Type of circuit")}
            {text("make", "Make of tower")}
            {text("towers_utilized", "Types of towers utilized")}
            {text("soil_strata", "Soil strata")}
            {text("foundation_class", "Classification of foundation")}
          </div>
        </section>

        <section className="card">
          <h2>Insulators</h2>
          <div className="form-grid">
            {count("disc_70kn", "70KN disc")}
            {count("disc_120kn", "120KN disc")}
            {count("disc_160kn", "160KN disc")}
            {count("src_70kn", "70KN SRC")}
            {count("src_120kn", "120KN SRC")}
            {count("src_160kn", "160KN SRC")}
          </div>
        </section>

        <section className="card">
          <h2>Earthing and telecom</h2>
          <div className="form-grid">
            {text("earthing_type", "Type of earthing")}
            {text("earth_wire_type", "Earth wire / OPGW")}
            {text("telecom_joint_box", "Telecom joint box")}
          </div>
          <p className="hint">
            A tower with a joint box is drawn yellow on the map, matching the old behaviour.
          </p>
        </section>

        <section className="card">
          <h2>Other</h2>
          <div className="form-grid">
            {text("volt_class", "Voltage class")}
            {text("zone", "Zone")}
            {text("circle", "Circle")}
            {text("rrsc_line_code", "RRSC line code")}
            <label>
              SAP id
              <input
                value={form.sap_id ?? ""}
                inputMode="numeric"
                onChange={(e) => set("sap_id", num(e.target.value))}
              />
            </label>
            {text("landmark", "Important landmark")}
          </div>
          <label style={{ display: "block", marginTop: "0.85rem" }}>
            <span className="field-label">Additional info</span>
            <textarea
              value={form.additional_info ?? ""}
              rows={2}
              onChange={(e) => set("additional_info", str(e.target.value))}
            />
          </label>
          <p className="hint">
            “UC” in additional info draws the tower orange, as the old map did.
          </p>
        </section>

        <div className="form-footer">
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save tower"}
          </button>
        </div>
      </form>
    </AppLayout>
  );
}
