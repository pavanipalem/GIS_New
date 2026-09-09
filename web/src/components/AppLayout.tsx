import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { GisHeader } from "./GisHeader";

const NAV_ITEMS = [
  { to: "/", label: "Home", end: true },
  { to: "/map", label: "Map" },
  { to: "/substations", label: "Substations" },
  { to: "/lines", label: "Lines" },
  { to: "/fault-mapping", label: "Fault mapping" },
  { to: "/proposals", label: "Proposals" },
  { to: "/solar-plants", label: "Solar" },
  { to: "/ehv-consumers", label: "EHV" },
];

/** Institutional header, then a lean section bar, then the page.
 *
 * `fullBleed` is for the map, which manages its own scrolling and needs the
 * remaining height exactly; everything else gets a normal padded, scrollable
 * page. The section bar is one compact scrollable row so it never wraps to a
 * second line and eats map height. Users is admin-only and sits after a
 * divider because it administers the app rather than the network data. */
export function AppLayout({
  children,
  fullBleed = false,
}: {
  children: ReactNode;
  fullBleed?: boolean;
}) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <GisHeader />

      <nav className="app-nav-bar" aria-label="Sections">
        <div className="app-nav-links">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="app-nav-link">
              {item.label}
            </NavLink>
          ))}
          {user?.role === "admin" && (
            <>
              <span className="app-nav-divider" aria-hidden="true" />
              <NavLink to="/users" className="app-nav-link">
                Users
              </NavLink>
            </>
          )}
        </div>

        <div className="app-nav-user">
          <span className="app-user">
            <span className="app-user-name">{user?.username}</span>
            {user?.role && (
              <span className={`app-role app-role-${user.role}`}>{user.role}</span>
            )}
          </span>
          <button type="button" className="app-signout" onClick={logout}>
            Sign out
          </button>
        </div>
      </nav>

      <main className={fullBleed ? "app-main-full" : "app-main"}>{children}</main>
    </div>
  );
}
