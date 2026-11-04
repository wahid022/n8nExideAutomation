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

const blankItem = () => ({ productName: "", productCode: "", quantity: 1, unitPrice: 0, discountPercent: 0, taxPercent: 28 });

function ProductPicker({ line, onChange }) {
  const [query, setQuery] = useState(line.productName || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || query.trim().length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api(`/products?search=${encodeURIComponent(query.trim())}&pageSize=20`);
        setResults(result.data || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open]);

  const select = (product) => {
    const name = [product.brand, product.modelSku, product.specsCapacity].filter(Boolean).join(" ");
    onChange({
      ...line,
      productId: product.id,
      productName: name || product.productCode,
      productCode: product.productCode || "",
      brand: product.brand || "",
      unitPrice: Number(product.dealerPrice ?? 0),
      taxPercent: Number(product.gstRate ?? 28),
      mrp: product.mrp ?? null,
    });
    setQuery(name || product.productCode || "");
    setOpen(false);
  };

  return (
    <div className="sales-product-picker">
      <input
        required
        maxLength={250}
        value={query}
        placeholder="Search product, SKU or code…"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const value = e.target.value;
          setQuery(value);
          setOpen(true);
          onChange({ ...line, productId: null, productName: value, productCode: "", brand: "", mrp: null });
        }}
      />
      {line.productCode && (
        <small>Code: {line.productCode}{line.mrp != null ? ` | MRP: ${money(line.mrp)}` : ""}</small>
      )}
      {open && (
        <div className="sales-product-results">
          {loading && <div className="sales-product-option">Searching…</div>}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="sales-product-option">No products found.</div>
          )}
          {results.map((product) => (
            <button type="button" className="sales-product-option" key={product.id} onClick={() => select(product)}>
              <strong>{[product.brand, product.modelSku, product.specsCapacity].filter(Boolean).join(" ") || product.productCode}</strong>
              <span>Code: {product.productCode || "—"} | Dealer: {money(product.dealerPrice)} | MRP: {money(product.mrp)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const AVATAR_COLORS = ["#059669","#0EA5E9","#8B5CF6","#F59E0B","#EF4444","#EC4899","#06B6D4","#4F46E5"];
const avatarColor = (name) => AVATAR_COLORS[(name || "?").charCodeAt(0) % AVATAR_COLORS.length];

function badgeClass(status) {
  const s = String(status || "").toLowerCase().replace(/ /g, "-");
  return `pur-badge pur-badge--${s}`;
}

const fmtDate = (v) => v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function PurchaseDocModal({ doc, isInvoice, onClose, autoPrint = false }) {
  useEffect(() => {
    if (autoPrint && doc) {
      const t = setTimeout(() => window.print(), 250);
      return () => clearTimeout(t);
    }
  }, [autoPrint, doc]);

  if (!doc) return null;

  const vendor = doc.vendor || {};
  const items = Array.isArray(doc.items) ? doc.items : [];
  const subtotal  = Number(doc.subtotal || 0);
  const discount  = Number(doc.discountTotal || 0);
  const taxable   = Number(doc.taxableValue || 0);
  const tax       = Number(doc.taxTotal || 0);
  const total     = Number(doc.grandTotal || 0);
  const docNum    = doc.invoiceNumber || doc.orderNumber || `#${doc.id}`;
  const docDate   = doc.invoiceDate || doc.orderDate;
  const docType   = isInvoice ? "PURCHASE INVOICE" : "PURCHASE ORDER";
  const dateLabel = isInvoice ? "Invoice Date" : "Order Date";
  const extraLabel = isInvoice ? "Due Date" : "Expected Delivery";
  const extraDate = isInvoice ? doc.dueDate : doc.expectedDelivery;

  return (
    <div className="sales-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="sales-modal sales-order-details-modal" role="dialog" aria-modal="true" aria-labelledby="pur-doc-title">

        {/* ── Printable section ── */}
        <div className="sales-print-document">
          <div className="inv-header">
            <div className="inv-company">
              <div className="inv-company-name">BHARAT BATTERIES</div>
              <div className="inv-company-sub">Your Trusted Partner in Power Solutions</div>
            </div>
            <div className="inv-meta">
              <div className="inv-doc-type">{docType}</div>
              <div className="inv-meta-row"><span>Doc No.</span><strong>{docNum}</strong></div>
              <div className="inv-meta-row"><span>{dateLabel}</span><strong>{fmtDate(docDate)}</strong></div>
              {extraDate && <div className="inv-meta-row"><span>{extraLabel}</span><strong>{fmtDate(extraDate)}</strong></div>}
              <div className="inv-meta-row"><span>Status</span><strong>{doc.status || "Draft"}</strong></div>
            </div>
          </div>

          <div className="inv-rule" />

          <div className="inv-bill-section">
            <div className="inv-section-label">PURCHASE FROM</div>
            <div className="inv-cust-name">{vendor.businessName || "—"}</div>
            {vendor.contactName && <div>{vendor.contactName}</div>}
            {vendor.phone && <div>{vendor.phone}</div>}
            {vendor.billingAddress && <div>{vendor.billingAddress}{vendor.state ? `, ${vendor.state}` : ""}</div>}
            {vendor.gstin && <div>GSTIN: {vendor.gstin}</div>}
          </div>

          <table className="inv-items">
            <thead>
              <tr><th>#</th><th>Product</th><th>Code</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>GST</th><th>Total</th></tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const q  = Number(item.quantity || 0);
                const p  = Number(item.unitPrice || item.dealerPrice || 0);
                const d  = Number(item.discountPercent || 0);
                const t  = Number(item.taxPercent || 0);
                const gross = q * p;
                const da = gross * d / 100;
                const taxableLine = gross - da;
                const ga = taxableLine * t / 100;
                return (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{item.productName || "—"}</td>
                    <td>{item.productCode || "—"}</td>
                    <td>{q}</td>
                    <td>{money(p)}</td>
                    <td>{d > 0 ? `${d}% (${money(da)})` : "—"}</td>
                    <td>{t}% ({money(ga)})</td>
                    <td><strong>{money(item.lineTotal ?? taxableLine + ga)}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="inv-totals">
            <div className="inv-total-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="inv-total-row"><span>Discount</span><span>− {money(discount)}</span></div>
            <div className="inv-total-row"><span>Taxable Value</span><span>{money(taxable)}</span></div>
            <div className="inv-total-row"><span>GST</span><span>{money(tax)}</span></div>
            <div className="inv-total-row inv-grand"><span>Grand Total</span><span>{money(total)}</span></div>
          </div>

          {doc.notes && <div className="inv-notes"><strong>Notes:</strong> {doc.notes}</div>}

          <div className="inv-signatures">
            <div className="inv-sig-box"><div className="inv-sig-line" /><div>Vendor Signature</div></div>
            <div className="inv-sig-box"><div className="inv-sig-line" /><div>For BHARAT BATTERIES<br />Authorised Signatory</div></div>
          </div>

          <div className="inv-footer-text">This is a computer-generated document. Subject to jurisdiction of local courts.</div>
        </div>

        <header style={{ padding: "8px 12px", minHeight: "auto", borderBottom: "none", justifyContent: "flex-end" }}>
          <button type="button" className="sales-close" onClick={onClose} aria-label="Close">×</button>
        </header>
      </section>
    </div>
  );
}

export default function Purchase({ activePage }) {
  const isInvoice = activePage === "Purchase Invoice";

  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({});
  const [viewDoc, setViewDoc] = useState(null);
  const [autoPrintDoc, setAutoPrintDoc] = useState(false);

  const docPrefix = isInvoice ? "PINV" : "PO";
  const apiPath   = isInvoice ? "/purchase/invoices" : "/purchase/orders";
  const qKey      = isInvoice ? "purchase-invoices"  : "purchase-orders";
  const docNumKey = isInvoice ? "invoiceNumber" : "orderNumber";
  const docDateKey = isInvoice ? "invoiceDate"  : "orderDate";

  const { data: vendorsRaw } = useQuery({ queryKey: ["vendors"], queryFn: () => api("/vendors"), staleTime: 60_000 });
  const { data: rowsRaw, isLoading: loading } = useQuery({
    queryKey: [qKey, debouncedSearch],
    queryFn: () => api(`${apiPath}${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ""}`),
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });

  const vendors = vendorsRaw?.data || [];
  const rows    = rowsRaw?.data    || [];

  const open = () => {
    setEditingId(null); setError(""); setNotice("");
    setForm({
      [docNumKey]: `${docPrefix}-${Date.now().toString().slice(-8)}`,
      vendorId: vendors[0] ? String(vendors[0].id) : "",
      [docDateKey]: today(),
      dueDate: "",
      expectedDelivery: "",
      notes: "",
      items: [blankItem()],
    });
    setModal(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id); setError(""); setNotice("");
    setForm({
      [docNumKey]: row[docNumKey] || row.orderNumber || row.invoiceNumber,
      vendorId: String(row.vendor?.id || row.vendorId || ""),
      [docDateKey]: String(row[docDateKey] || row.orderDate || row.invoiceDate || "").slice(0, 10) || today(),
      dueDate: String(row.dueDate || "").slice(0, 10),
      expectedDelivery: String(row.expectedDelivery || "").slice(0, 10),
      notes: row.notes || "",
      items: Array.isArray(row.items) && row.items.length > 0
        ? row.items.map((x) => ({ productName: x.productName || "", productCode: x.productCode || "", quantity: x.quantity || 1, unitPrice: x.unitPrice || 0, discountPercent: x.discountPercent || 0, taxPercent: x.taxPercent || 18 }))
        : [blankItem()],
    });
    setModal(true);
  };

  const changeItem = (i, k, v) => setForm((f) => ({ ...f, items: f.items.map((x, j) => i === j ? { ...x, [k]: v } : x) }));

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const vendor = vendors.find((v) => String(v.id) === String(form.vendorId));
      if (!vendor) throw new Error("Choose a saved vendor.");
      const payload = {
        [docNumKey]: form[docNumKey],
        vendor,
        items: form.items,
        notes: form.notes,
        ...(isInvoice ? { invoiceDate: form.invoiceDate, dueDate: form.dueDate } : { expectedDelivery: form.expectedDelivery }),
      };
      const path = editingId ? `${apiPath}/${editingId}` : apiPath;
      await api(path, { method: editingId ? "PUT" : "POST", body: JSON.stringify(payload) });
      setNotice(editingId ? `${activePage} updated.` : `${activePage} saved.`);
      setModal(false);
      qc.invalidateQueries({ queryKey: [qKey] });
      qc.invalidateQueries({ queryKey: ["purchase-summary"] });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <>
    <div className="purchase-page-shell">
      <Sidebar activePage={activePage} />
      <main className="purchase-main">
        <Topbar activePage={activePage} />
        <div className="purchase-content">

          <div className="purchase-heading">
            <div>
              <span className="purchase-eyebrow">PURCHASE MODULE</span>
              <h1>{activePage}</h1>
              <p>{isInvoice ? "Track purchase invoices received from vendors." : "Create and manage purchase orders sent to vendors."}</p>
            </div>
            <button className="purchase-primary" onClick={open}>＋ New {isInvoice ? "invoice" : "order"}</button>
          </div>

          {notice && <div className="purchase-notice">{notice}</div>}
          {error && !modal && <div className="purchase-error">{error}</div>}

          <section className="purchase-card">
            <div className="purchase-toolbar">
              <div style={{ color: "#0F172A", fontSize: 14, fontWeight: 700 }}>
                All {isInvoice ? "invoices" : "orders"}
                <span style={{ marginLeft: 8, fontSize: 11, color: "#78869b", background: "#f2f5fa", padding: "3px 8px", borderRadius: 20, fontWeight: 600 }}>{rows.length} shown</span>
              </div>
              <div className="pur-search-wrap">
                <svg className="pur-search-icon" viewBox="0 0 16 16" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="6.5" cy="6.5" r="4" stroke="currentColor"/><path d="M11 11l2.5 2.5" stroke="currentColor"/></svg>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${isInvoice ? "invoices" : "orders"}…`} />
              </div>
            </div>

            <div className="purchase-table-wrap">
              <table className="purchase-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Vendor</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th className="pur-th-right">Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan="7" className="purchase-empty">Loading…</td></tr>}
                  {!loading && rows.length === 0 && <tr><td colSpan="7" className="purchase-empty">No records found. Create your first {isInvoice ? "purchase invoice" : "purchase order"}.</td></tr>}
                  {!loading && rows.map((r) => {
                    const vendorName = r.vendor?.businessName || `Vendor #${r.vendorId || "—"}`;
                    const rawDate = r[docDateKey] || r.orderDate || r.invoiceDate || "";
                    const itemCount = Array.isArray(r.items) ? r.items.length : 0;
                    const totalQty = Array.isArray(r.items) ? r.items.reduce((s, x) => s + Number(x.quantity || 0), 0) : 0;

                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="pur-doc-num">
                            <svg className="pur-doc-icon" viewBox="0 0 16 16" fill="none" width="16" height="16" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="1.5" width="10" height="13" rx="1.5" stroke="currentColor"/><line x1="5" y1="5" x2="10.5" y2="5" stroke="currentColor" strokeWidth="1"/><line x1="5" y1="7.5" x2="10.5" y2="7.5" stroke="currentColor" strokeWidth="1"/><line x1="5" y1="10" x2="8" y2="10" stroke="currentColor" strokeWidth="1"/></svg>
                            <strong>{r[docNumKey] || r.orderNumber || r.invoiceNumber}</strong>
                          </div>
                        </td>
                        <td>
                          <div className="pur-vendor-cell">
                            <span className="pur-avatar" style={{ background: avatarColor(vendorName) }}>{vendorName.charAt(0).toUpperCase()}</span>
                            <span style={{ fontWeight: 600, color: "#0F172A", fontSize: 13 }}>{vendorName}</span>
                          </div>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{fmtDate(rawDate)}</td>
                        <td>
                          <span style={{ display: "block", fontSize: 12 }}>
                            {itemCount} item{itemCount !== 1 ? "s" : ""} · Qty {totalQty}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "#059669", fontSize: 13 }}>{money(r.grandTotal)}</td>
                        <td><span className={badgeClass(r.status)}>{r.status || "Draft"}</span></td>
                        <td>
                          <div className="pur-action-group">
                            {r.status === "Draft" && (
                              <button className="si-action-btn si-action-btn--edit" onClick={() => openEdit(r)}>
                                <svg viewBox="0 0 14 14" fill="none" width="12" height="12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5l2 2-6 6H3.5v-2l6-6z" stroke="currentColor"/><path d="M8 4l2 2" stroke="currentColor"/></svg>
                                Edit
                              </button>
                            )}
                            <button className="si-action-btn si-action-btn--print" title="Print" onClick={() => { setAutoPrintDoc(true); setViewDoc(r); }}>
                              <svg viewBox="0 0 14 14" fill="none" width="12" height="12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="10" height="7" rx="1" stroke="currentColor"/><path d="M4 4V2h6v2" stroke="currentColor"/><rect x="4" y="8" width="6" height="2" rx=".5" stroke="currentColor" strokeWidth="1"/></svg>
                              Print
                            </button>
                            <button className="si-action-btn si-action-btn--preview" title="Preview" onClick={() => { setAutoPrintDoc(false); setViewDoc(r); }}>
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
                <h2>{editingId ? "Edit" : "New"} {activePage}</h2>
                <p>All fields are validated before saving.</p>
              </div>
              <button type="button" className="purchase-close" onClick={() => setModal(false)}>×</button>
            </header>

            {error && <div className="purchase-error">{error}</div>}

            <form className="purchase-form" onSubmit={save}>
              <label>
                Document number *
                <input required maxLength="80" value={form[docNumKey] || ""} onChange={(e) => setForm({ ...form, [docNumKey]: e.target.value })} />
              </label>

              <label>
                Vendor *
                <select required value={form.vendorId || ""} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
                  <option value="">Select vendor</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.businessName} — {v.phone}</option>)}
                </select>
              </label>

              <label>
                {isInvoice ? "Invoice date" : "Order date"} *
                <input type="date" required value={form[docDateKey] || today()} onChange={(e) => setForm({ ...form, [docDateKey]: e.target.value })} />
              </label>

              {isInvoice ? (
                <label>
                  Due date
                  <input type="date" value={form.dueDate || ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </label>
              ) : (
                <label>
                  Expected delivery
                  <input type="date" value={form.expectedDelivery || ""} onChange={(e) => setForm({ ...form, expectedDelivery: e.target.value })} />
                </label>
              )}

              <div className="purchase-line-items purchase-form-wide">
                <div className="purchase-line-heading">
                  <strong>Line items</strong>
                  <button type="button" className="purchase-secondary" onClick={() => setForm({ ...form, items: [...form.items, blankItem()] })}>＋ Add item</button>
                </div>
                {(form.items || []).map((x, i) => (
                  <div className="purchase-line" key={i}>
                    <label style={{ gridColumn: "1 / 3" }}>
                      Product / Catalogue *
                      <ProductPicker line={x} onChange={(updated) => setForm((f) => ({ ...f, items: f.items.map((item, j) => i === j ? updated : item) }))} />
                    </label>
                    <label>Qty<input type="number" min="0.001" step="0.001" required value={x.quantity} onChange={(e) => changeItem(i, "quantity", e.target.value)} /></label>
                    <label>Unit price<input type="number" min="0" step="0.01" required value={x.unitPrice} onChange={(e) => changeItem(i, "unitPrice", e.target.value)} /></label>
                    <label>Discount %<input type="number" min="0" max="100" value={x.discountPercent} onChange={(e) => changeItem(i, "discountPercent", e.target.value)} /></label>
                    <label>GST %<input type="number" min="0" max="100" value={x.taxPercent} onChange={(e) => changeItem(i, "taxPercent", e.target.value)} /></label>
                    {(form.items || []).length > 1 && (
                      <button type="button" className="purchase-remove" onClick={() => setForm({ ...form, items: form.items.filter((_, j) => i !== j) })}>Remove</button>
                    )}
                  </div>
                ))}
              </div>

              <label className="purchase-form-wide">
                Notes
                <textarea rows="2" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>

              <footer className="purchase-form-actions">
                <button type="button" className="purchase-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button className="purchase-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}

    </div>

    {viewDoc && (
      <PurchaseDocModal
        doc={viewDoc}
        isInvoice={isInvoice}
        autoPrint={autoPrintDoc}
        onClose={() => { setViewDoc(null); setAutoPrintDoc(false); }}
      />
    )}

    </>
  );
}
