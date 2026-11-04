import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { getProducts } from "../services/productService";
import { useQuotationDraft } from "../context/QuotationContext";
import { supabase } from "../lib/supabase";
import "../Quotation.css";
import "./Quotation.customer-modal.css";

const API_BASE = (import.meta.env.VITE_PRODUCTS_API_URL || "http://127.0.0.1:3001/api/products").replace(/\/products\/?$/, "");
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value) || 0);
const valueOf = (product, alias, key) => product?.[alias] ?? product?.[key] ?? "";
const today = () => new Date().toISOString().slice(0, 10);
const newNumber = () => `BBQ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

async function authenticatedFetch(path, options = {}) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, ...(options.headers || {}) },
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || result.message || `Request failed (${response.status}).`);
  return result;
}

export default function Quotation({ activePage = "Quotation", onNavigate = () => {} }) {
  const { draft, setDraft } = useQuotationDraft();
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const customerSearchRef = useRef(null);
  const productPickerRef = useRef(null);
  const [customers, setCustomers] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [taxMode, setTaxMode] = useState("gst");
  const [priceBasis, setPriceBasis] = useState("exclusive");
  const [supplyType, setSupplyType] = useState("intra");
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);
  const [roundOff, setRoundOff] = useState("0");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [notesExpanded, setNotesExpanded] = useState(true);
  const [customerForm, setCustomerForm] = useState({ businessName: "", contactName: "", phone: "", gstin: "", billingAddress: "", state: "Jharkhand", customerType: "Retailer" });

  const selected = draft.selected || [];
  const customer = draft.customer || {};
  const supplier = draft.supplier || {};
  const quote = draft.quote || {};
  const setCustomer = (patch) => setDraft((old) => ({ ...old, customer: { ...old.customer, ...patch } }));
  const setQuote = (patch) => setDraft((old) => ({ ...old, quote: { ...old.quote, ...patch } }));
  const setSelected = (next) => setDraft((old) => ({ ...old, selected: typeof next === "function" ? next(old.selected || []) : next }));

  useEffect(() => {
    let active = true;
    getProducts().then((rows) => {
      if (!active) return;
      setProducts(rows);
      setSelected((items) => items.map((item) => {
        const fresh = rows.find((p) => String(valueOf(p, "product_id", "Product Code")) === item.id);
        return fresh ? { ...item, product: fresh } : item;
      }));
    }).catch((e) => active && setLoadError(e?.message || "Unable to load product catalogue.")).finally(() => active && setLoadingProducts(false));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draft.quote?.number) {
      setQuote({ number: newNumber(), date: today() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleOutside = (e) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target)) {
        setShowCustomerResults(false);
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, []);

  useEffect(() => {
    const handleOutside = (e) => {
      if (productPickerRef.current && !productPickerRef.current.contains(e.target)) {
        setShowProductPicker(false);
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setCustomerLoading(true);
      authenticatedFetch(`/customers?search=${encodeURIComponent(customerSearch)}`)
        .then((result) => active && setCustomers(result.data || []))
        .catch((e) => active && setError(e.message))
        .finally(() => active && setCustomerLoading(false));
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [customerSearch]);

  const productResults = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    return products.filter((p) => !term || [valueOf(p, "product_id", "Product Code"), valueOf(p, "product_name", "Model / SKU"), valueOf(p, "brand", "Brand"), valueOf(p, "category", "Category")].join(" ").toLowerCase().includes(term)).slice(0, 30);
  }, [products, productSearch]);

  const totals = useMemo(() => {
    const rows = selected.map((item) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const rate = Math.max(0, Number(item.rate) || 0);
      const discountPercent = Math.min(100, Math.max(0, Number(item.discount) || 0));
      const gross = qty * rate;
      const discountAmount = gross * discountPercent / 100;
      const afterDiscount = gross - discountAmount;
      const gstRate = Math.max(0, Number(item.gstRate) || 0);
      const embeddedTax = taxMode === "gst" && priceBasis === "inclusive" ? afterDiscount * gstRate / (100 + gstRate) : 0;
      const taxable = taxMode === "gst" && priceBasis === "inclusive" ? afterDiscount - embeddedTax : afterDiscount;
      const tax = taxMode === "gst" ? (priceBasis === "inclusive" ? embeddedTax : taxable * gstRate / 100) : 0;
      return { ...item, qty, rate, gross, discountPercent, discountAmount, taxable, tax, gstRate, lineTotal: taxMode === "gst" && priceBasis === "inclusive" ? afterDiscount : taxable + tax };
    });
    const subtotal = rows.reduce((n, r) => n + r.gross, 0);
    const discountTotal = rows.reduce((n, r) => n + r.discountAmount, 0);
    const taxableValue = rows.reduce((n, r) => n + r.taxable, 0);
    const taxTotal = rows.reduce((n, r) => n + r.tax, 0);
    const rawTotal = rows.reduce((n, r) => n + r.lineTotal, 0);
    const finalTotal = roundOffEnabled ? Math.round(rawTotal + (Number(roundOff) || 0)) : rawTotal;
    return { rows, subtotal, discountTotal, taxableValue, taxTotal, rawTotal, roundOffAmount: finalTotal - rawTotal, grandTotal: finalTotal };
  }, [selected, taxMode, priceBasis, roundOffEnabled, roundOff]);

  const addProduct = (product) => {
    const id = String(valueOf(product, "product_id", "Product Code"));
    if (selected.some((item) => item.id === id)) { setNotice("This product is already in the quotation."); return; }
    const rate = Number(valueOf(product, "dealer_price", "Dealer Price"));
    if (!Number.isFinite(rate) || rate < 0) { setNotice("This product has no valid dealer price. Update the catalogue first."); return; }
    setSelected((items) => [...items, { id, product, quantity: 1, rate, discount: 0, gstRate: Number(valueOf(product, "gst_rate", "GST Rate %")) || 0, unit: "PCS" }]);
    setProductSearch(""); setShowProductPicker(false); setNotice("");
  };
  const updateItem = (id, key, value) => setSelected((items) => items.map((item) => item.id === id ? { ...item, [key]: value } : item));
  const chooseCustomer = (c) => {
    setCustomer({ id: c.id, name: c.contactName || "", company: c.businessName || "", phone: c.phone || "", gstin: c.gstin || "", address: c.billingAddress || "", state: c.state || "Jharkhand", customerType: c.customerType || "Retailer" });
    setSelectedCustomerId(c.id);
    setCustomerSearch(c.businessName || c.contactName || "");
    setShowCustomerResults(false);
    setShowNewCustomer(false);
    setEditingCustomer(false);
    setNotice("Customer details loaded.");
    setError("");
  };

  const saveCustomer = async (event) => {
    event.preventDefault(); setError(""); setNotice(""); setSavingCustomer(true);
    try {
      const result = await authenticatedFetch("/customers", { method: "POST", body: JSON.stringify(customerForm) });
      chooseCustomer(result.customer); setCustomers((old) => [result.customer, ...old.filter((x) => x.id !== result.customer.id)]); setShowNewCustomer(false); setCustomerForm({ businessName: "", contactName: "", phone: "", gstin: "", billingAddress: "", state: "Jharkhand", customerType: "Retailer" }); setNotice("Customer saved and selected.");
    } catch (e) {
      if (e.message.includes("already exists")) {
        try { const result = await authenticatedFetch(`/customers?search=${encodeURIComponent(customerForm.gstin || customerForm.phone)}`); const found = (result.data || [])[0]; if (found) { chooseCustomer(found); setShowNewCustomer(false); setNotice("Existing customer selected."); } else setError(e.message); } catch { setError(e.message); }
      } else setError(e.message);
    } finally { setSavingCustomer(false); }
  };

  const updateSelectedCustomer = async (event) => {
    event.preventDefault();
    if (!customer.id) return;
    setSavingCustomer(true); setError(""); setNotice("");
    try {
      const payload = { businessName: customer.company || "", contactName: customer.name || "", phone: customer.phone || "", gstin: customer.gstin || "", billingAddress: customer.address || "", state: customer.state || "", customerType: customer.customerType || "Retailer" };
      const result = await authenticatedFetch(`/customers/${encodeURIComponent(customer.id)}`, { method: "PATCH", body: JSON.stringify(payload) });
      chooseCustomer(result.customer);
      setCustomers((old) => old.map((c) => String(c.id) === String(result.customer.id) ? result.customer : c));
      setEditingCustomer(false); setNotice("Customer details updated successfully.");
    } catch (e) { setError(e.message || "Unable to update customer."); }
    finally { setSavingCustomer(false); }
  };

  const saveQuotation = async (status = "Draft") => {
    setError(""); setNotice("");
    if (!selected.length) { setError("Add at least one product before saving the quotation."); return; }
    if (!selectedCustomerId || String(customer.id) !== String(selectedCustomerId) || !customer.name?.trim() || !customer.company?.trim() || !customer.phone?.trim()) { setError("Select a saved customer before saving this quotation."); return; }
    if (!quote.number?.trim()) { setError("Quotation number is required."); return; }
    setBusy(true);
    try {
      const payload = {
        quotationNumber: quote.number,
        customer: { ...customer }, supplier: { ...supplier },
        items: totals.rows.map((r) => ({ productCode: r.id, productName: valueOf(r.product, "product_name", "Model / SKU"), brand: valueOf(r.product, "brand", "Brand"), category: valueOf(r.product, "category", "Category"), quantity: r.qty, unit: r.unit, rate: r.rate, discountPercent: r.discountPercent, discountAmount: r.discountAmount, gstRate: taxMode === "gst" ? r.gstRate : 0, taxableValue: r.taxable, taxAmount: r.tax, lineTotal: r.lineTotal, hsn: valueOf(r.product, "hsn", "HSN") })),
        settings: { taxMode, priceBasis, supplyType, date: quote.date || today(), validDays: Number(quote.validDays) || 7, terms: quote.terms || "", roundOffEnabled },
        subtotal: totals.subtotal, discountTotal: totals.discountTotal, taxableValue: totals.taxableValue, taxTotal: totals.taxTotal, roundOff: totals.roundOffAmount, grandTotal: totals.grandTotal, status,
      };
      const result = await authenticatedFetch("/quotations", { method: "POST", body: JSON.stringify(payload) });
      setNotice(`${status === "Generated" ? "Quotation saved. Use the print dialog to download the PDF." : "Quotation draft saved"} Reference: ${result.quotation.quotationNumber}.`);
      return result.quotation;
    } catch (e) { setError(e.message); return null; } finally { setBusy(false); }
  };

  const generatePdf = async () => {
    const saved = await saveQuotation("Generated");
    if (!saved) return;
    const title = document.title;
    document.title = `Bharat-Batteries-${quote.number || saved.quotationNumber}`;
    window.print();
    setTimeout(() => { document.title = title; }, 1200);
  };

  const clearQuotation = () => {
    if (!window.confirm("Clear all product rows from this quotation? Customer details will be kept.")) return;
    setSelected([]); setNotice("Product rows cleared."); setError("");
  };

  const gstRateOptions = [0, 5, 12, 18, 28];

  return (
    <div className="sales-page-shell">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <div className="sales-main quotation-area">
        <Topbar />
        <div className="quotation-content">

          {/* ── Page Header ─────────────────────────────────── */}
          <div className="qt-page-header no-print">
            <div>
              <span className="bb-quote-eyebrow">SALES WORKSPACE</span>
              <h1>Create quotation</h1>
              <p>Prepare pricing and share with your customer.</p>
            </div>
            <div className="qt-header-actions">
              <button type="button" className="bb-outline-button" disabled={busy} onClick={() => saveQuotation("Draft")}>
                {busy ? "Saving…" : (<><svg viewBox="0 0 16 16" fill="none" width="14" height="14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:"middle",marginRight:5}}><path d="M2.5 10.5v2a1 1 0 001 1h9a1 1 0 001-1v-2" stroke="currentColor"/><path d="M8 2.5v7M5.5 7l2.5 3 2.5-3" stroke="currentColor"/></svg>Save draft</>)}
              </button>
              <button type="button" className="bb-primary-button" disabled={busy} onClick={generatePdf}>
                {busy ? "Saving…" : (<><svg viewBox="0 0 16 16" fill="none" width="14" height="14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:"middle",marginRight:5}}><rect x="2" y="6" width="12" height="8" rx="1" stroke="currentColor"/><path d="M4 6V4a1 1 0 011-1h6a1 1 0 011 1v2" stroke="currentColor"/><line x1="5.5" y1="10" x2="10.5" y2="10" stroke="currentColor"/></svg>Generate PDF</>)}
              </button>
            </div>
          </div>

          {loadError && <div className="bb-alert error no-print">Product catalogue could not be loaded: {loadError}</div>}
          {error && <div className="bb-alert error no-print" role="alert">{error}</div>}
          {notice && <div className="bb-alert no-print" role="status">{notice}</div>}

          {/* ── Two-column Layout ───────────────────────────── */}
          <div className="qt-layout no-print">

            {/* ── Left Column ── */}
            <div className="qt-left">

              {/* Customer Card */}
              <section className="qt-card">
                <div className="qt-card-top">
                  <h2 className="qt-card-title">
                    <span className="qt-card-icon-box qt-icon-customer">
                      <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M10 10a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor"/><path d="M2.5 18c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5" stroke="currentColor"/></svg>
                    </span>
                    Customer
                  </h2>
                  <button type="button" className="qt-card-action-btn" onClick={() => { setCustomerForm({ businessName: "", contactName: "", phone: "", gstin: "", billingAddress: "", state: "Jharkhand", customerType: "Retailer" }); setShowNewCustomer(true); setEditingCustomer(false); }}>
                    + New customer
                  </button>
                </div>

                <div className="qt-search-wrap" ref={customerSearchRef}>
                  <input
                    className="qt-search-input"
                    value={customerSearch}
                    onFocus={() => setShowCustomerResults(true)}
                    onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomerId(null); setShowCustomerResults(true); setDraft((old) => ({ ...old, customer: null })); setEditingCustomer(false); setNotice(""); }}
                    onKeyDown={(e) => { if (e.key === "Escape") setShowCustomerResults(false); }}
                    placeholder="Search by name, GSTIN or phone…"
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={showCustomerResults}
                    aria-controls="bb-customer-results"
                  />
                  {showCustomerResults && (
                    <div className="bb-customer-results" id="bb-customer-results" role="listbox">
                      {customerLoading ? <span>Searching customers…</span> : (() => {
                        const term = customerSearch.trim().toLowerCase();
                        const matches = customers.filter((c) => !term || [c.businessName, c.contactName, c.phone, c.gstin, c.billingAddress, c.state].join(" ").toLowerCase().includes(term)).slice(0, 8);
                        if (matches.length) return matches.map((c) => (
                          <button type="button" role="option" aria-selected={String(customer.id) === String(c.id)} key={c.id} onMouseDown={(e) => e.preventDefault()} onClick={() => chooseCustomer(c)}>
                            <strong>{c.businessName}</strong>
                            <span>{c.contactName} · {c.phone} · {c.gstin || "No GSTIN"}</span>
                            <small>{c.billingAddress || c.state || "Select customer"}</small>
                          </button>
                        ));
                        return <span>No saved customer found. Use "New customer" to create one.</span>;
                      })()}
                    </div>
                  )}
                </div>

                {selectedCustomerId !== null && String(customer.id) === String(selectedCustomerId) && !showCustomerResults && !editingCustomer && (
                  <div className="qt-customer-card">
                    <div className="qt-customer-avatar">{(customer.company || customer.name || "?")[0].toUpperCase()}</div>
                    <div className="qt-customer-details">
                      <strong className="qt-customer-name">{customer.company || "—"}</strong>
                      {customer.gstin && <span className="qt-customer-meta">GSTIN: {customer.gstin}</span>}
                      <span className="qt-customer-meta">{customer.phone || "—"}</span>
                      {customer.address && <span className="qt-customer-meta">{customer.address}</span>}
                    </div>
                    <div className="qt-customer-card-actions">
                      <button type="button" className="bb-icon-action" title="Edit customer" aria-label="Edit customer" onClick={() => { setCustomerForm({ businessName: customer.company || "", contactName: customer.name || "", phone: customer.phone || "", gstin: customer.gstin || "", billingAddress: customer.address || "", state: customer.state || "Jharkhand", customerType: customer.customerType || "Retailer" }); setEditingCustomer(true); }}>✎</button>
                    </div>
                  </div>
                )}

                {editingCustomer && selectedCustomerId !== null && String(customer.id) === String(selectedCustomerId) && (
                  <form className="bb-customer-grid bb-new-customer-form qt-edit-form" onSubmit={updateSelectedCustomer}>
                    <label className="bb-field">Business name *<input required maxLength="200" value={customer.company || ""} onChange={(e) => setCustomer({ company: e.target.value })}/></label>
                    <label className="bb-field">Contact name *<input required maxLength="200" value={customer.name || ""} onChange={(e) => setCustomer({ name: e.target.value })}/></label>
                    <label className="bb-field">Phone *<input required maxLength="40" value={customer.phone || ""} onChange={(e) => setCustomer({ phone: e.target.value })} inputMode="tel"/></label>
                    <label className="bb-field">GSTIN<input maxLength="15" value={customer.gstin || ""} onChange={(e) => setCustomer({ gstin: e.target.value.toUpperCase() })}/></label>
                    <label className="bb-field bb-address-field">Billing address<textarea rows="2" value={customer.address || ""} onChange={(e) => setCustomer({ address: e.target.value })}/></label>
                    <label className="bb-field">State<input maxLength="100" value={customer.state || ""} onChange={(e) => setCustomer({ state: e.target.value })}/></label>
                    <label className="bb-field">Customer type<select value={customer.customerType || "Retailer"} onChange={(e) => setCustomer({ customerType: e.target.value })}><option>Retailer</option><option>Wholesaler</option><option>Other</option></select></label>
                    <div className="bb-form-actions"><button type="button" className="bb-outline-button" onClick={() => setEditingCustomer(false)}>Cancel</button><button className="bb-primary-button" disabled={savingCustomer}>{savingCustomer ? "Saving…" : "Save changes"}</button></div>
                  </form>
                )}

                {!selectedCustomerId && !showCustomerResults && (
                  <p className="bb-customer-hint">Search and select a saved customer to view their details here.</p>
                )}
              </section>

              {/* Items Card */}
              <section className="qt-card">
                <div className="qt-card-top">
                  <h2 className="qt-card-title">
                    <span className="qt-card-icon-box qt-icon-items">
                      <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M3 5h14M3 10h14M3 15h8" stroke="currentColor"/></svg>
                    </span>
                    Items {selected.length > 0 && <span className="qt-items-badge">{selected.length}</span>}
                  </h2>
                  <div className="qt-items-header-controls" ref={productPickerRef}>
                    <div className="qt-catalogue-search-wrap">
                      <input
                        className="qt-catalogue-input"
                        value={productSearch}
                        onChange={(e) => { setProductSearch(e.target.value); setShowProductPicker(true); }}
                        onFocus={() => setShowProductPicker(true)}
                        placeholder="Search catalogue…"
                      />
                      {showProductPicker && (
                        <div className="qt-product-dropdown">
                          {loadingProducts ? <p className="qt-dropdown-msg">Loading catalogue…</p> : productResults.length === 0 ? <p className="qt-dropdown-msg">No matching products.</p> : productResults.map((p) => {
                            const id = String(valueOf(p, "product_id", "Product Code"));
                            const exists = selected.some((x) => x.id === id);
                            return (
                              <button type="button" disabled={exists} key={`${id}-${valueOf(p, "modelSku", "Model / SKU")}`} onClick={() => addProduct(p)}>
                                <span><strong>{valueOf(p, "product_name", "Model / SKU") || id}</strong><small>{id} · {valueOf(p, "brand", "Brand")} · {valueOf(p, "category", "Category")}</small></span>
                                <b>{money(valueOf(p, "dealer_price", "Dealer Price"))}</b>
                                <em>{exists ? "Added" : "+ Add"}</em>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <button type="button" className="qt-add-btn" onClick={() => setShowProductPicker((v) => !v)}>
                      + Add product
                    </button>
                  </div>
                </div>

                <div className="bb-table-scroll">
                  <table className="bb-items-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Product / Model</th>
                        <th>Qty</th>
                        <th>Unit</th>
                        <th>Rate (₹)<small>{priceBasis === "exclusive" ? "Excl. GST" : "Incl. GST"}</small></th>
                        <th>Discount<small>%</small></th>
                        <th>GST %</th>
                        <th>Amount (₹)<small>{priceBasis === "exclusive" ? "Excl. GST" : "Incl. GST"}</small></th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {totals.rows.map((item, i) => (
                        <tr key={item.id}>
                          <td>{i + 1}</td>
                          <td><strong>{valueOf(item.product, "product_name", "Model / SKU") || item.id}</strong><small>{item.id} · {valueOf(item.product, "brand", "Brand")}</small></td>
                          <td><input aria-label={`Quantity ${item.id}`} type="number" min="1" step="1" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", Math.max(1, Math.floor(Number(e.target.value) || 1)))}/></td>
                          <td><select aria-label={`Unit ${item.id}`} value={item.unit || "PCS"} onChange={(e) => updateItem(item.id, "unit", e.target.value)}><option>PCS</option><option>SET</option><option>BOX</option><option>NOS</option></select></td>
                          <td><input aria-label={`Rate ${item.id}`} type="number" min="0" step="0.01" value={item.rate} onChange={(e) => updateItem(item.id, "rate", Math.max(0, Number(e.target.value) || 0))}/></td>
                          <td><input aria-label={`Discount ${item.id}`} type="number" min="0" max="100" step="0.1" value={item.discount} onChange={(e) => updateItem(item.id, "discount", Math.min(100, Math.max(0, Number(e.target.value) || 0)))}/><small>{money(item.discountAmount)}</small></td>
                          <td><select aria-label={`GST rate ${item.id}`} disabled={taxMode !== "gst"} value={item.gstRate} onChange={(e) => updateItem(item.id, "gstRate", Number(e.target.value))}>{gstRateOptions.map((r) => <option key={r} value={r}>{r}%</option>)}</select></td>
                          <td className="bb-amount-cell">{money(item.lineTotal)}</td>
                          <td><button className="bb-icon-button" type="button" aria-label={`Remove ${item.id}`} onClick={() => setSelected((rows) => rows.filter((x) => x.id !== item.id))}>×</button></td>
                        </tr>
                      ))}
                      {selected.length === 0 && (
                        <tr><td colSpan="9" className="bb-empty-row">No products added yet. Search the catalogue or click <strong>Add product</strong> to start.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <button type="button" className="qt-add-item-link" onClick={() => setShowProductPicker(true)}>
                  + Add another item
                </button>
              </section>

              {/* Notes / Details Card */}
              <section className="qt-card">
                <button type="button" className="qt-collapsible-trigger" onClick={() => setNotesExpanded((v) => !v)}>
                  <h2 className="qt-card-title">
                    <span className="qt-card-icon-box qt-icon-notes">
                      <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor"/><line x1="7" y1="7" x2="13" y2="7" stroke="currentColor"/><line x1="7" y1="11" x2="13" y2="11" stroke="currentColor"/><line x1="7" y1="15" x2="10" y2="15" stroke="currentColor"/></svg>
                    </span>
                    Quotation details &amp; notes
                  </h2>
                  <span className="qt-collapse-icon">{notesExpanded ? "⌃" : "⌄"}</span>
                </button>
                {notesExpanded && (
                  <div className="qt-notes-body">
                    <div className="qt-notes-fields">
                      <label className="bb-field">Quotation number<input value={quote.number || ""} onChange={(e) => setQuote({ number: e.target.value })}/></label>
                      <label className="bb-field">Quotation date<input type="date" value={quote.date || today()} onChange={(e) => setQuote({ date: e.target.value })}/></label>
                      <label className="bb-field">Valid for (days)<input type="number" min="1" max="365" value={quote.validDays || "7"} onChange={(e) => setQuote({ validDays: e.target.value })}/></label>
                    </div>
                    <label className="bb-field">Notes / Description<textarea rows="3" value={quote.terms || ""} onChange={(e) => setQuote({ terms: e.target.value })} placeholder="Prices are valid for the stated period. Subject to stock availability."/></label>
                  </div>
                )}
              </section>
            </div>

            {/* ── Right Sidebar ── */}
            <div className="qt-right">
              <section className="qt-card qt-summary-card">
                <div className="qt-card-top">
                  <h2 className="qt-card-title">Quotation summary</h2>
                </div>

                <div className="qt-summary-control">
                  <span className="qt-summary-label">Quotation type</span>
                  <div className="bb-segment">
                    <button type="button" className={taxMode === "gst" ? "selected" : ""} onClick={() => setTaxMode("gst")}>GST quotation</button>
                    <button type="button" className={taxMode === "non_gst" ? "selected" : ""} onClick={() => setTaxMode("non_gst")}>Non-GST quotation</button>
                  </div>
                </div>

                <div className="qt-summary-control">
                  <span className="qt-summary-label">Price basis</span>
                  <div className="bb-segment">
                    <button type="button" disabled={taxMode !== "gst"} className={priceBasis === "exclusive" ? "selected" : ""} onClick={() => setPriceBasis("exclusive")}>Excl. of GST</button>
                    <button type="button" disabled={taxMode !== "gst"} className={priceBasis === "inclusive" ? "selected" : ""} onClick={() => setPriceBasis("inclusive")}>Incl. of GST</button>
                  </div>
                </div>

                {taxMode === "gst" && (
                  <div className="qt-summary-control">
                    <span className="qt-summary-label">Supply type</span>
                    <select value={supplyType} onChange={(e) => setSupplyType(e.target.value)}>
                      <option value="intra">Intra-state (CGST + SGST)</option>
                      <option value="inter">Inter-state (IGST)</option>
                    </select>
                  </div>
                )}

                <div className="qt-summary-lines">
                  <div className="qt-summary-line"><span>Subtotal</span><b>{money(totals.subtotal)}</b></div>
                  {totals.discountTotal > 0 && <div className="qt-summary-line qt-line-discount"><span>Discount</span><b>−{money(totals.discountTotal)}</b></div>}
                  <div className="qt-summary-line"><span>Taxable value</span><b>{money(totals.taxableValue)}</b></div>
                  {taxMode === "gst" && supplyType === "intra" && (<>
                    <div className="qt-summary-line qt-line-tax"><span>CGST</span><b>{money(totals.taxTotal / 2)}</b></div>
                    <div className="qt-summary-line qt-line-tax"><span>SGST</span><b>{money(totals.taxTotal / 2)}</b></div>
                  </>)}
                  {taxMode === "gst" && supplyType === "inter" && (
                    <div className="qt-summary-line qt-line-tax"><span>IGST</span><b>{money(totals.taxTotal)}</b></div>
                  )}
                </div>

                <div className="qt-grand-total">
                  <span>Grand total</span>
                  <strong>{money(totals.grandTotal)}</strong>
                </div>

                <div className="qt-round-off">
                  <div className="qt-round-label">
                    <span>Round-off</span>
                    <label className="bb-round-toggle">
                      <input type="checkbox" checked={roundOffEnabled} onChange={(e) => setRoundOffEnabled(e.target.checked)} /> Apply
                    </label>
                  </div>
                  {roundOffEnabled && (
                    <input className="bb-round-input" type="number" step="0.01" value={roundOff} onChange={(e) => setRoundOff(e.target.value)} />
                  )}
                </div>

                {taxMode === "gst" && (
                  <div className="qt-info-note">
                    ⓘ GST is calculated per product rate. Verify before issuing.
                  </div>
                )}

                <div className="qt-summary-footer">
                  <button type="button" className="bb-plain-button bb-clear-btn" onClick={clearQuotation}>
                    <svg viewBox="0 0 16 16" fill="none" width="13" height="13" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:"middle",marginRight:5}}><line x1="4" y1="4" x2="12" y2="12" stroke="currentColor"/><line x1="12" y1="4" x2="4" y2="12" stroke="currentColor"/></svg>
                    Clear items
                  </button>
                </div>
              </section>
            </div>
          </div>

          {/* ── New Customer Modal ── */}
          {showNewCustomer && (
            <div className="bb-customer-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !savingCustomer) setShowNewCustomer(false); }}>
              <section className="bb-customer-modal" role="dialog" aria-modal="true" aria-labelledby="bb-new-customer-title">
                <div className="bb-customer-modal-heading">
                  <div><h2 id="bb-new-customer-title">Add new customer</h2><p>Enter the customer details below.</p></div>
                  <button type="button" className="bb-modal-close" aria-label="Close" onClick={() => !savingCustomer && setShowNewCustomer(false)}>×</button>
                </div>
                <form className="bb-customer-grid bb-new-customer-form" onSubmit={saveCustomer}>
                  <label className="bb-field">Business name *<input required maxLength="200" value={customerForm.businessName} onChange={(e) => setCustomerForm({ ...customerForm, businessName: e.target.value })}/></label>
                  <label className="bb-field">Contact name *<input required maxLength="200" value={customerForm.contactName} onChange={(e) => setCustomerForm({ ...customerForm, contactName: e.target.value })}/></label>
                  <label className="bb-field">Phone *<input required maxLength="40" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} inputMode="tel"/></label>
                  <label className="bb-field">GSTIN<input maxLength="15" value={customerForm.gstin} onChange={(e) => setCustomerForm({ ...customerForm, gstin: e.target.value.toUpperCase() })}/></label>
                  <label className="bb-field bb-address-field">Billing address<textarea rows="2" value={customerForm.billingAddress} onChange={(e) => setCustomerForm({ ...customerForm, billingAddress: e.target.value })}/></label>
                  <label className="bb-field">State<input maxLength="100" value={customerForm.state} onChange={(e) => setCustomerForm({ ...customerForm, state: e.target.value })}/></label>
                  <label className="bb-field">Customer type<select value={customerForm.customerType} onChange={(e) => setCustomerForm({ ...customerForm, customerType: e.target.value })}><option>Retailer</option><option>Wholesaler</option><option>Other</option></select></label>
                  <div className="bb-form-actions"><button type="button" className="bb-outline-button" onClick={() => setShowNewCustomer(false)} disabled={savingCustomer}>Cancel</button><button className="bb-primary-button" disabled={savingCustomer}>{savingCustomer ? "Saving…" : "Save customer"}</button></div>
                </form>
              </section>
            </div>
          )}

          {/* ── Print Document ── */}
          <article className="bb-print-document"><header><div className="bb-print-brand"><div className="bb-print-mark">BB</div><div><h1>{supplier.businessName || "Bharat Batteries"}</h1><p>{supplier.tagline}</p><p>{supplier.address}</p><p>Phone: {supplier.phone || "—"} · {supplier.email || "—"}</p><p>GSTIN: {supplier.gstin || "—"}</p></div></div><div className="bb-print-label"><h2>ESTIMATE / QUOTATION</h2><p>No: {quote.number}</p><p>Date: {quote.date}</p><p>Valid: {quote.validDays} days</p></div></header><section className="bb-print-customer"><strong>QUOTATION FOR</strong><h3>{customer.company || "Customer"}</h3><p>{customer.name} · {customer.phone}</p><p>{customer.address}</p>{customer.gstin && <p>GSTIN: {customer.gstin}</p>}</section><table><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Rate</th><th>Discount</th>{taxMode === "gst" && <th>GST</th>}<th>Amount</th></tr></thead><tbody>{totals.rows.map((r,i)=><tr key={r.id}><td>{i+1}</td><td>{valueOf(r.product,"product_name","Model / SKU")}<small>{r.id} · {valueOf(r.product,"brand","Brand")}</small></td><td>{r.qty} {r.unit}</td><td>{money(r.rate)}</td><td>{r.discountPercent}%</td>{taxMode === "gst" && <td>{r.gstRate}%</td>}<td>{money(r.lineTotal)}</td></tr>)}</tbody></table><div className="bb-print-total"><p>Subtotal: {money(totals.subtotal)}</p><p>Discount: {money(totals.discountTotal)}</p><p>Taxable value: {money(totals.taxableValue)}</p>{taxMode === "gst" && <p>GST: {money(totals.taxTotal)}</p>}<h2>Grand total: {money(totals.grandTotal)}</h2></div><section className="bb-print-terms"><strong>Notes / Terms</strong><p>{quote.terms || "Subject to availability."}</p></section><footer>For {supplier.businessName || "Bharat Batteries"}<br/><br/>Authorised Signatory</footer></article>

        </div>
      </div>
    </div>
  );
}
