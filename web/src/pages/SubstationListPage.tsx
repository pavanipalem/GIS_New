import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { substationsApi } from "../api/substations";
import { ApiError } from "../api/client";
import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../auth/AuthContext";
import type { SubstationPage } from "../types/substation";

const PAGE_SIZE = 50;
const VOLT_CLASSES = ["400", "220", "132"];

export default function SubstationListPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "editor";

  const [q, setQ] = useState("");
  const [voltClass, setVoltClass] = useState("");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<SubstationPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPage(
        await substationsApi.list({
          q: q || undefined,
          volt_class: voltClass || undefined,
          limit: PAGE_SIZE,
          offset,
        })
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load substations");
    } finally {
      setLoading(false);
    }
  }, [q, voltClass, offset]);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const total = page?.total ?? 0;
  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE_SIZE, total);

  return (
    <AppLayout>
      <div className="page-head">
        <h1>Substations</h1>
        {canEdit && (
          <Link className="button-link" to="/substations/new">
            Add substation
          </Link>
        )}
      </div>

      <div className="filter-bar">
        <input
          placeholder="Search name, code or district"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
        <select
          value={voltClass}
          onChange={(e) => {
            setVoltClass(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">All voltages</option>
          {VOLT_CLASSES.map((v) => (
            <option key={v} value={v}>
              {v} kV
            </option>
          ))}
        </select>
        <span className="filter-count">
          {loading ? "Loading…" : `${showingFrom}–${showingTo} of ${total}`}
        </span>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Voltage</th>
              <th>Levels</th>
              <th>District</th>
              <th>Zone</th>
              <th>Circle</th>
              <th className="num">MVA</th>
              <th className="num">PTRs</th>
              <th>Located</th>
            </tr>
          </thead>
          <tbody>
            {page?.items.map((s) => (
              <tr key={s.ss_code}>
                <td>
                  <Link to={`/substations/${s.ss_code}`}>{s.ss_code}</Link>
                </td>
                <td>{s.ss_name ?? "—"}</td>
                <td>{s.ss_type ?? "—"}</td>
                <td>{s.volt_class ?? "—"}</td>
                <td>{s.volt_levels ?? "—"}</td>
                <td className="truncate" title={s.district ?? ""}>
                  {s.district ?? "—"}
                </td>
                <td>{s.zone ?? "—"}</td>
                <td>{s.circle ?? "—"}</td>
                <td className="num">{s.primary_mva_cap ?? "—"}</td>
                <td className="num">{s.transformer_count}</td>
                <td>{s.has_location ? "Yes" : "No"}</td>
              </tr>
            ))}
            {!loading && page?.items.length === 0 && (
              <tr>
                <td colSpan={11} className="empty">
                  No substations match those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <button
          type="button"
          disabled={offset === 0 || loading}
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
        >
          Previous
        </button>
        <button
          type="button"
          disabled={offset + PAGE_SIZE >= total || loading}
          onClick={() => setOffset(offset + PAGE_SIZE)}
        >
          Next
        </button>
      </div>
    </AppLayout>
  );
}
