import { useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { api } from "../lib/api";
import { avatarColor } from "../lib/formatters";
import { useDebounce } from "../hooks/useDebounce";
import "./Customers.css";

const EMPTY = { businessName: "", contactName: "", phone: "", gstin: "", billingAddress: "", state: "Jharkhand", customerType: "Retailer" };

export default function Customers({ activePage = "Customers" }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);

  const { data: customersRaw, isLoading: loading } = useQuery({
    queryKey: ["customers", debouncedSearch],
    queryFn: () => api(`/customers?search=${encodeURIComponent(debouncedSearch)}`),
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });
  const customers = customersRaw?.data || [];

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const openAdd = () => { setEditingId(null); setForm(EMPTY); setError(""); setModalOpen(true); };
  const openEdit = (customer) => {
    setEditingId(customer.id);
    setForm({ businessName: customer.businessName || "", contactName: customer.contactName || "", phone: customer.phone || "", gstin: customer.gstin || "", billingAddress: customer.billingAddress || "", state: customer.state || "Jharkhand", customerType: customer.customerType || "Retailer" });
    setError(""); setModalOpen(true);
  };
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const result = await api(editingId ? `/customers/${encodeURIComponent(editingId)}` : "/customers", { method: editingId ? "PATCH" : "POST", body: JSON.stringify(form) });
      setNotice(editingId ? "Customer updated successfully." : "Customer created successfully.");
      setModalOpen(false); setForm(EMPTY); setEditingId(null);
      qc.invalidateQueries({ queryKey: ["customers"] });
      if (!editingId && result.customer) setSearch(result.customer.businessName || result.customer.phone || "");
    } catch (e) { setError(e.message || "Unable to save customer."); }
    finally { setSaving(false); }
  };

  const retailers   = customers.filter((c) => (c.customerType || "Retailer") === "Retailer").length;
  const wholesalers = customers.filter((c) => c.customerType === "Wholesaler").length;
  const others      = customers.filter((c) => !["Retailer", "Wholesaler"].includes(c.customerType || "Retailer")).length;

  const typeClass = (type) => {
    if (type === "Wholesaler") return "customers-type customers-type--wholesaler";
    if (type === "Other")      return "customers-type customers-type--other";
    return "customers-type customers-type--retailer";
  };

  return (
    <div className="customers-page-shell">
      <Sidebar activePage={activePage} />
      <main className="customers-main">
        <Topbar activePage={activePage} />
        <div className="customers-content">

          {/* Header */}
          <div className="customers-heading">
            <div>
              <span className="customers-eyebrow">CUSTOMER DIRECTORY</span>
              <h1>Customers</h1>
              <p>Manage saved retailers, wholesalers and business contacts.</p>
            </div>
            <button className="customers-primary" onClick={openAdd}>+ Add customer</button>
          </div>

          {/* KPI stats strip */}
          <div className="cust-stats">
            <div className={`cust-stat cust-stat--total${!loading && customers.length === 0 ? " cust-stat--zero" : ""}`}>
              <span className="cust-stat-label">TOTAL CUSTOMERS</span>
              <strong className="cust-stat-value">{loading ? "—" : customers.length}</strong>
            </div>
            <div className={`cust-stat cust-stat--retailer${!loading && retailers === 0 ? " cust-stat--zero" : ""}`}>
              <span className="cust-stat-label">RETAILERS</span>
              <strong className="cust-stat-value">{loading ? "—" : retailers}</strong>
            </div>
            <div className={`cust-stat cust-stat--wholesaler${!loading && wholesalers === 0 ? " cust-stat--zero" : ""}`}>
              <span className="cust-stat-label">WHOLESALERS</span>
              <strong className="cust-stat-value">{loading ? "—" : wholesalers}</strong>
            </div>
            <div className={`cust-stat cust-stat--other${!loading && others === 0 ? " cust-stat--zero" : ""}`}>
              <span className="cust-stat-label">OTHERS</span>
              <strong className="cust-stat-value">{loading ? "—" : others}</strong>
            </div>
          </div>

          {notice && <div className="customers-notice">{notice}</div>}
          {error && !modalOpen && <div className="customers-error">{error}</div>}

          {/* Table card */}
          <section className="customers-card">
            <div className="customers-toolbar">
              <div>
                <strong>All customers</strong>
                <span>{customers.length} shown</span>
              </div>
              <div className="cust-search-wrap">
                <svg className="cust-search-icon" viewBox="0 0 16 16" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="6.5" cy="6.5" r="4" stroke="currentColor"/><path d="M11 11l2.5 2.5" stroke="currentColor"/></svg>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search business, contact, phone, GSTIN or address…" aria-label="Search customers" />
              </div>
            </div>
            <div className="customers-table-wrap">
              <table className="customers-table">
                <thead>
                  <tr><th>Business</th><th>Contact</th><th>Phone</th><th>GSTIN</th><th>Address</th><th>Type</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan="7" className="customers-empty">Loading customers…</td></tr>}
                  {!loading && customers.length === 0 && <tr><td colSpan="7" className="customers-empty">No customers found. Add a customer to get started.</td></tr>}
                  {!loading && customers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="cust-biz-cell">
                          <span className="cust-avatar" style={{ background: avatarColor(c.businessName) }}>
                            {(c.businessName || "?")[0].toUpperCase()}
                          </span>
                          <div>
                            <strong>{c.businessName}</strong>
                            <small>{c.state || "State not set"}</small>
                          </div>
                        </div>
                      </td>
                      <td>{c.contactName}</td>
                      <td>{c.phone}</td>
                      <td>{c.gstin || "—"}</td>
                      <td className="customers-address">{c.billingAddress || "—"}</td>
                      <td><span className={typeClass(c.customerType)}>{c.customerType || "Retailer"}</span></td>
                      <td>
                        <button className="customers-edit" onClick={() => openEdit(c)}>
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

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="customers-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <section className="customers-modal" role="dialog" aria-modal="true" aria-labelledby="customers-modal-title">
            <header>
              <div>
                <h2 id="customers-modal-title">{editingId ? "Edit customer" : "Add new customer"}</h2>
                <p>Customer information is saved to your existing database.</p>
              </div>
              <button type="button" className="customers-close" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
            </header>
            {error && <div className="customers-error">{error}</div>}
            <form onSubmit={save} className="customers-form">
              <label>Business name *<input required maxLength="200" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></label>
              <label>Contact name *<input required maxLength="200" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
              <label>Phone number *<input required maxLength="40" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              <label>GSTIN<input maxLength="15" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></label>
              <label className="customers-form-wide">Billing address<textarea rows="3" maxLength="1000" value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} /></label>
              <label>State<input maxLength="100" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></label>
              <label>Customer type<select value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}><option>Retailer</option><option>Wholesaler</option><option>Other</option></select></label>
              <footer className="customers-form-actions">
                <button type="button" className="customers-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button className="customers-primary" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Save customer"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
