
import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <div className="auth-loading">Checking session...</div>;
  }

  if (user) {
    return (
      <Navigate
        to={location.state?.from?.pathname || "/dashboard"}
        replace
      />
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-showcase" aria-label="Bharat Batteries">
        <div className="login-showcase-glow login-showcase-glow-one" />
        <div className="login-showcase-glow login-showcase-glow-two" />
        <div className="login-showcase-content">
          <div className="login-brand">
            <span className="login-brand-mark" aria-hidden="true">BB</span>
            <span className="login-brand-name">BHARAT <strong>BATTERIES</strong></span>
          </div>

          <div className="login-hero-copy">
            <span className="login-eyebrow"><span /> POWERING WHAT'S NEXT</span>
            <h1>Energy that<br />moves you forward.</h1>
            <p>Your business, products, and performance — all in one place.</p>
          </div>

          <div className="login-energy-art" aria-hidden="true">
            <div className="energy-orbit energy-orbit-one" />
            <div className="energy-orbit energy-orbit-two" />
            <div className="energy-core">
              <span className="energy-core-cap" />
              <span className="energy-bolt">ϟ</span>
              <span className="energy-level energy-level-one" />
              <span className="energy-level energy-level-two" />
              <span className="energy-level energy-level-three" />
            </div>
            <span className="energy-spark energy-spark-one">✦</span>
            <span className="energy-spark energy-spark-two">✧</span>
          </div>

          <p className="login-showcase-footer">Reliable power. Smarter business.</p>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-form-heading">
            <span className="login-form-kicker">WELCOME BACK</span>
            <h2>Sign in to your account</h2>
            <p>Enter your details to continue to your dashboard.</p>
          </div>

          <div className="login-fields">
            <label htmlFor="login-email">
              Email address
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label htmlFor="login-password">
              Password
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
          </div>

          {error && <p className="login-error" role="alert">{error}</p>}

          <button type="submit" disabled={submitting}>
            <span>{submitting ? "Signing in..." : "Sign in"}</span>
            {!submitting && <span className="login-button-arrow" aria-hidden="true">→</span>}
          </button>

          <p className="login-secure-note">
            <span aria-hidden="true">◆</span> Secure access to your business dashboard
          </p>
        </form>
        <p className="login-panel-footer">© {new Date().getFullYear()} Bharat Batteries</p>
      </section>
    </main>
  );
}
