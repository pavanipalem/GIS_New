import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { substationsApi } from "../api/substations";
import { ApiError } from "../api/client";
import { AppLayout } from "../components/AppLayout";
import { EQUIPMENT_KINDS } from "../types/substation";
import type {
  EquipmentIn,
  SubstationDetail,
  SubstationWrite,
  TransformerIn,
} from "../types/substation";
import type { MapPoint } from "../types/map";

const TRANSFORMER_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const BOUNDARY_SLOTS = Array.from({ length: 15 }, (_, i) => i + 1);

const YES_NO = ["", "Yes", "No"];

const emptyFields = (): SubstationWrite => ({
  ss_name: null, ss_type: null, volt_class: null, volt_levels: null,
  primary_mva_cap: null, no_of_ptrs: null,
  district: null, zone: null, circle: null, division: null, plant_circle: null,
  manned: null, generation: null, gen_type: null, scada: null, railway_tss: null,
  gis_type: null, ehv_consumer: null, rad_grid: null, dg_set: null,
  dg_and_ff_system: null, contact_no: null,
  function_loc_code: null, sap_erp_connectivity: null, rrsc_ss_code: null,
  ss_erp_source: null,
  ss_doc: null, link_sld: null, link_ss_photo: null, link_ss_layout: null,
  location: null, boundary: null, transformers: [], equipment: [],
});

/** One editable row per transformer slot, so the form matches the legacy
 * layout of nine fixed slots. Rows left entirely blank are dropped on save. */
interface SlotRow extends Omit<TransformerIn, "slot_no"> {
  slot_no: number;
}

const blankSlot = (slot_no: number): SlotRow => ({
  slot_no, capacity_mva: null, serial_no: null, make: null,
  vector_group: null, yoc_raw: null, po_reference: null, volt_level: null,
});

const slotIsEmpty = (r: SlotRow) =>
  !r.capacity_mva && !r.serial_no && !r.make && !r.vector_group && !r.yoc_raw &&
  !r.po_reference && !r.volt_level;

const blankEquipment = (): EquipmentIn => ({
  kind: "shunt_reactor", capacity_mva: null, serial_no: null, make: null,
  vector_group: null, yoc_raw: null, po_reference: null,
});

const str = (v: string) => (v.trim() === "" ? null : v.trim());

export default function SubstationEditPage() {
  const { ssCode } = useParams<{ ssCode: string }>();
  const isNew = ssCode === undefined;
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [form, setForm] = useState<SubstationWrite>(emptyFields());
  const [slots, setSlots] = useState<SlotRow[]>(TRANSFORMER_SLOTS.map(blankSlot));
  const [equipment, setEquipment] = useState<EquipmentIn[]>([]);
  const [boundary, setBoundary] = useState<{ lat: string; lng: string }[]>(
    BOUNDARY_SLOTS.map(() => ({ lat: "", lng: "" }))
  );
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !ssCode) return;
    substationsApi
      .get(Number(ssCode))
      .then((d: SubstationDetail) => {
        setForm({ ...d, transformers: [], equipment: [] } as SubstationWrite);
        setCode(String(d.ss_code));
        setSlots(
          TRANSFORMER_SLOTS.map((n) => {
            const found = d.transformers.find((t) => t.slot_no === n);
            return found ? { ...found, slot_no: n } : blankSlot(n);
          })
        );
        setEquipment(d.equipment.map((e) => ({ ...e })));
        setLat(d.location ? String(d.location.lat) : "");
        setLng(d.location ? String(d.location.lng) : "");
        setBoundary(
          BOUNDARY_SLOTS.map((_, i) => {
            const p = d.boundary?.[i];
            return p ? { lat: String(p.lat), lng: String(p.lng) } : { lat: "", lng: "" };
          })
        );
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load substation")
      )
      .finally(() => setLoading(false));
  }, [ssCode, isNew]);

  const setField = <K extends keyof SubstationWrite>(key: K, value: SubstationWrite[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const text = (key: keyof SubstationWrite, label: string) => (
    <label>
      {label}
      <input
        value={(form[key] as string | null) ?? ""}
        onChange={(e) => setField(key, str(e.target.value) as SubstationWrite[typeof key])}
      />
    </label>
  );

  const choice = (key: keyof SubstationWrite, label: string, options: string[]) => (
    <label>
      {label}
      <select
        value={(form[key] as string | null) ?? ""}
        onChange={(e) => setField(key, str(e.target.value) as SubstationWrite[typeof key])}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "" ? "—" : o}
          </option>
        ))}
      </select>
    </label>
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const points: MapPoint[] = boundary
      .filter((p) => p.lat.trim() !== "" && p.lng.trim() !== "")
      .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));

    const payload: SubstationWrite = {
      ...form,
      location:
        lat.trim() !== "" && lng.trim() !== ""
          ? { lat: Number(lat), lng: Number(lng) }
          : null,
      boundary: points.length ? points : null,
      transformers: slots.filter((s) => !slotIsEmpty(s)),
      equipment,
    };

    setSaving(true);
    try {
      if (isNew) {
        const created = await substationsApi.create({ ...payload, ss_code: Number(code) });
        navigate(`/substations/${created.ss_code}`);
      } else {
        await substationsApi.update(Number(ssCode), payload);
        navigate(`/substations/${ssCode}`);
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
          <h1>{isNew ? "Add substation" : `Edit ${form.ss_name ?? ssCode}`}</h1>
          <div className="page-head-actions">
            <button
              type="button"
              className="link-button"
              onClick={() => navigate(isNew ? "/substations" : `/substations/${ssCode}`)}
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
          <h2>Identity</h2>
          <div className="form-grid">
            <label>
              Substation code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={!isNew}
                required
                inputMode="numeric"
              />
            </label>
            {text("ss_name", "Name")}
            {text("ss_type", "Type")}
            {text("volt_class", "Voltage class")}
            {text("volt_levels", "Voltage levels")}
            {text("primary_mva_cap", "Primary MVA capacity")}
            <label>
              Number of PTRs
              <input
                value={form.no_of_ptrs ?? ""}
                inputMode="numeric"
                onChange={(e) =>
                  setField("no_of_ptrs", e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Administration</h2>
          <div className="form-grid">
            {text("district", "District")}
            {text("zone", "Zone")}
            {text("circle", "Circle")}
            {text("division", "Division")}
            {text("plant_circle", "Plant circle")}
            {text("contact_no", "Contact no")}
          </div>
        </section>

        <section className="card">
          <h2>Attributes</h2>
          <div className="form-grid">
            {text("manned", "Manned")}
            {choice("generation", "Generation", YES_NO)}
            {text("gen_type", "Generation type")}
            {text("scada", "SCADA")}
            {choice("railway_tss", "Railway TSS", YES_NO)}
            {text("gis_type", "GIS")}
            {text("ehv_consumer", "EHV consumer")}
            {text("rad_grid", "Radial / grid")}
            {text("dg_set", "DG set")}
            {text("dg_and_ff_system", "DG & FF system")}
          </div>
        </section>

        <section className="card">
          <h2>Codes and documents</h2>
          <div className="form-grid">
            {text("function_loc_code", "Function location code")}
            {text("sap_erp_connectivity", "SAP/ERP connectivity")}
            {text("rrsc_ss_code", "RRSC code")}
            {text("ss_erp_source", "ERP source")}
            {text("ss_doc", "Date of commissioning")}
            {text("link_sld", "SLD link")}
            {text("link_ss_photo", "Photo link")}
            {text("link_ss_layout", "Layout link")}
          </div>
        </section>

        <section className="card">
          <h2>Location</h2>
          <div className="form-grid">
            <label>
              Latitude
              <input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" />
            </label>
            <label>
              Longitude
              <input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" />
            </label>
          </div>
          <details className="collapsible">
            <summary>
              Boundary points ({boundary.filter((p) => p.lat && p.lng).length} of 15 set)
            </summary>
            <p className="hint">
              Nothing on the map draws substation boundaries today; these are kept because the
              legacy form captured them. Three or more distinct points are needed to store a
              polygon. Leaving latitude and longitude blank above uses boundary point 1 as the
              marker position, matching the old behaviour.
            </p>
            <div className="form-grid">
              {boundary.map((p, i) => (
                <div className="boundary-row" key={i}>
                  <span className="boundary-index">{i + 1}</span>
                  <input
                    placeholder="latitude"
                    value={p.lat}
                    inputMode="decimal"
                    onChange={(e) =>
                      setBoundary((b) =>
                        b.map((x, j) => (j === i ? { ...x, lat: e.target.value } : x))
                      )
                    }
                  />
                  <input
                    placeholder="longitude"
                    value={p.lng}
                    inputMode="decimal"
                    onChange={(e) =>
                      setBoundary((b) =>
                        b.map((x, j) => (j === i ? { ...x, lng: e.target.value } : x))
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </details>
        </section>

        <section className="card">
          <h2>Transformers</h2>
          <p className="hint">
            Year of commissioning accepts whatever the old form did — “28.12.2018”, “2019”,
            “not commissioned”. The server parses what it can and always keeps the original.
          </p>
          <div className="table-wrap">
            <table className="data-table editable">
              <thead>
                <tr>
                  <th className="num">Slot</th>
                  <th>Capacity (MVA)</th>
                  <th>Serial no</th>
                  <th>Make</th>
                  <th>Vector group</th>
                  <th>Volt level</th>
                  <th>Commissioned</th>
                  <th>PO reference</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((s, i) => {
                  const upd = (patch: Partial<SlotRow>) =>
                    setSlots((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
                  return (
                    <tr key={s.slot_no}>
                      <td className="num">{s.slot_no}</td>
                      <td>
                        <input
                          value={s.capacity_mva ?? ""}
                          inputMode="decimal"
                          onChange={(e) => upd({ capacity_mva: str(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          value={s.serial_no ?? ""}
                          onChange={(e) => upd({ serial_no: str(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          value={s.make ?? ""}
                          onChange={(e) => upd({ make: str(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          value={s.vector_group ?? ""}
                          onChange={(e) => upd({ vector_group: str(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          value={s.volt_level ?? ""}
                          onChange={(e) => upd({ volt_level: str(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          value={s.yoc_raw ?? ""}
                          onChange={(e) => upd({ yoc_raw: str(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          value={s.po_reference ?? ""}
                          onChange={(e) => upd({ po_reference: str(e.target.value) })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="page-head">
            <h2>Other equipment</h2>
            <button
              type="button"
              className="link-button"
              onClick={() => setEquipment((eq) => [...eq, blankEquipment()])}
            >
              Add equipment
            </button>
          </div>
          {equipment.length === 0 ? (
            <p className="empty">No shunt reactor, capacitor or station transformer recorded.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table editable">
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Capacity (MVA)</th>
                    <th>Serial no</th>
                    <th>Make</th>
                    <th>Vector group</th>
                    <th>Commissioned</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {equipment.map((eq, i) => {
                    const upd = (patch: Partial<EquipmentIn>) =>
                      setEquipment((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, ...patch } : r))
                      );
                    return (
                      <tr key={i}>
                        <td>
                          <select
                            value={eq.kind}
                            onChange={(e) =>
                              upd({ kind: e.target.value as EquipmentIn["kind"] })
                            }
                          >
                            {EQUIPMENT_KINDS.map((k) => (
                              <option key={k.value} value={k.value}>
                                {k.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            value={eq.capacity_mva ?? ""}
                            inputMode="decimal"
                            onChange={(e) => upd({ capacity_mva: str(e.target.value) })}
                          />
                        </td>
                        <td>
                          <input
                            value={eq.serial_no ?? ""}
                            onChange={(e) => upd({ serial_no: str(e.target.value) })}
                          />
                        </td>
                        <td>
                          <input
                            value={eq.make ?? ""}
                            onChange={(e) => upd({ make: str(e.target.value) })}
                          />
                        </td>
                        <td>
                          <input
                            value={eq.vector_group ?? ""}
                            onChange={(e) => upd({ vector_group: str(e.target.value) })}
                          />
                        </td>
                        <td>
                          <input
                            value={eq.yoc_raw ?? ""}
                            onChange={(e) => upd({ yoc_raw: str(e.target.value) })}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() =>
                              setEquipment((rows) => rows.filter((_, j) => j !== i))
                            }
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="form-footer">
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save substation"}
          </button>
        </div>
      </form>
    </AppLayout>
  );
}
