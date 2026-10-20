
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LogoutButton() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setLoggingOut(true);
    setError("");

    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to log out. Please try again.");
      setLoggingOut(false);
    }
  }

  return (
    <div className="logout-container">
      <button
        type="button"
        className="logout-button"
        onClick={handleLogout}
        disabled={loggingOut}
        title="Log out of your account"
      >
        {loggingOut ? "Logging out..." : "Logout"}
      </button>

      {error && (
        <span className="logout-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
