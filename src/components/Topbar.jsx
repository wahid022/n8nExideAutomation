import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Topbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const displayName = user?.email?.split("@")[0] || "User";
  const initials = displayName
    .split(/[._\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "U";

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError("");

    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
      setLogoutError("Logout failed. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="topbar no-print">
      <div className="topbar-brand">
        <span className="topbar-brand-mark" aria-hidden="true">BB</span>
        <span className="topbar-brand-copy">
          <span className="topbar-brand-kicker">BHARAT BATTERIES</span>
          <strong>Business Management Portal</strong>
        </span>
      </div>

      <div className="topbar-right">
        <div className="topbar-user" title={user?.email || "Signed-in user"}>
          <div className="avatar" aria-hidden="true">{initials}</div>
          <span className="topbar-user-copy">
            <span className="topbar-user-label">SIGNED IN AS</span>
            <strong>{displayName}</strong>
          </span>
        </div>
        <button
          type="button"
          className="topbar-logout"
          onClick={handleLogout}
          disabled={loggingOut}
          aria-label="Log out"
          title="Log out of your account"
        >
          <svg
            className="topbar-logout-icon"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path d="M8 3H4.75A1.75 1.75 0 0 0 3 4.75v10.5A1.75 1.75 0 0 0 4.75 17H8" />
            <path d="M11.5 6.5 15 10l-3.5 3.5M15 10H7" />
          </svg>
          <span>{loggingOut ? "Logging out..." : "Logout"}</span>
        </button>
      </div>

      {logoutError && <div className="topbar-logout-error" role="alert">{logoutError}</div>}
    </header>
  );
}
