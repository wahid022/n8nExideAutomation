import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { supabase } from "../lib/supabase";
import "./Customers.css";

const API_BASE = (import.meta.env.VITE_PRODUCTS_API_URL || "http://127.0.0.1:3001/api/products").replace(/\/products\/?$/, "");
const EMPTY = { businessName: "", contactName: "", phone: "", gstin: "", billingAddress: "", state: "Jharkhand", customerType: "Retailer" };

async function api(path, options = {}) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, ...(options.headers || {}) }, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

export default function Customers({ activePage = "Customers" }) {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await api(`/customers?search=${encodeURIComponent(search)}`); setCustomers(result.data || []); }
    catch (e) { setError(e.message || "Unable to load customers."); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);

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
      await load();
      if (!editingId && result.customer) setSearch(result.customer.businessName || result.customer.phone || "");
    } catch (e) { setError(e.message || "Unable to save customer."); }
    finally { setSaving(false); }
  };

  return <div className="customers-page-shell">
    <Sidebar activePage={activePage} />
    <main className="customers-main">
      <Topbar activePage={activePage} />
      <div className="customers-content">
        <div className="customers-heading"><div><span className="customers-eyebrow">CUSTOMER DIRECTORY</span><h1>Customers</h1><p>Manage saved retailers, wholesalers and business contacts.</p></div><button className="customers-primary" onClick={openAdd}>＋ Add customer</button></div>
        {notice && <div className="customers-notice">{notice}</div>}
        {error && !modalOpen && <div className="customers-error">{error}</div>}
        <section className="customers-card">
          <div className="customers-toolbar"><div><strong>All customers</strong><span>{customers.length} shown</span></div><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search business, contact, phone, GSTIN or address…" aria-label="Search customers" /></div>
          <div className="customers-table-wrap"><table className="customers-table"><thead><tr><th>Business</th><th>Contact</th><th>Phone</th><th>GSTIN</th><th>Address</th><th>Type</th><th>Action</th></tr></thead><tbody>
            {loading ? <tr><td colSpan="7" className="customers-empty">Loading customers…</td></tr> : customers.length === 0 ? <tr><td colSpan="7" className="customers-empty">No customers found. Add a customer to get started.</td></tr> : customers.map((c) => <tr key={c.id}><td><strong>{c.businessName}</strong><small>{c.state || "State not set"}</small></td><td>{c.contactName}</td><td>{c.phone}</td><td>{c.gstin || "—"}</td><td className="customers-address">{c.billingAddress || "—"}</td><td><span className="customers-type">{c.customerType || "Retailer"}</span></td><td><button className="customers-edit" onClick={() => openEdit(c)}>Edit</button></td></tr>)}
          </tbody></table></div>
        </section>
      </div>
    </main>
    {modalOpen && <div className="customers-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}><section className="customers-modal" role="dialog" aria-modal="true" aria-labelledby="customers-modal-title"><header><div><h2 id="customers-modal-title">{editingId ? "Edit customer" : "Add new customer"}</h2><p>Customer information is saved to your existing database.</p></div><button type="button" className="customers-close" onClick={() => setModalOpen(false)} aria-label="Close">×</button></header>
      {error && <div className="customers-error">{error}</div>}
      <form onSubmit={save} className="customers-form"><label>Business name *<input required maxLength="200" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></label><label>Contact name *<input required maxLength="200" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label><label>Phone number *<input required maxLength="40" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label>GSTIN<input maxLength="15" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></label><label className="customers-form-wide">Billing address<textarea rows="3" maxLength="1000" value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} /></label><label>State<input maxLength="100" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></label><label>Customer type<select value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}><option>Retailer</option><option>Wholesaler</option><option>Other</option></select></label><footer className="customers-form-actions"><button type="button" className="customers-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="customers-primary" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Save customer"}</button></footer></form>
    </section></div>}
  </div>;
}
