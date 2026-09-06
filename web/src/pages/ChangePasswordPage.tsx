import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { changePassword } from "../api/auth";
import { ApiError } from "../api/client";

// Every legacy-imported user lands here first: their plaintext password was
// never migrated, so they get an unusable hash and must set a real one
// before touching the app. See UNUSABLE_PASSWORD_HASH in the backend.
export default function ChangePasswordPage() {
  const { user, loading, refreshUser, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && !user) return <Navigate to="/login" replace />;
  if (!loading && user && !user.must_change_password) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("New passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(current, next);
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Set a new password</h1>
        <p>Your account needs a password reset before you can continue.</p>
        <label>
          Current / temporary password
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoFocus
            required
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={8}
            maxLength={72}
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            maxLength={72}
            required
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Set password"}
        </button>
        <button type="button" className="link-button" onClick={logout}>
          Sign out
        </button>
      </form>
    </div>
  );
}
