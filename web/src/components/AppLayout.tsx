import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Home", end: true },
  { to: "/map", label: "Map" },
  { to: "/substations", label: "Substations" },
  { to: "/lines", label: "Lines" },
  { to: "/solar-plants", label: "Solar" },
  { to: "/ehv-consumers", label: "EHV" },
];

/** Top bar plus content. `fullBleed` is for the map, which manages its own
 * scrolling and needs the remaining height exactly; everything else gets a
 * normal padded, scrollable page.
 *
 * The tabs are a single scrollable strip rather than a wrapping row: the
 * header is a fixed band above the map, so a second line of links would eat
 * map height at narrow widths. Users is admin-only and sits after a divider
 * because it administers the app rather than the network data. */
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
      <header className="app-header">
        <div className="app-brand">
          <span className="app-brand-mark" aria-hidden="true">
            TG
          </span>
          <span className="app-brand-name">TGTransco GIS</span>
        </div>

        <nav className="app-nav" aria-label="Main">
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
        </nav>

        <div className="app-header-right">
          <span className="app-user">
            <span className="app-user-name">{user?.username}</span>
            {user?.role && <span className={`app-role app-role-${user.role}`}>{user.role}</span>}
          </span>
          <button type="button" className="app-signout" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main className={fullBleed ? "app-main-full" : "app-main"}>{children}</main>
    </div>
  );
}
