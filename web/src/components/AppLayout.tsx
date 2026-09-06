import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/** Top bar plus content. `fullBleed` is for the map, which manages its own
 * scrolling and needs the remaining height exactly; everything else gets a
 * normal padded, scrollable page. */
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
        <span className="app-brand">TGTransco GIS</span>
        <nav className="app-nav">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/map">Map</NavLink>
          <NavLink to="/substations">Substations</NavLink>
          <NavLink to="/lines">Lines</NavLink>
          <NavLink to="/solar-plants">Solar</NavLink>
          <NavLink to="/ehv-consumers">EHV</NavLink>
          {user?.role === "admin" && <NavLink to="/users">Users</NavLink>}
        </nav>
        <span className="app-user">
          {user?.username} ({user?.role})
        </span>
        <button type="button" className="link-button" onClick={logout}>
          Sign out
        </button>
      </header>
      <main className={fullBleed ? "app-main-full" : "app-main"}>{children}</main>
    </div>
  );
}
