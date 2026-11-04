import { useEffect, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { supabase } from "../lib/supabase";
import "./Purchase.css";
import "./Sales.css";

const API_BASE = (import.meta.env.VITE_PRODUCTS_API_URL || "http://127.0.0.1:3001/api/products").replace(/\/products\/?$/, "");

const EMPTY = { businessName: "", contactName: "", phone: "", gstin: "", billingAddress: "", state: "Jharkhand", vendorType: "Supplier" };

async function api(path, options = {}) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, ...(options.headers || {}) },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

const AVATAR_PALETTE = ["#059669","#0EA5E9","#8B5CF6","#F59E0B","#EF4444","#EC4899","#06B6D4","#4F46E5"];
const avatarColor = (name) => AVATAR_PALETTE[(name || "?").charCodeAt(0) % AVATAR_PALETTE.length];

const vendorTypeBadge = (type) => {
  const map = {
    Manufacturer: { bg: "#EEF2FF", color: "#4338CA" },
    Distributor:  { bg: "#F0FDF4", color: "#15803D" },
    Supplier:     { bg: "#F0FDFA", color: "#0D9488" },
    Other:        { bg: "#FEF3C7", color: "#D97706" },
  };
  const s = map[type] || map.Other;
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>{type || "Supplier"}</span>;
};

export default function Vendors({ activePage = "Vendor List" }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: vendorsRaw, isLoading: loading } = useQuery({
    queryKey: ["vendors", debouncedSearch],
    queryFn: () => api(`/vendors?search=${encodeURIComponent(debouncedSearch)}`),
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });
  const vendors = vendorsRaw?.data || [];

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const openAdd = () => { setEditingId(null); setForm(EMPTY); setError(""); setModalOpen(true); };
  const openEdit = (v) => {
    setEditingId(v.id);
    setForm({ businessName: v.businessName || "", contactName: v.contactName || "", phone: v.phone || "", gstin: v.gstin || "", billingAddress: v.billingAddress || "", state: v.state || "Jharkhand", vendorType: v.vendorType || "Supplier" });
    setError(""); setModalOpen(true);
  };

  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const result = await api(
        editingId ? `/vendors/${encodeURIComponent(editingId)}` : "/vendors",
        { method: editingId ? "PATCH" : "POST", body: JSON.stringify(form) },
      );
      setNotice(editingId ? "Vendor updated successfully." : "Vendor created successfully.");
      setModalOpen(false); setForm(EMPTY); setEditingId(null);
      qc.invalidateQueries({ queryKey: ["vendors"] });
      if (!editingId && result.vendor) setSearch(result.vendor.businessName || result.vendor.phone || "");
    } catch (e) { setError(e.message || "Unable to save vendor."); }
    finally { setSaving(false); }
  };

  const manufacturers = vendors.filter((v) => v.vendorType === "Manufacturer").length;
  const distributors  = vendors.filter((v) => v.vendorType === "Distributor").length;
  const suppliers     = vendors.filter((v) => (v.vendorType || "Supplier") === "Supplier").length;

  return (
    <div className="purchase-page-shell">
      <Sidebar activePage={activePage} />
      <main className="purchase-main">
        <Topbar activePage={activePage} />
        <div className="purchase-content">

          {/* Header */}
          <div className="purchase-heading">
            <div>
              <span className="purchase-eyebrow">VENDOR DIRECTORY</span>
              <h1>Vendor List</h1>
              <p>Manage suppliers, manufacturers and distributors.</p>
            </div>
            <button className="purchase-primary" onClick={openAdd}>+ Add vendor</button>
          </div>

          {/* KPI stats */}
          <div className="pur-stats">
            <div className="pur-stat pur-stat--total">
              <span className="pur-stat-label">TOTAL VENDORS</span>
              <strong className="pur-stat-value">{loading ? "—" : vendors.length}</strong>
            </div>
            <div className="pur-stat pur-stat--orders">
              <span className="pur-stat-label">MANUFACTURERS</span>
              <strong className="pur-stat-value">{loading ? "—" : manufacturers}</strong>
            </div>
            <div className="pur-stat pur-stat--invoices">
              <span className="pur-stat-label">DISTRIBUTORS</span>
              <strong className="pur-stat-value">{loading ? "—" : distributors}</strong>
            </div>
            <div className="pur-stat pur-stat--vendors">
              <span className="pur-stat-label">SUPPLIERS</span>
              <strong className="pur-stat-value">{loading ? "—" : suppliers}</strong>
            </div>
          </div>

          {notice && <div className="purchase-notice">{notice}</div>}
          {error && !modalOpen && <div className="purchase-error">{error}</div>}

          <section className="purchase-card">
            <div className="purchase-toolbar">
              <div style={{ color: "#0F172A", fontSize: 14, fontWeight: 700 }}>
                All vendors
                <span style={{ marginLeft: 8, fontSize: 11, color: "#78869b", background: "#f2f5fa", padding: "3px 8px", borderRadius: 20, fontWeight: 600 }}>{vendors.length} shown</span>
              </div>
              <div className="pur-search-wrap">
                <svg className="pur-search-icon" viewBox="0 0 16 16" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="6.5" cy="6.5" r="4" stroke="currentColor"/><path d="M11 11l2.5 2.5" stroke="currentColor"/></svg>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search business, contact, phone or GSTIN…" />
              </div>
            </div>

            <div className="purchase-table-wrap">
              <table className="purchase-table">
                <thead>
                  <tr><th>Business</th><th>Contact</th><th>Phone</th><th>GSTIN</th><th>Address</th><th>Type</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan="7" className="purchase-empty">Loading vendors…</td></tr>}
                  {!loading && vendors.length === 0 && <tr><td colSpan="7" className="purchase-empty">No vendors found. Add a vendor to get started.</td></tr>}
                  {!loading && vendors.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <div className="pur-vendor-cell">
                          <span className="pur-avatar" style={{ background: avatarColor(v.businessName) }}>
                            {(v.businessName || "?")[0].toUpperCase()}
                          </span>
                          <div>
                            <strong style={{ display: "block", color: "#0F172A" }}>{v.businessName}</strong>
                            <small style={{ display: "block", color: "#94A3B8", fontSize: 10, marginTop: 2 }}>{v.state || "State not set"}</small>
                          </div>
                        </div>
                      </td>
                      <td>{v.contactName}</td>
                      <td>{v.phone}</td>
                      <td>{v.gstin || "—"}</td>
                      <td style={{ maxWidth: 220, fontSize: 12 }}>{v.billingAddress || "—"}</td>
                      <td>{vendorTypeBadge(v.vendorType)}</td>
                      <td>
                        <button className="si-action-btn si-action-btn--edit" onClick={() => openEdit(v)}>
                          <svg viewBox="0 0 14 14" fill="none" width="12" height="12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5l2 2-6 6H3.5v-2l6-6z" stroke="currentColor"/><path d="M8 4l2 2" stroke="currentColor"/></svg>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {modalOpen && (
        <div className="purchase-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <section className="purchase-modal" role="dialog" aria-modal="true">
            <header>
              <div>
                <h2>{editingId ? "Edit vendor" : "Add new vendor"}</h2>
                <p>Vendor information is saved to your database.</p>
              </div>
              <button type="button" className="purchase-close" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
            </header>
            {error && <div className="purchase-error">{error}</div>}
            <form onSubmit={save} className="purchase-form">
              <label>Business name *<input required maxLength="200" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></label>
              <label>Contact name *<input required maxLength="200" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
              <label>Phone number *<input required maxLength="40" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              <label>GSTIN<input maxLength="15" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></label>
              <label className="purchase-form-wide">Billing address<textarea rows="3" maxLength="1000" value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} /></label>
              <label>State<input maxLength="100" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></label>
              <label>Vendor type<select value={form.vendorType} onChange={(e) => setForm({ ...form, vendorType: e.target.value })}><option>Supplier</option><option>Manufacturer</option><option>Distributor</option><option>Other</option></select></label>
              <footer className="purchase-form-actions">
                <button type="button" className="purchase-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button className="purchase-primary" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Save vendor"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
