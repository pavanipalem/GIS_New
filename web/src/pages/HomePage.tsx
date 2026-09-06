import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { mapApi } from "../api/map";
import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../auth/AuthContext";
import type { CountByCategory } from "../types/map";

/** Replaces Default.aspx - the landing page after sign-in. Shows the
 * substation counts by voltage class that GetMapData flag 8 returned, and
 * links into each section. */
export default function HomePage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<CountByCategory[] | null>(null);

  useEffect(() => {
    mapApi.substationsSummary().then(setSummary).catch(() => setSummary([]));
  }, []);

  const total = summary?.reduce((n, s) => n + s.count, 0) ?? null;

  return (
    <AppLayout>
      <div className="page-head">
        <div>
          <h1>TGTransco GIS</h1>
          <p className="page-head-meta">
            Signed in as {user?.username} ({user?.role})
          </p>
        </div>
      </div>

      <section className="card">
        <h2>Substations by voltage class</h2>
        {summary === null ? (
          <p className="page-loading">Loading…</p>
        ) : (
          <div className="metric-row">
            {summary.map((s) => (
              <div className="metric" key={s.category}>
                <span className="metric-label">{s.category} kV</span>
                <span className="metric-value">{s.count}</span>
              </div>
            ))}
            <div className="metric">
              <span className="metric-label">Total</span>
              <span className="metric-value">{total}</span>
            </div>
          </div>
        )}
        <p className="hint">
          Counts exclude the LIS, LI and WW types, matching the old map's substation totals.
        </p>
      </section>

      <section className="card">
        <h2>Go to</h2>
        <div className="home-links">
          <Link className="button-link" to="/map">
            Map
          </Link>
          <Link className="button-link" to="/substations">
            Substations
          </Link>
          <Link className="button-link" to="/lines">
            Lines
          </Link>
          <Link className="button-link" to="/solar-plants">
            Solar plants
          </Link>
          <Link className="button-link" to="/ehv-consumers">
            EHV consumers
          </Link>
          {user?.role === "admin" && (
            <Link className="button-link" to="/users">
              Users
            </Link>
          )}
        </div>
      </section>
    </AppLayout>
  );
}
