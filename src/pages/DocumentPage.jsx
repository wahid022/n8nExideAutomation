import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { api } from "../lib/api";
import { QK } from "../lib/queryKeys";
import { money, today } from "../lib/formatters";
import { useDebounce } from "../hooks/useDebounce";
import { getProducts } from "../services/productService";
import "../Quotation.css";

const DOC_CONFIG = {
  "sales-invoice": {
    title: "Sales Invoice",
    shortName: "Invoice",
    eyebrow: "SALES MODULE",
    activePage: "Sales Invoice",
    partyLabel: "Customer",
    partyApiPath: "/customers",
    partyKey: "customer",
    docNumPrefix: "SINV",
    docNumKey: "invoiceNumber",
    docDateKey: "invoiceDate",
    dateLabel: "Invoice date",
    extraDateKey: "dueDate",
    extraDateLabel: "Due date",
    apiPath: "/sales/invoices",
    listRoute: "/sales/invoices",
    invalidateKeys: [QK.salesInvoices, QK.salesSummary],
    defaultGst: 18,
  },
  "sales-order": {
    title: "Sales Order",
    shortName: "Order",
    eyebrow: "SALES MODULE",
    activePage: "Sales Order",
    partyLabel: "Customer",
    partyApiPath: "/customers",
    partyKey: "customer",
    docNumPrefix: "SO",
    docNumKey: "orderNumber",
    docDateKey: "orderDate",
    dateLabel: "Order date",
    extraDateKey: null,
    extraDateLabel: null,
    apiPath: "/sales/orders",
    listRoute: "/sales/orders",
    invalidateKeys: [QK.salesOrders, QK.salesSummary],
    defaultGst: 18,
  },
  "purchase-invoice": {
    title: "Purchase Invoice",
    shortName: "Invoice",
    eyebrow: "PURCHASE MODULE",
    activePage: "Purchase Invoice",
    partyLabel: "Vendor",
    partyApiPath: "/vendors",
    partyKey: "vendor",
    docNumPrefix: "PINV",
    docNumKey: "invoiceNumber",
    docDateKey: "invoiceDate",
    dateLabel: "Invoice date",
    extraDateKey: "dueDate",
    extraDateLabel: "Due date",
    apiPath: "/purchase/invoices",
    listRoute: "/purchase/invoices",
    invalidateKeys: [QK.purchaseInvoices, QK.purchaseSummary],
    defaultGst: 28,
  },
  "purchase-order": {
    title: "Purchase Order",
    shortName: "Order",
    eyebrow: "PURCHASE MODULE",
    activePage: "Purchase Order",
    partyLabel: "Vendor",
    partyApiPath: "/vendors",
    partyKey: "vendor",
    docNumPrefix: "PO",
    docNumKey: "orderNumber",
    docDateKey: "orderDate",
    dateLabel: "Order date",
    extraDateKey: "expectedDelivery",
    extraDateLabel: "Expected delivery",
    apiPath: "/purchase/orders",
    listRoute: "/purchase/orders",
    invalidateKeys: [QK.purchaseOrders, QK.purchaseSummary],
    defaultGst: 28,
  },
};

const GST_OPTIONS = [0, 5, 12, 18, 28];

const makeItem = (gst = 18) => ({
  productName: "",
  productCode: "",
  brand: "",
  quantity: 1,
  unit: "PCS",
  unitPrice: 0,
  discountPercent: 0,
  taxPercent: gst,
});

export default function DocumentPage({ docType }) {
  const cfg = DOC_CONFIG[docType];
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;

  const partyRef = useRef(null);
  const productPickerRef = useRef(null);
  const initialized = useRef(false);

  // Form fields
  const [docNumber, setDocNumber] = useState("");
  const [docDate, setDocDate] = useState(today());
  const [extraDate, setExtraDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);

  // Party (customer or vendor)
  const [partySearch, setPartySearch] = useState("");
  const [selectedParty, setSelectedParty] = useState(null);
  const [showPartyResults, setShowPartyResults] = useState(false);
  const [partyResults, setPartyResults] = useState([]);
  const [partyLoading, setPartyLoading] = useState(false);
  const debouncedPartySearch = useDebounce(partySearch, 250);

  // Product catalogue & search
  const [catalogue, setCatalogue] = useState([]);
  const [catalogueError, setCatalogueError] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Summary sidebar — same controls as Quotation
  const [taxMode, setTaxMode] = useState("gst");          // "gst" | "non_gst"
  const [priceBasis, setPriceBasis] = useState("exclusive"); // "exclusive" | "inclusive"
  const [supplyType, setSupplyType] = useState("intra");   // "intra" | "inter"
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);
  const [roundOff, setRoundOff] = useState("0");

  // UI
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Populate form from location.state (edit) or set defaults (new)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const doc = location.state?.doc;
    if (isEdit && doc) {
      setDocNumber(doc[cfg.docNumKey] || "");
      setDocDate(String(doc[cfg.docDateKey] || today()).slice(0, 10));
      if (cfg.extraDateKey) setExtraDate(String(doc[cfg.extraDateKey] || "").slice(0, 10));
      setNotes(doc.notes || "");
      const party = doc[cfg.partyKey] || null;
      if (party) { setSelectedParty(party); setPartySearch(party.businessName || party.contactName || ""); }
      const settings = doc.settings || {};
      // Priority: nested settings → top-level field → infer from items (all taxPercent=0 → non_gst)
      const restoredTaxMode = settings.taxMode || doc.taxMode ||
        (Array.isArray(doc.items) && doc.items.length > 0 && doc.items.every((x) => Number(x.taxPercent) === 0) ? "non_gst" : null);
      if (restoredTaxMode)     setTaxMode(restoredTaxMode);
      if (settings.priceBasis) setPriceBasis(settings.priceBasis);
      if (settings.supplyType) setSupplyType(settings.supplyType);
      if (Array.isArray(doc.items) && doc.items.length > 0) {
        setItems(doc.items.map((x) => ({
          ...makeItem(cfg.defaultGst), ...x,
          quantity: Number(x.quantity || 1),
          unitPrice: Number(x.unitPrice || 0),
          discountPercent: Number(x.discountPercent || 0),
          taxPercent: Number(x.taxPercent ?? cfg.defaultGst),
          unit: x.unit || "PCS",
        })));
      }
    } else if (!isEdit) {
      setDocNumber(`${cfg.docNumPrefix}-${Date.now().toString().slice(-8)}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load full product catalogue on mount
  useEffect(() => {
    let active = true;
    getProducts()
      .then((rows) => { if (active) setCatalogue(rows); })
      .catch((e) => { if (active) setCatalogueError(e?.message || "Unable to load product catalogue."); });
    return () => { active = false; };
  }, []);

  // Party search — always fetch (empty search returns initial list)
  useEffect(() => {
    let active = true;
    setPartyLoading(true);
    api(`${cfg.partyApiPath}?search=${encodeURIComponent(debouncedPartySearch)}`)
      .then((r) => { if (active) setPartyResults(r.data || []); })
      .catch(() => { if (active) setPartyResults([]); })
      .finally(() => { if (active) setPartyLoading(false); });
    return () => { active = false; };
  }, [debouncedPartySearch, cfg.partyApiPath]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (partyRef.current && !partyRef.current.contains(e.target)) setShowPartyResults(false);
      if (productPickerRef.current && !productPickerRef.current.contains(e.target)) setShowProductPicker(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  // Filtered product results (client-side)
  const productResults = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    return catalogue
      .filter((p) => !term || [
        p.productCode || p["Product Code"],
        p.brand, p.modelSku || p["Model / SKU"],
        p.category, p.specsCapacity || p["Specs / Capacity"],
      ].filter(Boolean).join(" ").toLowerCase().includes(term))
      .slice(0, 30);
  }, [catalogue, productSearch]);

  const addProduct = (p) => {
    const code  = p.productCode || p["Product Code"] || "";
    if (code && items.some((x) => x.productCode === code)) { setNotice("This product is already in the list."); return; }
    const name  = [p.brand, p.modelSku || p["Model / SKU"], p.specsCapacity || p["Specs / Capacity"]].filter(Boolean).join(" ") || code;
    const rate  = Number(p.dealerPrice ?? p.dealer_price ?? 0);
    const gst   = Number(p.gstRate ?? p.gst_rate ?? cfg.defaultGst);
    setItems((prev) => [...prev, { productName: name, productCode: code, brand: p.brand || "", quantity: 1, unit: "PCS", unitPrice: rate, discountPercent: 0, taxPercent: gst }]);
    setProductSearch(""); setShowProductPicker(false); setNotice("");
  };

  // Totals — identical logic to Quotation.jsx (adapted for unitPrice / taxPercent keys)
  const totals = useMemo(() => {
    const rows = items.map((item) => {
      const qty            = Math.max(1, Number(item.quantity) || 1);
      const rate           = Math.max(0, Number(item.unitPrice) || 0);
      const discountPct    = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
      const gross          = qty * rate;
      const discountAmount = gross * discountPct / 100;
      const afterDiscount  = gross - discountAmount;
      const gstRate        = Math.max(0, Number(item.taxPercent) || 0);
      const embeddedTax    = taxMode === "gst" && priceBasis === "inclusive" ? afterDiscount * gstRate / (100 + gstRate) : 0;
      const taxable        = taxMode === "gst" && priceBasis === "inclusive" ? afterDiscount - embeddedTax : afterDiscount;
      const tax            = taxMode === "gst" ? (priceBasis === "inclusive" ? embeddedTax : taxable * gstRate / 100) : 0;
      const lineTotal      = taxMode === "gst" && priceBasis === "inclusive" ? afterDiscount : taxable + tax;
      return { ...item, gross, discountAmount, taxable, tax, lineTotal };
    });
    const subtotal     = rows.reduce((n, r) => n + r.gross, 0);
    const discountTotal = rows.reduce((n, r) => n + r.discountAmount, 0);
    const taxableValue  = rows.reduce((n, r) => n + r.taxable, 0);
    const taxTotal      = rows.reduce((n, r) => n + r.tax, 0);
    const rawTotal      = rows.reduce((n, r) => n + r.lineTotal, 0);
    const finalTotal    = roundOffEnabled ? Math.round(rawTotal + (Number(roundOff) || 0)) : rawTotal;
    return { rows, subtotal, discountTotal, taxableValue, taxTotal, rawTotal, roundOffAmount: finalTotal - rawTotal, grandTotal: finalTotal };
  }, [items, taxMode, priceBasis, roundOffEnabled, roundOff]);

  const updateItem = (i, k, v) => setItems((prev) => prev.map((x, j) => i === j ? { ...x, [k]: v } : x));

  const save = async () => {
    if (!selectedParty) { setError(`Select a ${cfg.partyLabel.toLowerCase()} first.`); return; }
    if (!docNumber.trim()) { setError("Document number is required."); return; }
    if (items.length === 0) { setError("Add at least one product before saving."); return; }
    setError(""); setNotice(""); setBusy(true);
    try {
      const payloadItems = items.map((item) => ({
        ...item,
        taxPercent: taxMode === "non_gst" ? 0 : item.taxPercent,
      }));
      const payload = {
        [cfg.docNumKey]: docNumber,
        [cfg.partyKey]: selectedParty,
        [cfg.docDateKey]: docDate,
        taxMode,       // top-level so backends that ignore nested `settings` still store it
        priceBasis,
        supplyType,
        items: payloadItems,
        notes,
        settings: { taxMode, priceBasis, supplyType },
      };
      if (cfg.extraDateKey && extraDate) payload[cfg.extraDateKey] = extraDate;
      await api(isEdit ? `${cfg.apiPath}/${id}` : cfg.apiPath, {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      cfg.invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      navigate(cfg.listRoute, { replace: true });
    } catch (e) {
      setError(e.message || "Unable to save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const priceBasisLabel = priceBasis === "exclusive" ? "Excl. GST" : "Incl. GST";

  return (
    <div className="sales-page-shell">
      <Sidebar activePage={cfg.activePage} />
      <div className="sales-main quotation-area">
        <Topbar />
        <div className="quotation-content">

          {/* Page header */}
          <div className="qt-page-header no-print">
            <div>
              <span className="bb-quote-eyebrow">{cfg.eyebrow}</span>
              <h1>{isEdit ? `Edit ${cfg.title}` : `New ${cfg.title}`}</h1>
              <p>{isEdit ? `Update the ${cfg.title.toLowerCase()} details below.` : `Fill in the details to create a new ${cfg.title.toLowerCase()}.`}</p>
            </div>
            <div className="qt-header-actions">
              <button type="button" className="bb-outline-button" onClick={() => navigate(cfg.listRoute)}>Cancel</button>
              <button type="button" className="bb-primary-button" disabled={busy} onClick={save}>
                {busy ? "Saving…" : isEdit ? "Save changes" : `Save ${cfg.title}`}
              </button>
            </div>
          </div>

          {catalogueError && <div className="bb-alert error no-print">Product catalogue: {catalogueError}</div>}
          {error  && <div className="bb-alert error no-print" role="alert">{error}</div>}
          {notice && <div className="bb-alert no-print" role="status">{notice}</div>}

          <div className="qt-layout no-print">

            {/* ── Left column ── */}
            <div className="qt-left">

              {/* Party card */}
              <section className="qt-card">
                <div className="qt-card-top">
                  <h2 className="qt-card-title">
                    <span className="qt-card-icon-box qt-icon-customer">
                      <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                        <path d="M10 10a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor"/>
                        <path d="M2.5 18c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5" stroke="currentColor"/>
                      </svg>
                    </span>
                    {cfg.partyLabel}
                  </h2>
                </div>

                <div className="qt-search-wrap" ref={partyRef}>
                  <input
                    className="qt-search-input"
                    value={partySearch}
                    onFocus={() => setShowPartyResults(true)}
                    onChange={(e) => { setPartySearch(e.target.value); setSelectedParty(null); setShowPartyResults(true); }}
                    onKeyDown={(e) => { if (e.key === "Escape") setShowPartyResults(false); }}
                    placeholder={`Search ${cfg.partyLabel.toLowerCase()} by name or phone…`}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={showPartyResults}
                    aria-controls="dp-party-results"
                  />
                  {showPartyResults && (
                    <div className="bb-customer-results" id="dp-party-results" role="listbox">
                      {partyLoading ? (
                        <span>Searching…</span>
                      ) : partyResults.length > 0 ? (
                        partyResults.slice(0, 8).map((p) => (
                          <button key={p.id} type="button" role="option"
                            aria-selected={String(selectedParty?.id) === String(p.id)}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setSelectedParty(p); setPartySearch(p.businessName || p.contactName || ""); setShowPartyResults(false); setNotice(""); }}
                          >
                            <strong>{p.businessName}</strong>
                            <span>{p.contactName} · {p.phone}</span>
                            <small>{p.gstin || "No GSTIN"} · {p.state || ""}</small>
                          </button>
                        ))
                      ) : (
                        <span>No {cfg.partyLabel.toLowerCase()} found.</span>
                      )}
                    </div>
                  )}
                </div>

                {selectedParty && !showPartyResults && (
                  <div className="qt-customer-card">
                    <div className="qt-customer-avatar">{(selectedParty.businessName || "?")[0].toUpperCase()}</div>
                    <div className="qt-customer-details">
                      <strong className="qt-customer-name">{selectedParty.businessName}</strong>
                      {selectedParty.gstin && <span className="qt-customer-meta">GSTIN: {selectedParty.gstin}</span>}
                      <span className="qt-customer-meta">{selectedParty.phone}</span>
                      {selectedParty.billingAddress && <span className="qt-customer-meta">{selectedParty.billingAddress}</span>}
                    </div>
                    <div className="qt-customer-card-actions">
                      <button type="button" className="bb-icon-action" title={`Change ${cfg.partyLabel.toLowerCase()}`}
                        onClick={() => { setSelectedParty(null); setPartySearch(""); setShowPartyResults(true); }}>✎</button>
                    </div>
                  </div>
                )}

                {!selectedParty && !showPartyResults && (
                  <p className="bb-customer-hint">Search and select a {cfg.partyLabel.toLowerCase()} to continue.</p>
                )}
              </section>

              {/* Items card — Quotation-style catalogue search */}
              <section className="qt-card">
                <div className="qt-card-top">
                  <h2 className="qt-card-title">
                    <span className="qt-card-icon-box qt-icon-items">
                      <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                        <path d="M3 5h14M3 10h14M3 15h8" stroke="currentColor"/>
                      </svg>
                    </span>
                    Items {items.length > 0 && <span className="qt-items-badge">{items.length}</span>}
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
                          {catalogue.length === 0 ? (
                            <p className="qt-dropdown-msg">Loading catalogue…</p>
                          ) : productResults.length === 0 ? (
                            <p className="qt-dropdown-msg">No matching products.</p>
                          ) : productResults.map((p) => {
                            const code   = p.productCode || p["Product Code"] || "";
                            const name   = [p.brand, p.modelSku || p["Model / SKU"], p.specsCapacity || p["Specs / Capacity"]].filter(Boolean).join(" ") || code;
                            const price  = p.dealerPrice ?? p.dealer_price;
                            const exists = code && items.some((x) => x.productCode === code);
                            return (
                              <button type="button" disabled={exists} key={`${code}-${name}`} onClick={() => addProduct(p)}>
                                <span><strong>{name}</strong><small>{code} · {p.brand} · {p.category}</small></span>
                                <b>{money(price)}</b>
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
                        <th>Rate (₹)<small>{priceBasisLabel}</small></th>
                        <th>Discount<small>%</small></th>
                        <th>GST %</th>
                        <th>Amount (₹)<small>{priceBasisLabel}</small></th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {totals.rows.map((item, i) => (
                        <tr key={`${item.productCode}-${i}`}>
                          <td>{i + 1}</td>
                          <td>
                            <strong>{item.productName || "—"}</strong>
                            {(item.productCode || item.brand) && <small>{[item.productCode, item.brand].filter(Boolean).join(" · ")}</small>}
                          </td>
                          <td>
                            <input aria-label={`Quantity ${i + 1}`} type="number" min="1" step="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(i, "quantity", Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
                          </td>
                          <td>
                            <select aria-label={`Unit ${i + 1}`} value={item.unit || "PCS"} onChange={(e) => updateItem(i, "unit", e.target.value)}>
                              <option>PCS</option><option>SET</option><option>BOX</option><option>NOS</option>
                            </select>
                          </td>
                          <td>
                            <input aria-label={`Rate ${i + 1}`} type="number" min="0" step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => updateItem(i, "unitPrice", Math.max(0, Number(e.target.value) || 0))} />
                          </td>
                          <td>
                            <input aria-label={`Discount ${i + 1}`} type="number" min="0" max="100" step="0.1"
                              value={item.discountPercent}
                              onChange={(e) => updateItem(i, "discountPercent", Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
                            <small>{money(item.discountAmount)}</small>
                          </td>
                          <td>
                            <select aria-label={`GST rate ${i + 1}`} disabled={taxMode !== "gst"}
                              value={item.taxPercent}
                              onChange={(e) => updateItem(i, "taxPercent", Number(e.target.value))}>
                              {GST_OPTIONS.map((r) => <option key={r} value={r}>{r}%</option>)}
                            </select>
                          </td>
                          <td className="bb-amount-cell">{money(item.lineTotal)}</td>
                          <td>
                            <button type="button" className="bb-icon-button" aria-label={`Remove item ${i + 1}`}
                              onClick={() => setItems((prev) => prev.filter((_, j) => i !== j))}>×</button>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr><td colSpan="9" className="bb-empty-row">No products added yet. Search the catalogue or click <strong>Add product</strong> to start.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <button type="button" className="qt-add-item-link" onClick={() => setShowProductPicker(true)}>
                  + Add another item
                </button>
              </section>

              {/* Document details card */}
              <section className="qt-card">
                <button type="button" className="qt-collapsible-trigger" style={{ cursor: "default", pointerEvents: "none" }}>
                  <h2 className="qt-card-title">
                    <span className="qt-card-icon-box qt-icon-notes">
                      <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                        <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor"/>
                        <line x1="7" y1="7" x2="13" y2="7" stroke="currentColor"/>
                        <line x1="7" y1="11" x2="13" y2="11" stroke="currentColor"/>
                        <line x1="7" y1="15" x2="10" y2="15" stroke="currentColor"/>
                      </svg>
                    </span>
                    {cfg.title} details &amp; notes
                  </h2>
                </button>
                <div className="qt-notes-body">
                  <div className="qt-notes-fields">
                    <label className="bb-field">Document number *<input required value={docNumber} onChange={(e) => setDocNumber(e.target.value)} /></label>
                    <label className="bb-field">{cfg.dateLabel} *<input type="date" required value={docDate} onChange={(e) => setDocDate(e.target.value)} /></label>
                    {cfg.extraDateKey && (
                      <label className="bb-field">{cfg.extraDateLabel}<input type="date" value={extraDate} onChange={(e) => setExtraDate(e.target.value)} /></label>
                    )}
                  </div>
                  <label className="bb-field">Notes / Terms<textarea rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes or terms…" /></label>
                </div>
              </section>

            </div>

            {/* ── Right sidebar — identical layout to Quotation ── */}
            <div className="qt-right">
              <section className="qt-card qt-summary-card">
                <div className="qt-card-top">
                  <h2 className="qt-card-title">{cfg.title} summary</h2>
                </div>

                {/* Document type (GST / Non-GST) */}
                <div className="qt-summary-control">
                  <span className="qt-summary-label">{cfg.shortName} type</span>
                  <div className="bb-segment">
                    <button type="button" className={taxMode === "gst" ? "selected" : ""} onClick={() => setTaxMode("gst")}>
                      GST {cfg.shortName.toLowerCase()}
                    </button>
                    <button type="button" className={taxMode === "non_gst" ? "selected" : ""} onClick={() => setTaxMode("non_gst")}>
                      Non-GST {cfg.shortName.toLowerCase()}
                    </button>
                  </div>
                </div>

                {/* Price basis */}
                <div className="qt-summary-control">
                  <span className="qt-summary-label">Price basis</span>
                  <div className="bb-segment">
                    <button type="button" disabled={taxMode !== "gst"} className={priceBasis === "exclusive" ? "selected" : ""} onClick={() => setPriceBasis("exclusive")}>Excl. of GST</button>
                    <button type="button" disabled={taxMode !== "gst"} className={priceBasis === "inclusive" ? "selected" : ""} onClick={() => setPriceBasis("inclusive")}>Incl. of GST</button>
                  </div>
                </div>

                {/* Supply type */}
                {taxMode === "gst" && (
                  <div className="qt-summary-control">
                    <span className="qt-summary-label">Supply type</span>
                    <select value={supplyType} onChange={(e) => setSupplyType(e.target.value)}>
                      <option value="intra">Intra-state (CGST + SGST)</option>
                      <option value="inter">Inter-state (IGST)</option>
                    </select>
                  </div>
                )}

                {/* Summary lines */}
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

                {/* Grand total */}
                <div className="qt-grand-total">
                  <span>Grand total</span>
                  <strong>{money(totals.grandTotal)}</strong>
                </div>

                {/* Round-off */}
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
                  <div className="qt-info-note">ⓘ GST is calculated per product rate. Verify before issuing.</div>
                )}

                <div className="qt-summary-footer">
                  <button type="button" className="bb-plain-button bb-clear-btn"
                    onClick={() => { if (window.confirm("Remove all items from this document?")) setItems([]); }}>
                    <svg viewBox="0 0 16 16" fill="none" width="13" height="13" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 5 }}>
                      <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor"/>
                      <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor"/>
                    </svg>
                    Clear items
                  </button>
                </div>
              </section>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
