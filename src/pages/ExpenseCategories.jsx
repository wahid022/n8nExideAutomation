import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { supabase } from "../lib/supabase";
import "./Expenses.css";
import "./Sales.css";

const API_BASE = (import.meta.env.VITE_PRODUCTS_API_URL || "http://127.0.0.1:3001/api/products").replace(/\/products\/?$/, "");

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

const CAT_COLORS = ["#D97706","#2563EB","#7C3AED","#059669","#DC2626","#0EA5E9","#EC4899","#0D9488","#F59E0B","#6366F1"];
const catColor = (name) => CAT_COLORS[String(name || "").charCodeAt(0) % CAT_COLORS.length];

const EMPTY = { name: "", type: "Indirect", description: "" };

const SUGGESTIONS = [
  { name: "Rent",                  type: "Indirect" },
  { name: "Salaries",              type: "Direct"   },
  { name: "Electricity",           type: "Indirect" },
  { name: "Petrol / Fuel",         type: "Indirect" },
  { name: "Mobile Expenses",       type: "Indirect" },
  { name: "Internet",              type: "Indirect" },
  { name: "Bank Charges",          type: "Indirect" },
  { name: "Transport / Freight",   type: "Direct"   },
  { name: "Office Expenses",       type: "Indirect" },
  { name: "Professional Fees",     type: "Indirect" },
  { name: "Repair & Maintenance",  type: "Indirect" },
  { name: "Travelling",            type: "Indirect" },
  { name: "Staff Welfare",         type: "Indirect" },
  { name: "Miscellaneous",         type: "Indirect" },
];

export default function ExpenseCategories({ activePage = "Expense Categories" }) {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [notice, setNotice]         = useState("");
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [modal, setModal]           = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await api("/expense-categories");
      setCategories(r.data || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = categories.filter(c => {
    const matchType   = typeFilter === "All" || c.type === typeFilter;
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.description || "").toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const direct   = categories.filter(c => c.type === "Direct").length;
  const indirect = categories.filter(c => c.type === "Indirect").length;

  const openAdd  = () => { setEditingId(null); setForm(EMPTY); setError(""); setModal(true); };
  const openEdit = (c) => { setEditingId(c.id); setForm({ name: c.name, type: c.type, description: c.description || "" }); setError(""); setModal(true); };

  const save = async (e) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const path = editingId ? `/expense-categories/${editingId}` : "/expense-categories";
      await api(path, { method: editingId ? "PUT" : "POST", body: JSON.stringify(form) });
      setNotice(editingId ? `"${form.name}" updated.` : `"${form.name}" added.`);
      setModal(false); setForm(EMPTY); setEditingId(null); await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const deleteCategory = async (c) => {
    if (!window.confirm(`Delete category "${c.name}"? This cannot be undone if it has linked expenses.`)) return;
    setError("");
    try { await api(`/expense-categories/${c.id}`, { method: "DELETE" }); await load(); }
    catch (err) { setError(err.message); }
  };

  const addSuggestion = async (s) => {
    setError("");
    try {
      await api("/expense-categories", { method: "POST", body: JSON.stringify({ name: s.name, type: s.type, description: "" }) });
      setNotice(`"${s.name}" added.`);
      await load();
    } catch (err) { setError(err.message); }
  };

  const existingNames = new Set(categories.map(c => c.name.toLowerCase()));
  const pendingSuggestions = SUGGESTIONS.filter(s => !existingNames.has(s.name.toLowerCase()));

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
              <h1>Expense Categories</h1>
              <p>Define your own expense heads — Direct (operational costs) or Indirect (overhead).</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => navigate("/expenses")}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "9px 14px", border: "1.5px solid #E2E8F0", borderRadius: 9, fontWeight: 700, fontSize: 12.5, color: "#374151", background: "#fff", cursor: "pointer" }}
              >
                ← Expense Entries
              </button>
              <button className="exp-primary" onClick={openAdd}>＋ New Category</button>
            </div>
          </div>

          {/* KPI strip */}
          <div className="exp-stats">
            <div className="exp-stat exp-stat--total">
              <span className="exp-stat-label">TOTAL CATEGORIES</span>
              <strong className="exp-stat-value">{loading ? "—" : categories.length}</strong>
              <span className="exp-stat-sub">Custom heads</span>
            </div>
            <div className="exp-stat exp-stat--direct">
              <span className="exp-stat-label">DIRECT</span>
              <strong className="exp-stat-value">{loading ? "—" : direct}</strong>
              <span className="exp-stat-sub">Operational costs</span>
            </div>
            <div className="exp-stat exp-stat--indirect">
              <span className="exp-stat-label">INDIRECT</span>
              <strong className="exp-stat-value">{loading ? "—" : indirect}</strong>
              <span className="exp-stat-sub">Overhead / admin</span>
            </div>
            <div className="exp-stat exp-stat--month">
              <span className="exp-stat-label">SUGGESTIONS</span>
              <strong className="exp-stat-value">{loading ? "—" : pendingSuggestions.length}</strong>
              <span className="exp-stat-sub">Quick-add available</span>
            </div>
          </div>

          {notice && <div className="exp-notice" onClick={() => setNotice("")} style={{ cursor: "pointer" }}>{notice}</div>}
          {error && !modal && <div className="exp-error">{error}</div>}

          {/* Quick-add suggestions */}
          {!loading && pendingSuggestions.length > 0 && (
            <div style={{ marginBottom: 18, background: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#92400E", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>
                Quick-add suggestions
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {pendingSuggestions.map(s => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => addSuggestion(s)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", border: "1.5px solid #FCD34D", borderRadius: 20, background: "#fff", fontSize: 12, fontWeight: 600, color: "#92400E", cursor: "pointer" }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.type === "Direct" ? "#2563EB" : "#7C3AED", flexShrink: 0 }} />
                    + {s.name}
                    <span style={{ fontSize: 10, color: "#B45309", background: "#FEF9C3", padding: "1px 6px", borderRadius: 10 }}>{s.type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category table */}
          <section className="exp-card">
            <div className="exp-toolbar">
              <div className="exp-toolbar-left">
                <div className="exp-search-wrap">
                  <svg className="exp-search-icon" viewBox="0 0 16 16" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="6.5" cy="6.5" r="4" stroke="currentColor"/><path d="M11 11l2.5 2.5" stroke="currentColor"/></svg>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search categories…" />
                </div>
                {["All", "Direct", "Indirect"].map(t => (
                  <button key={t} className={`exp-filter-chip${typeFilter === t ? ` active-${t.toLowerCase()}` : ""}`} onClick={() => setTypeFilter(t)}>{t}</button>
                ))}
              </div>
              <span style={{ fontSize: 11, color: "#78869b", fontWeight: 600 }}>{filtered.length} categories</span>
            </div>

            <div className="exp-table-wrap">
              <table className="exp-table">
                <thead>
                  <tr><th>Category Name</th><th>Type</th><th>Description</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan="4" className="exp-empty">Loading…</td></tr>}
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan="4" className="exp-empty">
                      {categories.length === 0
                        ? "No categories yet. Use the suggestions above or click '＋ New Category'."
                        : "No categories match your filter."}
                    </td></tr>
                  )}
                  {!loading && filtered.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div className="exp-cat-cell">
                          <span className="exp-cat-dot" style={{ background: catColor(c.name), width: 12, height: 12, borderRadius: 3 }} />
                          <span style={{ fontWeight: 700, color: "#0F172A", fontSize: 13 }}>{c.name}</span>
                        </div>
                      </td>
                      <td><span className={`exp-type-badge exp-type-badge--${c.type.toLowerCase()}`}>{c.type}</span></td>
                      <td style={{ color: "#64748B", fontSize: 12 }}>
                        {c.description || <span style={{ color: "#CBD5E1", fontStyle: "italic" }}>No description</span>}
                      </td>
                      <td>
                        <div className="exp-action-group">
                          <button className="si-action-btn si-action-btn--edit" onClick={() => openEdit(c)}>
                            <svg viewBox="0 0 14 14" fill="none" width="12" height="12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5l2 2-6 6H3.5v-2l6-6z" stroke="currentColor"/><path d="M8 4l2 2" stroke="currentColor"/></svg>
                            Edit
                          </button>
                          <button
                            className="si-action-btn"
                            style={{ background: "#FEF2F2", borderColor: "#FECACA", color: "#DC2626" }}
                            onClick={() => deleteCategory(c)}
                          >
                            <svg viewBox="0 0 14 14" fill="none" width="12" height="12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h10M5 4V2h4v2M6 7v4M8 7v4" stroke="currentColor"/><rect x="3" y="4" width="8" height="8" rx="1" stroke="currentColor"/></svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
                <h2>{editingId ? "Edit Category" : "New Expense Category"}</h2>
                <p>Categories are shared across all expense entries.</p>
              </div>
              <button type="button" className="exp-close" onClick={() => setModal(false)}>×</button>
            </header>
            {error && <div className="exp-error">{error}</div>}
            <form className="exp-form" onSubmit={save}>
              <label className="exp-form-wide">
                Category name *
                <input required maxLength="100" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rent, Freight, Salary…" />
              </label>

              <label>
                Type *
                <select required value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="Direct">Direct — operational cost</option>
                  <option value="Indirect">Indirect — overhead / admin</option>
                </select>
              </label>

              <label>
                Color preview
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: catColor(form.name), border: "2px solid #E2E8F0", display: "block" }} />
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>Auto-assigned from name</span>
                </div>
              </label>

              <label className="exp-form-wide">
                Description
                <input maxLength="500" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional — what this category covers" />
              </label>

              <footer className="exp-form-actions">
                <button type="button" className="exp-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button className="exp-primary" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add category"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
