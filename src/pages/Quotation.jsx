import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import { getProducts } from "../services/productService";
import "../Quotation.css";

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value) || 0);
const field = (product, alias, key) => product?.[alias] ?? product?.[key] ?? "";
const validNumber = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));

export default function Quotation({ activePage = "Quotation", onNavigate = () => {} }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [customer, setCustomer] = useState({ name: "", company: "", phone: "", gstin: "", address: "" });
  const [quote, setQuote] = useState({ number: `QTN-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`, date: new Date().toISOString().slice(0, 10), validDays: "7", terms: "Prices are valid for the period mentioned above. Goods are subject to availability." });
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    getProducts().then((items) => { if (active) setProducts(items); })
      .catch((error) => { if (active) setLoadError(error?.message || "Could not load products."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products.slice(0, 5);
    return products.filter((p) => [field(p,"product_id","Product Code"), field(p,"product_name","Model / SKU"), field(p,"brand","Brand"), field(p,"category","Category")].join(" ").toLowerCase().includes(term)).slice(0, 5);
  }, [products, search]);

  const addProduct = (product) => {
    const id = String(field(product, "product_id", "Product Code"));
    if (selected.some((item) => item.id === id)) { setNotice("This product is already in the quotation."); return; }
    if (!validNumber(field(product, "dealer_price", "Dealer Price"))) { setNotice("This product has no valid dealer price, so it cannot be added."); return; }
    setSelected((items) => [...items, { id, product, quantity: 1, margin: 10 }]);
    setSearch(""); setNotice("");
  };
  const updateItem = (id, key, value) => setSelected((items) => items.map((item) => item.id === id ? { ...item, [key]: value } : item));
  const totals = useMemo(() => selected.reduce((acc, item) => {
    const dp = Number(field(item.product, "dealer_price", "Dealer Price"));
    const margin = Number(item.margin) || 0;
    const qty = Number(item.quantity) || 0;
    const unit = dp * (1 + margin / 100);
    const base = unit * qty;
    const rawGst = field(item.product, "gst_rate", "GST Rate %");
    const gstValid = validNumber(rawGst) && Number(rawGst) >= 0;
    const gst = gstValid ? base * Number(rawGst) / 100 : 0;
    acc.subtotal += base; acc.gst += gst; acc.grand += base + gst;
    if (!gstValid) acc.missingGst.push(String(field(item.product, "product_name", "Model / SKU") || item.id));
    acc.rows.push({ ...item, dp, margin, qty, unit, base, gstRate: gstValid ? Number(rawGst) : null, gst });
    return acc;
  }, { subtotal: 0, gst: 0, grand: 0, missingGst: [], rows: [] }), [selected]);

  const updateCustomer = (key, value) => setCustomer((data) => ({ ...data, [key]: value }));
  const printQuote = () => {
    if (!selected.length) { setNotice("Add at least one product before generating a quotation."); return; }
    if (!customer.name.trim() || !customer.company.trim() || !customer.phone.trim()) { setNotice("Please enter customer name, company and phone number."); return; }
    if (totals.missingGst.length) { setNotice("Add verified GST rates in the Excel master for all selected products before generating the final quotation."); return; }
    setNotice(""); window.print();
  };

  return <div className="app-layout">
    <Sidebar activePage={activePage} onNavigate={onNavigate} />
    <div className="main-area quotation-area">
      <header className="topbar quotation-topbar"><div className="mobile-brand">Bharat Batteries</div><div className="topbar-title">Wholesale Quotation</div><div className="connection-indicator"><span className="status-dot"/> Excel product catalogue</div></header>
      <main className="page-content quotation-content">
        <div className="page-heading quotation-heading"><div><div className="eyebrow">SALES WORKSPACE</div><h1>Create quotation</h1><p>Build a customer quotation with product-wise margin and GST.</p></div><button className="secondary-button no-print" onClick={() => { setSelected([]); setNotice(""); }}>Clear quotation</button></div>
        {loadError && <div className="quote-alert error">Could not load products: {loadError}. Check that the n8n product webhook is running.</div>}
        {notice && <div className="quote-alert" role="status">{notice}</div>}
        <section className="quote-layout">
          <div className="quote-main-column">
            <section className="panel quote-panel no-print">
              <div className="quote-section-title"><span className="step-number">1</span><div><h2>Customer details</h2><p>Enter who this quotation is for.</p></div></div>
              <div className="quote-form-grid">
                <label>Customer name *<input value={customer.name} onChange={e=>updateCustomer("name",e.target.value)} placeholder="e.g. Rahul Kumar" /></label>
                <label>Company name *<input value={customer.company} onChange={e=>updateCustomer("company",e.target.value)} placeholder="e.g. Rahul Electricals" /></label>
                <label>Phone number *<input value={customer.phone} onChange={e=>updateCustomer("phone",e.target.value)} inputMode="tel" placeholder="Contact number" /></label>
                <label>GSTIN<input value={customer.gstin} onChange={e=>updateCustomer("gstin",e.target.value.toUpperCase())} placeholder="Optional GSTIN" maxLength={15} /></label>
                <label className="full-width">Billing address<input value={customer.address} onChange={e=>updateCustomer("address",e.target.value)} placeholder="Street, city, state and PIN code" /></label>
              </div>
            </section>
            <section className="panel quote-panel no-print">
              <div className="quote-section-title"><span className="step-number">2</span><div><h2>Add products</h2><p>Search the existing catalogue and add the items you need.</p></div></div>
              <div className="quote-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search product name, code, brand..." aria-label="Search products to add" /></div>
              <div className="quote-product-results">
                {loading ? <p className="quote-muted">Loading products from Excel-backed catalogue…</p> : results.length === 0 ? <p className="quote-muted">No matching products. Try another search.</p> : results.map((p) => {
                  const id = String(field(p,"product_id","Product Code")); const already = selected.some(item=>item.id===id);
                  return <div className="quote-product-result" key={id}><div className="quote-product-info"><strong>{field(p,"product_name","Model / SKU") || "Unnamed product"}</strong><span>{id} · {field(p,"brand","Brand")} · {field(p,"category","Category")}</span></div><div className="quote-product-price">{money(field(p,"dealer_price","Dealer Price"))}<small>Dealer price</small></div><button className="primary-button add-button" disabled={already} onClick={()=>addProduct(p)}>{already ? "Added" : "+ Add"}</button></div>;
                })}
              </div>
            </section>
            <section className="panel quote-panel">
              <div className="quote-section-title"><span className="step-number">3</span><div><h2>Quotation items <span className="item-count">{selected.length} selected</span></h2><p>Add as many products as needed; search suggestions show up to five matches at a time.</p></div></div>
              {selected.length === 0 ? <div className="quote-empty"><span>＋</span><strong>No products added yet</strong><p>Search above and click Add to start your quotation.</p></div> : <div className="quote-items-list">{totals.rows.map((item) => <div className="quote-item-card" key={item.id}><div className="quote-item-head"><div><strong>{field(item.product,"product_name","Model / SKU") || item.id}</strong><span>{item.id} · {field(item.product,"brand","Brand")}</span></div><button className="text-button no-print" onClick={()=>setSelected(items=>items.filter(row=>row.id!==item.id))}>Remove</button></div><div className="quote-item-controls"><label>Qty<input type="number" min="1" step="1" value={item.quantity} onChange={e=>updateItem(item.id,"quantity",Math.max(1,Math.floor(Number(e.target.value)||1)))}/></label><label>Margin %<input type="number" min="1" max="20" step="0.5" value={item.margin} onChange={e=>updateItem(item.id,"margin",Math.min(20,Math.max(1,Number(e.target.value)||1)))}/></label><div><span>Dealer price</span><strong>{money(item.dp)}</strong></div><div><span>Selling price / unit</span><strong>{money(item.unit)}</strong></div><div><span>GST rate</span><strong>{item.gstRate === null ? <span className="missing-gst">Missing</span> : `${item.gstRate}%`}</strong></div><div><span>Line total before GST</span><strong>{money(item.base)}</strong></div></div></div>)}</div>}
            </section>
            <section className="panel quote-panel no-print">
              <div className="quote-section-title"><span className="step-number">4</span><div><h2>Quotation settings</h2><p>Set the reference number and validity period.</p></div></div>
              <div className="quote-form-grid"><label>Quotation number<input value={quote.number} onChange={e=>setQuote(q=>({...q,number:e.target.value}))}/></label><label>Quotation date<input type="date" value={quote.date} onChange={e=>setQuote(q=>({...q,date:e.target.value}))}/></label><label>Valid for (days)<input type="number" min="1" value={quote.validDays} onChange={e=>setQuote(q=>({...q,validDays:e.target.value}))}/></label><label className="full-width">Terms & conditions<textarea rows="3" value={quote.terms} onChange={e=>setQuote(q=>({...q,terms:e.target.value}))}/></label></div>
            </section>
            <div className="quote-actions no-print"><button className="secondary-button" onClick={()=>window.print()}>Print preview</button><button className="primary-button generate-button" onClick={printQuote}>Generate / Download PDF ↗</button></div>
          </div>
          <aside className="quote-preview-wrap">
            <div className="preview-heading no-print"><div><h2>Live preview</h2><p>Updates as you edit the quotation.</p></div><span className="preview-live"><i/> LIVE</span></div>
            <article className="quote-document" id="quotation-document">
              <div className="document-brand"><div className="document-mark">BB</div><div><strong>BHARAT BATTERIES</strong><span>Exide & Microtek Products</span></div><div className="document-quotation-label">QUOTATION</div></div>
              <div className="document-meta"><div><span>QUOTATION NO.</span><strong>{quote.number || "—"}</strong></div><div><span>DATE</span><strong>{quote.date || "—"}</strong></div><div><span>VALIDITY</span><strong>{quote.validDays || "—"} days</strong></div></div>
              <div className="document-customer"><span>QUOTATION FOR</span><strong>{customer.company || "Customer company name"}</strong><p>{customer.name || "Customer name"}</p>{customer.phone && <p>Phone: {customer.phone}</p>}{customer.gstin && <p>GSTIN: {customer.gstin}</p>}{customer.address && <p>{customer.address}</p>}</div>
              <div className="document-table-wrap"><table className="document-table"><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>GST</th><th className="align-right">Amount</th></tr></thead><tbody>{totals.rows.length ? totals.rows.map(item=><tr key={item.id}><td><strong>{field(item.product,"product_name","Model / SKU") || item.id}</strong><small>{item.id} · HSN {field(item.product,"hsn","HSN") || "—"}</small></td><td>{item.qty}</td><td>{money(item.unit)}</td><td>{item.gstRate === null ? "Missing" : `${item.gstRate}%`}</td><td className="align-right">{money(item.base)}</td></tr>) : <tr><td colSpan="5" className="document-empty">Your selected products will appear here.</td></tr>}</tbody></table></div>
              <div className="document-totals"><div><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div><div><span>GST total</span><strong>{money(totals.gst)}</strong></div><div className="document-grand"><span>Grand total</span><strong>{money(totals.grand)}</strong></div>{totals.missingGst.length > 0 && <p className="document-warning">GST rate missing for {totals.missingGst.length} item(s). Complete the master data before finalizing.</p>}</div>
              <div className="document-terms"><strong>Terms & conditions</strong><p>{quote.terms || "—"}</p></div>
              <div className="document-signature"><span>For Bharat Batteries</span><div className="signature-line"/><strong>Authorised Signatory</strong></div>
              <footer className="document-footer">Thank you for your business.</footer>
            </article>
            <p className="preview-note no-print">PDF uses your browser's print dialog. Choose <strong>Save as PDF</strong> to download.</p>
          </aside>
        </section>
      </main>
    </div>
  </div>;
}
