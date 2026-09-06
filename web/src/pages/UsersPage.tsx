import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { usersApi } from "../api/users";
import { ApiError } from "../api/client";
import { AppLayout } from "../components/AppLayout";
import type { Role } from "../types/auth";
import type { UserOut } from "../types/user";

const ROLES: Role[] = ["admin", "editor", "viewer"];

const ROLE_HELP: Record<Role, string> = {
  admin: "Full access, including user management",
  editor: "Can create and update records",
  viewer: "Read-only",
};

export default function UsersPage() {
  const [rows, setRows] = useState<UserOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<Role>("viewer");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await usersApi.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load users");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const created = await usersApi.create({
        username: newUsername,
        full_name: newFullName || null,
        role: newRole,
      });
      setNotice(
        created.temp_password
          ? `Created ${created.username}. Temporary password: ${created.temp_password} — copy it now, it is not shown again.`
          : `Created ${created.username}.`
      );
      setAdding(false);
      setNewUsername("");
      setNewFullName("");
      setNewRole("viewer");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create user");
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (u: UserOut, role: Role) => {
    setError(null);
    setNotice(null);
    try {
      await usersApi.update(u.id, { role });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change role");
    }
  };

  const toggleActive = async (u: UserOut) => {
    setError(null);
    setNotice(null);
    try {
      await usersApi.update(u.id, { is_active: !u.is_active });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change status");
    }
  };

  const resetPassword = async (u: UserOut) => {
    if (!confirm(`Issue a new temporary password for ${u.username}?`)) return;
    setError(null);
    try {
      const { temp_password } = await usersApi.resetPassword(u.id);
      setNotice(
        `Temporary password for ${u.username}: ${temp_password} — copy it now, it is not shown again. They must change it at next sign-in.`
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset password");
    }
  };

  return (
    <AppLayout>
      <div className="page-head">
        <h1>Users</h1>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)}>
            Add user
          </button>
        )}
      </div>

      <p className="hint">
        Passwords from the old system were never migrated, so every account carried over needs a
        reset before it can sign in. Issue a temporary password here and the user is forced to
        set their own on first sign-in.
      </p>

      {error && <p className="auth-error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      {adding && (
        <form className="card" onSubmit={create}>
          <h2>New user</h2>
          <div className="form-grid">
            <label>
              Username
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
                maxLength={50}
                autoFocus
              />
            </label>
            <label>
              Full name
              <input value={newFullName} onChange={(e) => setNewFullName(e.target.value)} />
            </label>
            <label>
              Role
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r} — {ROLE_HELP[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint">
            A temporary password is generated and shown once after saving.
          </p>
          <div className="page-head-actions">
            <button type="button" className="link-button" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Full name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Password</th>
              <th>Last sign-in</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.full_name ?? "—"}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u, e.target.value as Role)}
                    aria-label={`Role for ${u.username}`}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{u.is_active ? "Active" : "Disabled"}</td>
                <td>{u.must_change_password ? "Reset required" : "Set"}</td>
                <td>
                  {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never"}
                </td>
                <td>
                  <button type="button" className="link-button" onClick={() => resetPassword(u)}>
                    Reset password
                  </button>{" "}
                  <button type="button" className="link-button" onClick={() => toggleActive(u)}>
                    {u.is_active ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
