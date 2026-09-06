import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { linesApi } from "../api/network";
import { ApiError } from "../api/client";
import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../auth/AuthContext";
import { BulkExcel } from "../components/BulkExcel";
import type { LinePage } from "../types/network";

const PAGE_SIZE = 50;
const VOLT_CLASSES = ["400", "220", "132"];

export default function LineListPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "editor";

  const [q, setQ] = useState("");
  const [voltClass, setVoltClass] = useState("");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<LinePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPage(
        await linesApi.list({
          q: q || undefined,
          volt_class: voltClass || undefined,
          limit: PAGE_SIZE,
          offset,
        })
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load lines");
    } finally {
      setLoading(false);
    }
  }, [q, voltClass, offset]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const total = page?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);

  return (
    <AppLayout>
      <div className="page-head">
        <h1>Transmission lines</h1>
        {canEdit && (
          <Link className="button-link" to="/lines/new">
            Add line
          </Link>
        )}
      </div>

      <div className="filter-bar">
        <input
          placeholder="Search name, id, from or to"
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
          {loading ? "Loading…" : `${from}–${to} of ${total}`}
        </span>
      </div>

      <BulkExcel kind="lines" canEdit={canEdit} onImported={load} />

      {error && <p className="auth-error">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Feeder</th>
              <th>Name</th>
              <th>Voltage</th>
              <th>From</th>
              <th>To</th>
              <th className="num">Length (ckm)</th>
              <th className="num">Towers</th>
              <th>Zone</th>
              <th>Route</th>
            </tr>
          </thead>
          <tbody>
            {page?.items.map((l) => (
              <tr key={l.feeder_id}>
                <td>
                  <Link to={`/lines/${l.feeder_id}`}>{l.feeder_id}</Link>
                </td>
                <td className="truncate" title={l.feeder_name ?? ""}>
                  {l.feeder_name ?? "—"}
                </td>
                <td>{l.volt_class ?? "—"}</td>
                <td>{l.from_substation ?? "—"}</td>
                <td>{l.to_substation ?? "—"}</td>
                <td className="num">{l.length_ckm ?? "—"}</td>
                <td className="num">{l.tower_count ?? 0}</td>
                <td>{l.zone ?? "—"}</td>
                <td>{l.has_route ? "Drawn" : "—"}</td>
              </tr>
            ))}
            {!loading && page?.items.length === 0 && (
              <tr>
                <td colSpan={9} className="empty">
                  No lines match those filters.
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
