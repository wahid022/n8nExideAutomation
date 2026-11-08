import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { api } from "../lib/api";
import { QK } from "../lib/queryKeys";
import { useDebounce } from "../hooks/useDebounce";
import "./Expenses.css";
import "./Sales.css";

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtDate = (v) => v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const PAYMENT_MODES = ["Cash", "Bank", "UPI", "Card", "Cheque", "Other"];
const CAT_COLORS = ["#D97706","#2563EB","#7C3AED","#059669","#DC2626","#0EA5E9","#EC4899","#0D9488","#F59E0B","#6366F1"];

const EMPTY_FORM = { categoryId: "", amount: "", expenseDate: today(), paymentMode: "Cash", referenceNo: "", notes: "" };

export default function Expenses({ activePage = "Expenses" }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const debouncedSearch = useDebounce(search, 200);
  const [error, setError]           = useState("");
  const [notice, setNotice]         = useState("");
  const [modal, setModal]           = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [busy, setBusy]             = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);

  const { data: catsRaw, isLoading: catsLoading } = useQuery({
    queryKey: [QK.expenseCategories],
    queryFn: () => api("/expense-categories"),
    staleTime: 60_000,
  });

  const { data: expRaw, isLoading: expLoading } = useQuery({
    queryKey: [QK.expenses, debouncedSearch, typeFilter],
    queryFn: () => api(`/expenses?search=${encodeURIComponent(debouncedSearch)}&type=${encodeURIComponent(typeFilter)}`),
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });

  const categories = catsRaw?.data || [];
  const entries    = expRaw?.data  || [];
  const loading    = catsLoading || expLoading;

  const totalAmt    = useMemo(() => entries.reduce((s, e) => s + Number(e.amount || 0), 0), [entries]);
  const directAmt   = useMemo(() => entries.filter(e => e.categoryType === "Direct").reduce((s, e) => s + Number(e.amount || 0), 0), [entries]);
  const indirectAmt = useMemo(() => entries.filter(e => e.categoryType === "Indirect").reduce((s, e) => s + Number(e.amount || 0), 0), [entries]);
  const monthAmt    = useMemo(() => {
    const m = thisMonth();
    return entries.filter(e => String(e.expenseDate || "").slice(0, 7) === m).reduce((s, e) => s + Number(e.amount || 0), 0);
  }, [entries]);

  const openAdd = () => {
    setEditingId(null); setError("");
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id ? String(categories[0].id) : "" });
    setModal(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id); setError("");
    setForm({
      categoryId: String(row.categoryId),
      amount: String(row.amount),
      expenseDate: String(row.expenseDate || "").slice(0, 10) || today(),
      paymentMode: row.paymentMode || "Cash",
      referenceNo: row.referenceNo || "",
      notes: row.notes || "",
    });
    setModal(true);
  };

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const payload = {
        categoryId: Number(form.categoryId),
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        paymentMode: form.paymentMode,
        referenceNo: form.referenceNo || null,
        notes: form.notes || null,
      };
      const path = editingId ? `/expenses/${editingId}` : "/expenses";
      await api(path, { method: editingId ? "PUT" : "POST", body: JSON.stringify(payload) });
      setNotice(editingId ? "Expense updated." : "Expense saved.");
      setModal(false);
      qc.invalidateQueries({ queryKey: [QK.expenses] });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const deleteEntry = async (id) => {
    if (!window.confirm("Delete this expense entry?")) return;
    setError("");
    try {
      await api(`/expenses/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: [QK.expenses] });
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="exp-shell">
      <Sidebar activePage={activePage} />
      <main className="exp-main">
        <Topbar activePage={activePage} />
        <div className="exp-content">

          {/* Header */}
          <div className="exp-heading">
            <div>
              <span className="exp-eyebrow">EXPENSE MANAGEMENT</span>
              <h1>Expenses</h1>
              <p>Track all business expenses — direct costs and overhead, fully customisable.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => navigate("/expenses/categories")}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "9px 14px", border: "1.5px solid #E2E8F0", borderRadius: 9, fontWeight: 700, fontSize: 12.5, color: "#374151", background: "#fff", cursor: "pointer" }}
              >
                <svg viewBox="0 0 14 14" fill="none" width="13" height="13" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 3h12M1 7h12M1 11h7" stroke="currentColor"/></svg>
                Categories
              </button>
              <button className="exp-primary" onClick={openAdd} disabled={categories.length === 0}>＋ Add Expense</button>
            </div>
          </div>

          {categories.length === 0 && !catsLoading && (
            <div className="exp-notice">
              No expense categories yet.{" "}
              <button type="button" onClick={() => navigate("/expenses/categories")} style={{ background: "none", border: "none", color: "#D97706", fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                Create your first category
              </button>{" "}
              before adding expenses.
            </div>
          )}

          {/* KPI stats */}
          <div className="exp-stats">
            <div className="exp-stat exp-stat--total">
              <span className="exp-stat-label">TOTAL EXPENSES</span>
              <strong className="exp-stat-value">{loading ? "—" : money(totalAmt)}</strong>
              <span className="exp-stat-sub">{entries.length} entries</span>
            </div>
            <div className="exp-stat exp-stat--direct">
              <span className="exp-stat-label">DIRECT</span>
              <strong className="exp-stat-value">{loading ? "—" : money(directAmt)}</strong>
              <span className="exp-stat-sub">Cost of operations</span>
            </div>
            <div className="exp-stat exp-stat--indirect">
              <span className="exp-stat-label">INDIRECT</span>
              <strong className="exp-stat-value">{loading ? "—" : money(indirectAmt)}</strong>
              <span className="exp-stat-sub">Overhead / admin</span>
            </div>
            <div className="exp-stat exp-stat--month">
              <span className="exp-stat-label">THIS MONTH</span>
              <strong className="exp-stat-value">{loading ? "—" : money(monthAmt)}</strong>
              <span className="exp-stat-sub">Current period</span>
            </div>
          </div>

          {notice && <div className="exp-notice" onClick={() => setNotice("")} style={{ cursor: "pointer" }}>{notice}</div>}
          {error && !modal && <div className="exp-error">{error}</div>}

          {/* Table card */}
          <section className="exp-card">
            <div className="exp-toolbar">
              <div className="exp-toolbar-left">
                <div className="exp-search-wrap">
                  <svg className="exp-search-icon" viewBox="0 0 16 16" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="6.5" cy="6.5" r="4" stroke="currentColor"/><path d="M11 11l2.5 2.5" stroke="currentColor"/></svg>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search category, notes or reference…" />
                </div>
                {["All", "Direct", "Indirect"].map(t => (
                  <button key={t} className={`exp-filter-chip${typeFilter === t ? ` active-${t.toLowerCase()}` : ""}`} onClick={() => setTypeFilter(t)}>{t}</button>
                ))}
              </div>
              <span style={{ fontSize: 11, color: "#78869b", fontWeight: 600 }}>{entries.length} entries</span>
            </div>

            <div className="exp-table-wrap">
              <table className="exp-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Payment</th>
                    <th>Reference</th>
                    <th>Notes</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan="8" className="exp-empty">Loading expenses…</td></tr>}
                  {!loading && entries.length === 0 && (
                    <tr><td colSpan="8" className="exp-empty">
                      {categories.length === 0
                        ? "Add expense categories first, then record your expenses."
                        : "No expenses found. Click '＋ Add Expense' to record one."}
                    </td></tr>
                  )}
                  {!loading && entries.map(row => {
                    const color = CAT_COLORS[String(row.categoryName || "").charCodeAt(0) % CAT_COLORS.length];
                    return (
                      <tr key={row.id}>
                        <td>
                          <div className="exp-cat-cell">
                            <span className="exp-cat-dot" style={{ background: color }} />
                            <span style={{ fontWeight: 600, color: "#0F172A" }}>{row.categoryName || "—"}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`exp-type-badge exp-type-badge--${(row.categoryType || "indirect").toLowerCase()}`}>
                            {row.categoryType || "—"}
                          </span>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{fmtDate(row.expenseDate)}</td>
                        <td><span className="exp-pay-chip">{row.paymentMode}</span></td>
                        <td style={{ color: "#64748B", fontSize: 11 }}>{row.referenceNo || "—"}</td>
                        <td style={{ maxWidth: 180, fontSize: 11.5, color: "#64748B" }}>
                          {row.notes ? (row.notes.length > 45 ? row.notes.slice(0, 45) + "…" : row.notes) : "—"}
                        </td>
                        <td style={{ textAlign: "right" }}><span className="exp-amount">{money(row.amount)}</span></td>
                        <td>
                          <div className="exp-action-group">
                            <button className="si-action-btn si-action-btn--edit" onClick={() => openEdit(row)}>
                              <svg viewBox="0 0 14 14" fill="none" width="12" height="12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5l2 2-6 6H3.5v-2l6-6z" stroke="currentColor"/><path d="M8 4l2 2" stroke="currentColor"/></svg>
                              Edit
                            </button>
                            <button
                              className="si-action-btn"
                              style={{ background: "#FEF2F2", borderColor: "#FECACA", color: "#DC2626" }}
                              onClick={() => deleteEntry(row.id)}
                            >
                              <svg viewBox="0 0 14 14" fill="none" width="12" height="12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h10M5 4V2h4v2M6 7v4M8 7v4" stroke="currentColor"/><rect x="3" y="4" width="8" height="8" rx="1" stroke="currentColor"/></svg>
                              Delete
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

      {/* Add / Edit modal */}
      {modal && (
        <div className="exp-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <section className="exp-modal" role="dialog" aria-modal="true">
            <header>
              <div>
                <h2>{editingId ? "Edit Expense" : "Add Expense"}</h2>
                <p>Amounts saved excluding GST.</p>
              </div>
              <button type="button" className="exp-close" onClick={() => setModal(false)}>×</button>
            </header>
            {error && <div className="exp-error">{error}</div>}
            <form className="exp-form" onSubmit={save}>
              <label className="exp-form-wide">
                Category *
                <select required value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">Select category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                  ))}
                </select>
              </label>

              <label>
                Amount (&#8377;) *
                <input type="number" min="0.01" step="0.01" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </label>

              <label>
                Date *
                <input type="date" required value={form.expenseDate} onChange={e => setForm({ ...form, expenseDate: e.target.value })} />
              </label>

              <label>
                Payment mode *
                <select required value={form.paymentMode} onChange={e => setForm({ ...form, paymentMode: e.target.value })}>
                  {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                </select>
              </label>

              <label>
                Reference no.
                <input maxLength="100" value={form.referenceNo} onChange={e => setForm({ ...form, referenceNo: e.target.value })} placeholder="Cheque no., UPI ref…" />
              </label>

              <label className="exp-form-wide">
                Notes
                <textarea rows="2" maxLength="1000" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional description" />
              </label>

              <footer className="exp-form-actions">
                <button type="button" className="exp-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button className="exp-primary" disabled={busy}>{busy ? "Saving…" : "Save expense"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
