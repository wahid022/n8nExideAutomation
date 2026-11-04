import { useEffect, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { supabase } from "../lib/supabase";
import "./Purchase.css";
import "./Sales.css";

const API_BASE = (import.meta.env.VITE_PRODUCTS_API_URL || "http://127.0.0.1:3001/api/products").replace(/\/products\/?$/, "");

const today = () => new Date().toISOString().slice(0, 10);
const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(n || 0));

async function api(path, options = {}) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Session expired. Please sign in again.");
  const r = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, ...(options.headers || {}) },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `Request failed (${r.status}).`);
  return body;
}

const AVATAR_COLORS = ["#059669","#0EA5E9","#8B5CF6","#F59E0B","#EF4444","#EC4899","#06B6D4","#4F46E5"];
const avatarColor = (name) => AVATAR_COLORS[(name || "?").charCodeAt(0) % AVATAR_COLORS.length];
const fmtDate = (v) => v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function badgeClass(status) {
  const s = String(status || "").toLowerCase().replace(/ /g, "-");
  return `pur-badge pur-badge--${s}`;
}

function DebitNoteModal({ dn, onClose, autoPrint = false }) {
  useEffect(() => {
    if (autoPrint && dn) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [autoPrint, dn]);

  if (!dn) return null;
  const vendor = dn.vendor || {};

  const statusColors = {
    Draft:   { bg: "#fef9c3", color: "#854d0e" },
    Issued:  { bg: "#dbeafe", color: "#1e40af" },
    Applied: { bg: "#dcfce7", color: "#166534" },
    Void:    { bg: "#fee2e2", color: "#991b1b" },
  };
  const badge = statusColors[dn.status] || { bg: "#f1f5f9", color: "#475569" };

  return (
    <div className="sales-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="sales-modal" style={{ maxWidth: 640, width: "100%" }} role="dialog" aria-modal="true" aria-label="Debit Note Preview">

        <header style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 14, marginBottom: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17 }}>Debit Note Preview</h2>
            <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: 13 }}>{dn.debitNoteNumber}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="sales-secondary" onClick={() => window.print()}>Print</button>
            <button type="button" className="sales-close" onClick={onClose} aria-label="Close">×</button>
          </div>
        </header>

        <div className="sales-print-document" style={{ padding: "24px 28px" }}>
          {/* Company header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 20, color: "#172033", letterSpacing: "-0.3px" }}>Bharat Batteries</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Your Trusted Partner in Power Solutions</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "inline-block", padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: badge.bg, color: badge.color, marginBottom: 6 }}>{dn.status || "Draft"}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#ef4444" }}>DEBIT NOTE</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{dn.debitNoteNumber}</div>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1.5px solid #e2e8f0", margin: "0 0 20px" }} />

          {/* Meta grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Issued To Vendor</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#172033" }}>{vendor.businessName || "—"}</div>
              {vendor.contactName && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{vendor.contactName}</div>}
              {vendor.phone && <div style={{ fontSize: 12, color: "#64748b" }}>{vendor.phone}</div>}
              {vendor.gstin && <div style={{ fontSize: 12, color: "#64748b" }}>GSTIN: {vendor.gstin}</div>}
              {vendor.billingAddress && <div style={{ fontSize: 12, color: "#64748b" }}>{vendor.billingAddress}{vendor.state ? `, ${vendor.state}` : ""}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Debit Date</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#172033" }}>{fmtDate(dn.debitDate)}</div>
              {dn.invoiceId && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginTop: 10, marginBottom: 4 }}>Against Invoice</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>#{dn.invoiceId}</div>
                </>
              )}
            </div>
          </div>

          {/* Debit amount */}
          <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: ".06em" }}>Debit Amount</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#991b1b", marginTop: 2 }}>{money(dn.amount)}</div>
            </div>
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>

          {/* Reason */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Reason for Debit</div>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 13.5, color: "#334155", lineHeight: 1.5 }}>
              {dn.reason || "No reason specified."}
            </div>
          </div>

          {/* Signatures */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
            <div style={{ textAlign: "center", width: "40%" }}>
              <div style={{ borderTop: "1px solid #cbd5e1", paddingTop: 8, fontSize: 11, color: "#64748b" }}>Vendor Acknowledgement</div>
            </div>
            <div style={{ textAlign: "center", width: "40%" }}>
              <div style={{ borderTop: "1px solid #cbd5e1", paddingTop: 8, fontSize: 11, color: "#64748b" }}>For BHARAT BATTERIES<br />Authorised Signatory</div>
            </div>
          </div>

          <div style={{ marginTop: 20, fontSize: 10, color: "#94a3b8", textAlign: "center", borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
            This is a computer-generated debit note. Subject to jurisdiction of local courts.
          </div>
        </div>
      </section>
    </div>
  );
}

export default function PurchaseOperations({ activePage = "Debit Notes" }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const { data: vendorsRaw } = useQuery({ queryKey: ["vendors"], queryFn: () => api("/vendors"), staleTime: 60_000 });
  const { data: rowsRaw, isLoading: loading } = useQuery({
    queryKey: ["purchase-debit-notes", debouncedSearch],
    queryFn: () => api(`/purchase/debit-notes${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ""}`),
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });

  const vendors = vendorsRaw?.data || [];
  const rows    = rowsRaw?.data    || [];
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({});
  const [viewDn, setViewDn] = useState(null);
  const [autoPrintDn, setAutoPrintDn] = useState(false);


  const open = () => {
    setEditingId(null); setError(""); setNotice("");
    setForm({
      debitNoteNumber: `DN-${Date.now().toString().slice(-8)}`,
      vendorId: vendors[0] ? String(vendors[0].id) : "",
      debitDate: today(),
      amount: "",
      reason: "",
      invoiceId: "",
    });
    setModal(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id); setError(""); setNotice("");
    setForm({
      debitNoteNumber: row.debitNoteNumber,
      vendorId: String(row.vendor?.id || row.vendorId || ""),
      debitDate: String(row.debitDate || "").slice(0, 10) || today(),
      amount: row.amount || "",
      reason: row.reason || "",
      invoiceId: row.invoiceId ? String(row.invoiceId) : "",
    });
    setModal(true);
  };

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const vendor = vendors.find((v) => String(v.id) === String(form.vendorId));
      if (!vendor) throw new Error("Choose a saved vendor.");
      const payload = {
        debitNoteNumber: form.debitNoteNumber,
        vendorId: vendor.id,
        vendor,
        debitDate: form.debitDate,
        amount: Number(form.amount),
        reason: form.reason,
        invoiceId: form.invoiceId || null,
      };
      const path = editingId ? `/purchase/debit-notes/${editingId}` : "/purchase/debit-notes";
      await api(path, { method: editingId ? "PUT" : "POST", body: JSON.stringify(payload) });
      setNotice(editingId ? "Debit Note updated." : "Debit Note saved.");
      setModal(false);
      qc.invalidateQueries({ queryKey: ["purchase-debit-notes"] });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const updateStatus = async (row, status) => {
    try {
      await api(`/purchase/debit-notes/${row.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      qc.invalidateQueries({ queryKey: ["purchase-debit-notes"] });
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="purchase-page-shell">
      <Sidebar activePage={activePage} />
      <main className="purchase-main">
        <Topbar activePage={activePage} />
        <div className="purchase-content">

          <div className="purchase-heading">
            <div>
              <span className="purchase-eyebrow">PURCHASE MODULE</span>
              <h1>Debit Notes</h1>
              <p>Issue debit notes to vendors for returns, shortages or price corrections.</p>
            </div>
            <button className="purchase-primary" onClick={open}>＋ New debit note</button>
          </div>

          {notice && <div className="purchase-notice">{notice}</div>}
          {error && !modal && <div className="purchase-error">{error}</div>}

          <section className="purchase-card">
            <div className="purchase-toolbar">
              <div style={{ color: "#0F172A", fontSize: 14, fontWeight: 700 }}>
                All debit notes
                <span style={{ marginLeft: 8, fontSize: 11, color: "#78869b", background: "#f2f5fa", padding: "3px 8px", borderRadius: 20, fontWeight: 600 }}>{rows.length} shown</span>
              </div>
              <div className="pur-search-wrap">
                <svg className="pur-search-icon" viewBox="0 0 16 16" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="6.5" cy="6.5" r="4" stroke="currentColor"/><path d="M11 11l2.5 2.5" stroke="currentColor"/></svg>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search debit notes…" />
              </div>
            </div>

            <div className="purchase-table-wrap">
              <table className="purchase-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Vendor</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan="7" className="purchase-empty">Loading…</td></tr>}
                  {!loading && rows.length === 0 && <tr><td colSpan="7" className="purchase-empty">No debit notes found. Create your first debit note.</td></tr>}
                  {!loading && rows.map((r) => {
                    const vendorName = r.vendor?.businessName || `Vendor #${r.vendorId || "—"}`;
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="pur-doc-num">
                            <svg className="pur-doc-icon" viewBox="0 0 16 16" fill="none" width="16" height="16" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="1.5" width="10" height="13" rx="1.5" stroke="currentColor"/><line x1="5" y1="5" x2="10.5" y2="5" stroke="currentColor" strokeWidth="1"/><line x1="5" y1="7.5" x2="10.5" y2="7.5" stroke="currentColor" strokeWidth="1"/><line x1="5" y1="10" x2="8" y2="10" stroke="currentColor" strokeWidth="1"/></svg>
                            <strong>{r.debitNoteNumber}</strong>
                          </div>
                        </td>
                        <td>
                          <div className="pur-vendor-cell">
                            <span className="pur-avatar" style={{ background: avatarColor(vendorName) }}>{vendorName.charAt(0).toUpperCase()}</span>
                            <span style={{ fontWeight: 600, color: "#0F172A", fontSize: 13 }}>{vendorName}</span>
                          </div>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.debitDate)}</td>
                        <td style={{ fontWeight: 700, color: "#059669" }}>{money(r.amount)}</td>
                        <td style={{ maxWidth: 220, fontSize: 12, color: "#64748B" }}>
                          {r.reason?.length > 55 ? r.reason.slice(0, 55) + "…" : r.reason}
                        </td>
                        <td><span className={badgeClass(r.status)}>{r.status || "Draft"}</span></td>
                        <td>
                          <div className="pur-action-group">
                            {!["Void"].includes(r.status) && (
                              <button className="si-action-btn si-action-btn--edit" onClick={() => openEdit(r)}>
                                <svg viewBox="0 0 14 14" fill="none" width="12" height="12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5l2 2-6 6H3.5v-2l6-6z" stroke="currentColor"/><path d="M8 4l2 2" stroke="currentColor"/></svg>
                                Edit
                              </button>
                            )}
                            {r.status === "Draft" && (
                              <button className="si-action-btn si-action-btn--preview" onClick={() => updateStatus(r, "Issued")}>
                                Issue
                              </button>
                            )}
                            <button className="si-action-btn si-action-btn--print" title="Print" onClick={() => { setAutoPrintDn(true); setViewDn(r); }}>
                              <svg viewBox="0 0 14 14" fill="none" width="12" height="12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="10" height="7" rx="1" stroke="currentColor"/><path d="M4 4V2h6v2" stroke="currentColor"/><rect x="4" y="8" width="6" height="2" rx=".5" stroke="currentColor" strokeWidth="1"/></svg>
                              Print
                            </button>
                            <button className="si-action-btn si-action-btn--preview" title="Preview" onClick={() => { setAutoPrintDn(false); setViewDn(r); }}>
                              <svg viewBox="0 0 14 14" fill="none" width="12" height="12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="7" cy="7" rx="5" ry="3.5" stroke="currentColor"/><circle cx="7" cy="7" r="1.5" stroke="currentColor"/></svg>
                              Preview
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {modal && (
        <div className="purchase-modal-backdrop">
          <section className="purchase-modal" role="dialog" aria-modal="true">
            <header>
              <div>
                <h2>{editingId ? "Edit" : "New"} Debit Note</h2>
                <p>Debit notes are issued to vendors for returns or adjustments.</p>
              </div>
              <button type="button" className="purchase-close" onClick={() => setModal(false)}>×</button>
            </header>

            {error && <div className="purchase-error">{error}</div>}

            <form className="purchase-form" onSubmit={save}>
              <label>
                Debit note number *
                <input required maxLength="80" value={form.debitNoteNumber || ""} onChange={(e) => setForm({ ...form, debitNoteNumber: e.target.value })} />
              </label>

              <label>
                Vendor *
                <select required value={form.vendorId || ""} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
                  <option value="">Select vendor</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.businessName} — {v.phone}</option>)}
                </select>
              </label>

              <label>
                Date *
                <input type="date" required value={form.debitDate || today()} onChange={(e) => setForm({ ...form, debitDate: e.target.value })} />
              </label>

              <label>
                Purchase Invoice ID (optional)
                <input type="number" min="1" value={form.invoiceId || ""} onChange={(e) => setForm({ ...form, invoiceId: e.target.value })} />
              </label>

              <label>
                Amount (₹) *
                <input type="number" min="0.01" step="0.01" required value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </label>

              <label className="purchase-form-wide">
                Reason *
                <input required maxLength="2000" value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Return, shortage, price difference…" />
              </label>

              <footer className="purchase-form-actions">
                <button type="button" className="purchase-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button className="purchase-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {viewDn && (
        <DebitNoteModal
          dn={viewDn}
          autoPrint={autoPrintDn}
          onClose={() => { setViewDn(null); setAutoPrintDn(false); }}
        />
      )}
    </div>
  );
}
