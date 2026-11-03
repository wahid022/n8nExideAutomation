import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { supabase } from "../lib/supabase";
import "./Sales.css";

const API_BASE = (
  import.meta.env.VITE_PRODUCTS_API_URL ||
  "http://127.0.0.1:3001/api/products"
).replace(/\/products\/?$/, "");const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));

async function api(path) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

export default function SalesDashboard({ activePage = "Sales Dashboard" }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setSummary(await api("/sales/summary")); }
    catch (e) { setError(e.message || "Unable to load sales analytics."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="sales-page-shell">
      <Sidebar activePage={activePage} />
      <main className="sales-main">
        <Topbar activePage={activePage} />
        <div className="sales-content">
          <div className="sales-heading"><div><span className="sales-eyebrow">BUSINESS MANAGEMENT</span><h1>Sales Dashboard</h1><p>Sales performance, revenue, collections and outstanding balance overview.</p></div></div>
          {error && <div className="sales-error">{error}</div>}
          {loading && <p>Loading sales analytics...</p>}
          <section className="sales-stats">
            <article><span>Sales orders</span><strong>{summary?.orders?.count ?? "—"}</strong><small>{money(summary?.orders?.value)} order value</small></article>
            <article><span>Invoices</span><strong>{summary?.invoices?.count ?? "—"}</strong><small>{money(summary?.invoices?.value)} invoice value</small></article>
            <article><span>Payments received</span><strong>{money(summary?.payments?.received)}</strong><small>Recorded receipts</small></article>
            <article><span>Outstanding</span><strong>{money(summary?.invoices?.outstanding)}</strong><small>Invoices less received payments</small></article>
          </section>
        </div>
      </main>
    </div>
  );
}
