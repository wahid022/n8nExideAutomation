

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";

import Sidebar from "../components/Sidebar";

import Topbar from "../components/Topbar";

import { supabase } from "../lib/supabase";

import "./Sales.css";




const API_BASE = (
  import.meta.env.VITE_PRODUCTS_API_URL ||
  "http://127.0.0.1:3001/api/products"
).replace(/\/products\/?$/, "");




const money = (value) =>

  new Intl.NumberFormat("en-IN", {

    style: "currency",

    currency: "INR",

    maximumFractionDigits: 2,

  }).format(Number(value || 0));



const today = () => new Date().toISOString().slice(0, 10);



const formatDate = (value) =>

  value ? String(value).slice(0, 10) : "—";



const statusClass = (status) =>

  String(status || "")

    .toLowerCase()

    .replaceAll(" ", "-");



async function api(path, options = {}) {

  const {

    data: { session },

    error,

  } = await supabase.auth.getSession();



  if (error || !session?.access_token) {

    throw new Error("Your session has expired. Please sign in again.");

  }



  const response = await fetch(`${API_BASE}${path}`, {

    ...options,

    headers: {

      "Content-Type": "application/json",

      Authorization: `Bearer ${session.access_token}`,

      ...(options.headers || {}),

    },

    cache: "no-store",

  });



  const body = await response.json().catch(() => ({}));



  if (!response.ok) {

    throw new Error(body.error || `Request failed (${response.status}).`);

  }



  return body;

}



const emptyLine = () => ({

  productName: "",

  productCode: "",

  quantity: 1,

  unitPrice: 0,

  discountPercent: 0,

  taxPercent: 18,

});



function ProductPicker({ line, onChange }) {

  const [query, setQuery] = useState(line.productName || "");

  const [results, setResults] = useState([]);

  const [open, setOpen] = useState(false);

  const [loading, setLoading] = useState(false);



  useEffect(() => {

    if (!open || query.trim().length < 2) {

      setResults([]);

      return;

    }



    const timer = setTimeout(async () => {

      setLoading(true);



      try {

        const result = await api(

          `/products?search=${encodeURIComponent(query.trim())}&pageSize=20`

        );



        setResults(result.data || []);

      } catch (error) {

        console.error("Product search failed:", error);

        setResults([]);

      } finally {

        setLoading(false);

      }

    }, 300);



    return () => clearTimeout(timer);

  }, [query, open]);



  const selectProduct = (product) => {

    const name = [

      product.brand,

      product.modelSku,

      product.specsCapacity,

    ]

      .filter(Boolean)

      .join(" ");



    onChange({

      ...line,

      productId: product.id,

      productName: name || product.productCode,

      productCode: product.productCode || "",

      brand: product.brand || "",

      modelSku: product.modelSku || "",

      mrp: product.mrp ?? null,

      unitPrice: Number(product.dealerPrice ?? 0),

      taxPercent: Number(product.gstRate ?? 18),

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

        placeholder="Search product, SKU or code..."

        onFocus={() => setOpen(true)}

        onChange={(e) => {

          const value = e.target.value;



          setQuery(value);

          setOpen(true);



          onChange({

            ...line,

            productId: null,

            productName: value,

            productCode: "",

            brand: "",

            modelSku: "",

            mrp: null,

          });

        }}

      />



      {line.productCode && (

        <small>

          Code: {line.productCode}

          {line.mrp != null ? ` | MRP: ${money(line.mrp)}` : ""}

        </small>

      )}



      {open && (

        <div className="sales-product-results">

          {loading && (

            <div className="sales-product-option">Searching...</div>

          )}



          {!loading && query.trim().length >= 2 && results.length === 0 && (

            <div className="sales-product-option">No products found.</div>

          )}



          {results.map((product) => (

            <button

              type="button"

              className="sales-product-option"

              key={product.id}

              onClick={() => selectProduct(product)}

            >

              <strong>

                {[

                  product.brand,

                  product.modelSku,

                  product.specsCapacity,

                ]

                  .filter(Boolean)

                  .join(" ") || product.productCode}

              </strong>



              <span>

                Code: {product.productCode || "—"} | Dealer:{" "}

                {money(product.dealerPrice)} | MRP: {money(product.mrp)}

              </span>

            </button>

          ))}

        </div>

      )}

    </div>

  );

}



function OrderDetailsModal({ order, onClose, onEdit, autoPrint = false }) {

  useEffect(() => {
    if (autoPrint && order) {
      const timer = setTimeout(() => window.print(), 250);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, order]);

  if (!order) return null;



  const customer = order.customer || {};

  const items = Array.isArray(order.items) ? order.items : [];



  const subtotal = Number(order.subtotal || 0);

  const discount = Number(order.discountTotal || 0);

  const taxable = Number(order.taxableValue || 0);

  const tax = Number(order.taxTotal || 0);

  const total = Number(order.grandTotal || 0);



  return (

    <div

      className="sales-modal-backdrop"

      role="presentation"

      onMouseDown={(event) => {

        if (event.target === event.currentTarget) onClose();

      }}

    >

      <section

        className="sales-modal sales-order-details-modal"

        role="dialog"

        aria-modal="true"

        aria-labelledby="order-details-title"

      >
        <div className="sales-print-document">
          {/* Invoice header: company left, order details right */}
          <div className="inv-header">
            <div className="inv-company">
              <div className="inv-company-name">BHARAT BATTERIES</div>
              <div className="inv-company-sub">Your Trusted Partner in Power Solutions</div>
            </div>
            <div className="inv-meta">
              <div className="inv-doc-type">SALES ORDER</div>
              <div className="inv-meta-row"><span>Order No.</span><strong>{order.orderNumber || `#${order.id}`}</strong></div>
              <div className="inv-meta-row"><span>Date</span><strong>{formatDate(order.orderDate || order.createdAt)}</strong></div>
              <div className="inv-meta-row"><span>Status</span><strong>{order.status || "Pending"}</strong></div>
            </div>
          </div>

          <div className="inv-rule" />

          {/* Bill To */}
          <div className="inv-bill-section">
            <div className="inv-section-label">BILL TO</div>
            <div className="inv-cust-name">{customer.businessName || customer.name || "—"}</div>
            {customer.contactPerson && <div>{customer.contactPerson}</div>}
            {(customer.phone || customer.email) && (
              <div>{customer.phone || ""}{customer.email ? ` · ${customer.email}` : ""}</div>
            )}
            {[customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).length > 0 && (
              <div>{[customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).join(", ")}</div>
            )}
            {customer.gstin && <div>GSTIN: {customer.gstin}</div>}
          </div>

          {/* Items table */}
          <table className="inv-items">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Code</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Discount</th>
                <th>GST</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const q = Number(item.quantity || 0);
                const p = Number(item.unitPrice ?? item.dealerPrice ?? 0);
                const d = Number(item.discountPercent || 0);
                const t = Number(item.taxPercent ?? 18);
                const gross = q * p;
                const da = gross * d / 100;
                const taxableLine = gross - da;
                const ga = taxableLine * t / 100;
                return (
                  <tr key={`${item.productId || item.productCode || index}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{item.productName || item.name || "—"}</td>
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

          {/* Totals */}
          <div className="inv-totals">
            <div className="inv-total-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="inv-total-row"><span>Discount</span><span>− {money(discount)}</span></div>
            <div className="inv-total-row"><span>Taxable Value</span><span>{money(taxable)}</span></div>
            <div className="inv-total-row"><span>GST</span><span>{money(tax)}</span></div>
            <div className="inv-total-row inv-grand"><span>Grand Total</span><span>{money(total)}</span></div>
          </div>

          {order.notes && (
            <div className="inv-notes"><strong>Notes:</strong> {order.notes}</div>
          )}

          {/* Signatures */}
          <div className="inv-signatures">
            <div className="inv-sig-box">
              <div className="inv-sig-line" />
              <div>Customer Signature</div>
            </div>
            <div className="inv-sig-box">
              <div className="inv-sig-line" />
              <div>For BHARAT BATTERIES<br />Authorised Signatory</div>
            </div>
          </div>

          <div className="inv-footer-text">Computer-generated sales order. No physical signature required.</div>
        </div>


        <header style={{ padding: "8px 12px", minHeight: "auto", borderBottom: "none", justifyContent: "flex-end" }}>
          {order.status === "Draft" && onEdit && (
            <button type="button" className="si-action-btn si-action-btn--edit" onClick={() => { onClose(); onEdit(order); }}>
              <svg viewBox="0 0 14 14" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5l2 2-6 6H3.5v-2l6-6z"/><path d="M8 4l2 2"/></svg>
              Edit
            </button>
          )}
          <button type="button" className="sales-close" onClick={onClose} aria-label="Close order details">×</button>
        </header>



      </section>

    </div>

  );

}



function InvoiceDetailsModal({ invoice, onClose, onEdit, autoPrint = false }) {
  useEffect(() => {
    if (autoPrint && invoice) {
      const timer = setTimeout(() => window.print(), 250);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, invoice]);

  if (!invoice) return null;

  const customer = invoice.customer || {};
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const subtotal = Number(invoice.subtotal || 0);
  const discount = Number(invoice.discountTotal || 0);
  const taxable = Number(invoice.taxableValue || 0);
  const tax = Number(invoice.taxTotal || 0);
  const total = Number(invoice.grandTotal || 0);
  const paid = Number(invoice.amountPaid || 0);
  const balance = Math.max(0, total - paid);

  return (
    <div
      className="sales-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <section
        className="sales-modal sales-order-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-details-title"
      >
        <div className="sales-print-document">
          <div className="inv-header">
            <div className="inv-company">
              <div className="inv-company-name">BHARAT BATTERIES</div>
              <div className="inv-company-sub">Your Trusted Partner in Power Solutions</div>
            </div>
            <div className="inv-meta">
              <div className="inv-doc-type">TAX INVOICE</div>
              <div className="inv-meta-row"><span>Invoice No.</span><strong>{invoice.invoiceNumber || `#${invoice.id}`}</strong></div>
              <div className="inv-meta-row"><span>Invoice Date</span><strong>{formatDate(invoice.invoiceDate)}</strong></div>
              <div className="inv-meta-row"><span>Due Date</span><strong>{formatDate(invoice.dueDate) || "—"}</strong></div>
              <div className="inv-meta-row"><span>Status</span><strong>{invoice.status || "Draft"}</strong></div>
            </div>
          </div>

          <div className="inv-rule" />

          <div className="inv-bill-section">
            <div className="inv-section-label">BILL TO</div>
            <div className="inv-cust-name">{customer.businessName || customer.name || "—"}</div>
            {customer.contactPerson && <div>{customer.contactPerson}</div>}
            {(customer.phone || customer.email) && (
              <div>{customer.phone || ""}{customer.email ? ` · ${customer.email}` : ""}</div>
            )}
            {[customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).length > 0 && (
              <div>{[customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).join(", ")}</div>
            )}
            {customer.gstin && <div>GSTIN: {customer.gstin}</div>}
          </div>

          <table className="inv-items">
            <thead>
              <tr>
                <th>#</th><th>Product</th><th>Code</th><th>Qty</th>
                <th>Unit Price</th><th>Discount</th><th>GST</th><th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const q = Number(item.quantity || 0);
                const p = Number(item.unitPrice ?? item.dealerPrice ?? 0);
                const d = Number(item.discountPercent || 0);
                const t = Number(item.taxPercent ?? 18);
                const gross = q * p;
                const da = gross * d / 100;
                const taxableLine = gross - da;
                const ga = taxableLine * t / 100;
                return (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{item.productName || item.name || "—"}</td>
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
            {paid > 0 && <div className="inv-total-row"><span>Amount Paid</span><span>− {money(paid)}</span></div>}
            {paid > 0 && <div className="inv-total-row inv-grand"><span>Balance Due</span><span>{money(balance)}</span></div>}
          </div>

          {invoice.notes && <div className="inv-notes"><strong>Notes:</strong> {invoice.notes}</div>}

          <div className="inv-signatures">
            <div className="inv-sig-box"><div className="inv-sig-line" /><div>Customer Signature</div></div>
            <div className="inv-sig-box"><div className="inv-sig-line" /><div>For BHARAT BATTERIES<br />Authorised Signatory</div></div>
          </div>

          <div className="inv-footer-text">This is a computer-generated tax invoice. Subject to jurisdiction of local courts.</div>
        </div>

        <header style={{ padding: "8px 12px", minHeight: "auto", borderBottom: "none", justifyContent: "flex-end" }}>
          {!["Paid", "Void", "Cancelled"].includes(invoice.status) && onEdit && (
            <button type="button" className="si-action-btn si-action-btn--edit" onClick={() => { onClose(); onEdit(invoice); }}>
              <svg viewBox="0 0 14 14" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5l2 2-6 6H3.5v-2l6-6z"/><path d="M8 4l2 2"/></svg>
              Edit
            </button>
          )}
          <button type="button" className="sales-close" onClick={onClose} aria-label="Close">×</button>
        </header>

      </section>
    </div>
  );
}

export default function Sales({ activePage = "Sales" }) {
  const location = useLocation();

  const defaultTab =
    activePage === "Sales Invoice" ? "Invoices" :
    activePage === "Sales Order" ? "Orders" :
    (location.state?.salesTab || "Orders");
  const [tab, setTab] = useState(defaultTab);
  useEffect(() => {
    if (activePage === "Sales Invoice") setTab("Invoices");
    else if (activePage === "Sales Order") setTab("Orders");
  }, [activePage]);
  useEffect(() => { if (location.state?.salesTab) setTab(location.state.salesTab); }, [location.state?.salesTab]);

  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const { data: ordersRaw,   isLoading: ordersLoading,   error: ordersErr   } = useQuery({ queryKey: ["sales-orders",   debouncedSearch], queryFn: () => api(`/sales/orders?search=${encodeURIComponent(debouncedSearch)}`),   staleTime: 20_000, placeholderData: keepPreviousData });
  const { data: invoicesRaw, isLoading: invoicesLoading, error: invoicesErr } = useQuery({ queryKey: ["sales-invoices", debouncedSearch], queryFn: () => api(`/sales/invoices?search=${encodeURIComponent(debouncedSearch)}`), staleTime: 20_000, placeholderData: keepPreviousData });
  const { data: customersRaw } = useQuery({ queryKey: ["customers"], queryFn: () => api("/customers"), staleTime: 60_000 });
  const { data: summaryRaw,   isLoading: summaryLoading  } = useQuery({ queryKey: ["sales-summary"], queryFn: () => api("/sales/summary"), staleTime: 20_000 });

  const orders    = ordersRaw?.data    || [];
  const invoices  = invoicesRaw?.data  || [];
  const customers = customersRaw?.data || [];
  const summary   = summaryRaw         || null;
  const loading   = ordersLoading || invoicesLoading || summaryLoading;
  const queryError = (ordersErr || invoicesErr)?.message || "";
  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [modal, setModal] = useState(false);

  const [saving, setSaving] = useState(false);

  const [viewOrder, setViewOrder] = useState(null);

  const [autoPrint, setAutoPrint] = useState(false);

  const [viewInvoice, setViewInvoice] = useState(null);
  const [autoPrintInvoice, setAutoPrintInvoice] = useState(false);

  const [editingOrder, setEditingOrder] = useState(null);

  const [editingInvoice, setEditingInvoice] = useState(null);



  const [form, setForm] = useState({

    documentNumber: "",

    customerId: "",

    invoiceId: "",

    date: today(),

    dueDate: "",

    amount: "",

    paymentMethod: "UPI",

    referenceNumber: "",

    notes: "",

    items: [emptyLine()],

  });






  const selectedCustomer = customers.find(

    (customer) => String(customer.id) === String(form.customerId)

  );



  const totals = useMemo(

    () =>

      form.items.reduce(

        (acc, line) => {

          const gross =

            Math.max(0, Number(line.quantity) || 0) *

            Math.max(0, Number(line.unitPrice) || 0);



          const discount =

            (gross *

              Math.min(

                100,

                Math.max(0, Number(line.discountPercent) || 0)

              )) /

            100;



          const taxable = gross - discount;



          const tax =

            (taxable *

              Math.min(

                100,

                Math.max(0, Number(line.taxPercent) || 0)

              )) /

            100;



          acc.subtotal += gross;

          acc.discount += discount;

          acc.tax += tax;

          acc.total += taxable + tax;



          return acc;

        },

        { subtotal: 0, discount: 0, tax: 0, total: 0 }

      ),

    [form.items]

  );



  const openCreate = () => {

    setEditingOrder(null);
    setEditingInvoice(null);
    setError("");

    setNotice("");



    setForm({

      documentNumber: `${tab === "Orders" ? "SO" : "INV"}-${Date.now().toString().slice(-8)}`,

      customerId: customers[0] ? String(customers[0].id) : "",

      invoiceId: "",

      date: today(),

      dueDate: "",

      amount: "",

      paymentMethod: "UPI",

      referenceNumber: "",

      notes: "",

      items: [emptyLine()],

    });



    setModal(true);

  };



  const openEditOrder = (order) => {
    if (order.status !== "Draft") {
      setError("Only Draft sales orders can be edited.");
      return;
    }

    setError("");
    setNotice("");
    const legacyItems = Array.isArray(order.items) ? order.items : [];
    const items = legacyItems.length
      ? legacyItems.map((item) => ({
        ...emptyLine(),
        ...item,
        quantity: item.quantity ?? 1,
        unitPrice: item.unitPrice ?? item.dealerPrice ?? 0,
        discountPercent: item.discountPercent ?? 0,
        taxPercent: item.taxPercent ?? 18,
      }))
      : [emptyLine()];

    setEditingOrder(order);
    setForm({
      documentNumber: order.orderNumber || "",
      customerId: String(order.customer?.id || ""),
      invoiceId: "",
      date: String(order.orderDate || order.createdAt || today()).slice(0, 10),
      dueDate: "",
      amount: "",
      paymentMethod: "UPI",
      referenceNumber: "",
      notes: order.notes || "",
      items,
    });
    setViewOrder(null);
    setModal(true);
  };

  const openEditInvoice = (invoice) => {
    setError("");
    setNotice("");
    const legacyItems = Array.isArray(invoice.items) ? invoice.items : [];
    const items = legacyItems.length
      ? legacyItems.map((item) => ({
          ...emptyLine(),
          ...item,
          quantity: item.quantity ?? 1,
          unitPrice: item.unitPrice ?? item.dealerPrice ?? 0,
          discountPercent: item.discountPercent ?? 0,
          taxPercent: item.taxPercent ?? 18,
        }))
      : [emptyLine()];

    setEditingInvoice(invoice);
    setForm({
      documentNumber: invoice.invoiceNumber || "",
      customerId: String(invoice.customer?.id || ""),
      invoiceId: "",
      date: String(invoice.invoiceDate || today()).slice(0, 10),
      dueDate: String(invoice.dueDate || "").slice(0, 10),
      amount: "",
      paymentMethod: "UPI",
      referenceNumber: "",
      notes: invoice.notes || "",
      items,
    });
    setModal(true);
  };



  const save = async (event) => {

    event.preventDefault();

    setSaving(true);

    setError("");

    setNotice("");



    try {

      if (!selectedCustomer) {

        throw new Error("Choose a saved customer first.");

      }



      let result;



      if (tab === "Orders" || tab === "Invoices") {

        const payload = {

          customer: selectedCustomer,

          items: form.items,

          notes: form.notes,

        };



        if (tab === "Orders") {

          payload.orderDate = form.date;

          result = await api(
            editingOrder ? `/sales/orders/${editingOrder.id}` : "/sales/orders",
            {
              method: editingOrder ? "PUT" : "POST",
              body: JSON.stringify(
                editingOrder
                  ? payload
                  : { ...payload, orderNumber: form.documentNumber }
              ),
            }
          );

        } else {

          payload.invoiceNumber = form.documentNumber;

          payload.invoiceDate = form.date;

          payload.dueDate = form.dueDate || null;



          result = await api(
            editingInvoice ? `/sales/invoices/${editingInvoice.id}` : "/sales/invoices",
            {
              method: editingInvoice ? "PUT" : "POST",
              body: JSON.stringify(payload),
            }
          );

        }

      }



      setNotice(
        editingOrder
          ? "Sales order updated successfully."
          : editingInvoice
          ? "Invoice updated successfully."
          : `${tab.slice(0, -1)} saved successfully.`
      );

      setEditingOrder(null);
      setEditingInvoice(null);
      setModal(false);

      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      qc.invalidateQueries({ queryKey: ["sales-invoices"] });
      qc.invalidateQueries({ queryKey: ["sales-summary"] });

    } catch (e) {

      setError(e.message || "Unable to save record.");

    } finally {

      setSaving(false);

    }

  };



  const tabs =
    activePage === "Sales Order"
      ? ["Orders"]
      : activePage === "Sales Invoice"
        ? ["Invoices"]
        : ["Orders", "Invoices"];



  const records = tab === "Orders" ? orders : invoices;



  const columns =

    tab === "Orders"

      ? ["Order number", "Customer", "Date", "Status", "Total", "Actions"]

      : [

          "Invoice number",

          "Customer",

          "Invoice date",

          "Due date",

          "Status",

          "Total",

          "Paid",

          "Balance",

          "Actions",

        ];



  return (

    <>
    <div className="sales-page-shell">

      <Sidebar activePage={activePage} />



      <main className="sales-main">

        <Topbar activePage={activePage} />



        <div className="sales-content">

          <div className="sales-heading">

            <div>

              <span className="sales-eyebrow">BUSINESS MANAGEMENT</span>

              <h1>{activePage}</h1>

              <p>

                Manage orders, invoices and outstanding balances.

              </p>

            </div>



            <button className="sales-primary" onClick={openCreate}>

              ＋ New {tab === "Orders" ? "order" : "invoice"}

            </button>

          </div>






          {queryError && <div className="sales-error">{queryError}</div>}

          {tab === "Orders" && orders.length > 0 && (
            <div className="si-stats-strip">
              <div className="si-stat">
                <span>Total Orders</span>
                <strong>{orders.length}</strong>
              </div>
              <div className="si-stat">
                <span>Order Value</span>
                <strong>{money(orders.reduce((s, r) => s + Number(r.grandTotal || 0), 0))}</strong>
              </div>
              <div className={`si-stat si-stat--paid${orders.filter(r => r.status === "Confirmed").length === 0 ? " si-stat--zero" : ""}`}>
                <span>Confirmed</span>
                <strong>{orders.filter(r => r.status === "Confirmed").length}</strong>
              </div>
              <div className="si-stat si-stat--draft">
                <span>Draft</span>
                <strong>{orders.filter(r => r.status === "Draft").length}</strong>
              </div>
              <div className={`si-stat si-stat--overdue${orders.filter(r => r.status === "Cancelled").length === 0 ? " si-stat--zero" : ""}`}>
                <span>Cancelled</span>
                <strong>{orders.filter(r => r.status === "Cancelled").length}</strong>
              </div>
            </div>
          )}

          {tab === "Invoices" && invoices.length > 0 && (
            <div className="si-stats-strip">
              <div className="si-stat">
                <span>Total Invoices</span>
                <strong>{invoices.length}</strong>
              </div>
              <div className="si-stat">
                <span>Invoice Value</span>
                <strong>{money(invoices.reduce((s, r) => s + Number(r.grandTotal || 0), 0))}</strong>
              </div>
              <div className="si-stat si-stat--balance">
                <span>Outstanding</span>
                <strong>{money(invoices.reduce((s, r) => s + Math.max(0, Number(r.grandTotal || 0) - Number(r.amountPaid || 0)), 0))}</strong>
              </div>
              <div className="si-stat si-stat--paid">
                <span>Collected</span>
                <strong>{money(invoices.reduce((s, r) => s + Number(r.amountPaid || 0), 0))}</strong>
              </div>
              {(() => { const overdueCount = invoices.filter(r => r.dueDate && new Date(r.dueDate) < new Date() && !["Paid", "Void", "Cancelled"].includes(r.status)).length; return (
              <div className={`si-stat si-stat--overdue${overdueCount === 0 ? " si-stat--zero" : ""}`}>
                <span>Overdue</span>
                <strong>{overdueCount}</strong>
              </div>
              ); })()}
            </div>
          )}

          <section className="sales-card">

            <div className="sales-toolbar">

              {tabs.length > 1 && (
                <div className="sales-tabs">

                  {tabs.map((item) => (

                    <button

                      key={item}

                      className={tab === item ? "selected" : ""}

                      onClick={() => setTab(item)}

                    >

                      {item}

                    </button>

                  ))}

                </div>
              )}



              <input

                aria-label="Search sales documents"

                value={search}

                onChange={(e) => setSearch(e.target.value)}

                placeholder="Search document or customer…"

              />

            </div>



            <div className="sales-table-wrap">

              <table className="sales-table">

                <thead>

                  <tr>

                    {columns.map((column) => (

                      <th key={column}>{column}</th>

                    ))}

                  </tr>

                </thead>



                <tbody>

                  {loading ? (

                    <tr>

                      <td colSpan={columns.length} className="sales-empty">

                        Loading records…

                      </td>

                    </tr>

                  ) : records.length === 0 ? (

                    <tr>

                      <td colSpan={columns.length} className="sales-empty">

                        No {tab.toLowerCase()} yet. Use the button above to

                        create the first record.

                      </td>

                    </tr>

                  ) : (

                    records.map((record) => {

                      if (tab === "Orders") {
                        const customerName = record.customer?.businessName || "?";
                        const AVATAR_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899"];
                        const avatarColor = AVATAR_COLORS[customerName.charCodeAt(0) % AVATAR_COLORS.length];

                        return (
                          <tr key={record.id} className="si-row">
                            <td>
                              <div className="si-inv-num">
                                <svg className="si-inv-icon" viewBox="0 0 16 16" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="3" width="13" height="11" rx="1.5" stroke="currentColor"/><path d="M4 3V2a1 1 0 011-1h6a1 1 0 011 1v1" stroke="currentColor"/><line x1="5" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1"/><line x1="5" y1="9.5" x2="9" y2="9.5" stroke="currentColor" strokeWidth="1"/></svg>
                                <strong>{record.orderNumber}</strong>
                              </div>
                            </td>
                            <td>
                              <div className="si-customer">
                                <span className="si-avatar" style={{ background: avatarColor }}>{customerName.charAt(0).toUpperCase()}</span>
                                <span className="si-customer-name">{customerName}</span>
                              </div>
                            </td>
                            <td className="si-date">{formatDate(record.orderDate)}</td>
                            <td>
                              <span className={`sales-status ${statusClass(record.status)}`}>{record.status}</span>
                            </td>
                            <td className="si-amount">{money(record.grandTotal)}</td>
                            <td>
                              <div className="si-action-group">
                                {record.status === "Draft" && (
                                  <button type="button" className="si-action-btn si-action-btn--edit" title="Edit order" onClick={() => openEditOrder(record)}>
                                    <svg viewBox="0 0 14 14" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5l2 2-6 6H3.5v-2l6-6z"/><path d="M8 4l2 2"/></svg>
                                    Edit
                                  </button>
                                )}
                                <button type="button" className="si-action-btn si-action-btn--print" title="Print order" onClick={() => { setAutoPrint(true); setViewOrder(record); }}>
                                  <svg viewBox="0 0 14 14" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 5V1.5h7V5"/><rect x="1.5" y="5" width="11" height="6" rx="1"/><path d="M3.5 9h7" strokeWidth="1"/><circle cx="11.5" cy="7" r="0.6" fill="currentColor"/></svg>
                                  Print
                                </button>
                                <button type="button" className="si-action-btn si-action-btn--preview" title="Preview order" onClick={() => { setAutoPrint(false); setViewOrder(record); }}>
                                  <svg viewBox="0 0 14 14" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7s2.5-4.5 6-4.5S13 7 13 7s-2.5 4.5-6 4.5S1 7 1 7z"/><circle cx="7" cy="7" r="1.75"/></svg>
                                  Preview
                                </button>
                              </div>
                            </td>
                          </tr>
                        );

                      }



                      if (tab === "Invoices") {
                        const balance = Math.max(0, Number(record.grandTotal || 0) - Number(record.amountPaid || 0));
                        const isOverdue = record.dueDate && new Date(record.dueDate) < new Date() && !["Paid", "Void", "Cancelled"].includes(record.status);
                        const customerName = record.customer?.businessName || "?";
                        const AVATAR_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899"];
                        const avatarColor = AVATAR_COLORS[customerName.charCodeAt(0) % AVATAR_COLORS.length];

                        return (
                          <tr key={record.id} className="si-row">
                            <td>
                              <div className="si-inv-num">
                                <svg className="si-inv-icon" viewBox="0 0 16 16" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="1.5" width="10" height="13" rx="1.5" stroke="currentColor"/><line x1="5" y1="5" x2="10.5" y2="5" stroke="currentColor" strokeWidth="1"/><line x1="5" y1="7.5" x2="10.5" y2="7.5" stroke="currentColor" strokeWidth="1"/><line x1="5" y1="10" x2="8" y2="10" stroke="currentColor" strokeWidth="1"/></svg>
                                <strong>{record.invoiceNumber}</strong>
                              </div>
                            </td>
                            <td>
                              <div className="si-customer">
                                <span className="si-avatar" style={{ background: avatarColor }}>{customerName.charAt(0).toUpperCase()}</span>
                                <span className="si-customer-name">{customerName}</span>
                              </div>
                            </td>
                            <td className="si-date">{formatDate(record.invoiceDate)}</td>
                            <td>
                              <div className={`si-due${isOverdue ? " si-due--overdue" : ""}`}>
                                {formatDate(record.dueDate)}
                                {isOverdue && <span className="si-overdue-pill">Overdue</span>}
                              </div>
                            </td>
                            <td>
                              <span className={`sales-status ${statusClass(record.status)}`}>{record.status}</span>
                            </td>
                            <td className="si-amount">{money(record.grandTotal)}</td>
                            <td className="si-amount si-amount--paid">{money(record.amountPaid)}</td>
                            <td className={`si-amount ${balance > 0 ? "si-amount--balance" : "si-amount--zero"}`}>{money(balance)}</td>
                            <td>
                              <div className="si-action-group">
                                {!["Paid", "Void", "Cancelled"].includes(record.status) && (
                                  <button type="button" className="si-action-btn si-action-btn--edit" title="Edit invoice" onClick={() => openEditInvoice(record)}>
                                    <svg viewBox="0 0 14 14" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5l2 2-6 6H3.5v-2l6-6z"/><path d="M8 4l2 2"/></svg>
                                    Edit
                                  </button>
                                )}
                                <button type="button" className="si-action-btn si-action-btn--print" title="Print invoice" onClick={() => { setAutoPrintInvoice(true); setViewInvoice(record); }}>
                                  <svg viewBox="0 0 14 14" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 5V1.5h7V5"/><rect x="1.5" y="5" width="11" height="6" rx="1"/><path d="M3.5 9h7" strokeWidth="1"/><circle cx="11.5" cy="7" r="0.6" fill="currentColor"/></svg>
                                  Print
                                </button>
                                <button type="button" className="si-action-btn si-action-btn--preview" title="Preview invoice" onClick={() => { setAutoPrintInvoice(false); setViewInvoice(record); }}>
                                  <svg viewBox="0 0 14 14" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7s2.5-4.5 6-4.5S13 7 13 7s-2.5 4.5-6 4.5S1 7 1 7z"/><circle cx="7" cy="7" r="1.75"/></svg>
                                  Preview
                                </button>
                              </div>
                            </td>
                          </tr>
                        );

                      }



                      return null;

                    })

                  )}

                </tbody>

              </table>

            </div>

          </section>

        </div >

      </main >



    { modal && (

      <div

        className="sales-modal-backdrop"

        role="presentation"

        onMouseDown={(e) => {

          if (e.target === e.currentTarget) setModal(false);

        }}

      >

        <section

          className="sales-modal"

          role="dialog"

          aria-modal="true"

          aria-labelledby="sales-modal-title"

        >

          <header>

            <div>

              <h2 id="sales-modal-title">

                {editingOrder ? "Edit Draft Sales Order" : editingInvoice ? "Edit Invoice" : `New ${tab === "Orders" ? "sales order" : "sales invoice"}`}

              </h2>

              <p>Totals are calculated and validated by the backend.</p>

            </div>



            <button

              type="button"

              className="sales-close"

              onClick={() => setModal(false)}

              aria-label="Close"

            >

              ×

            </button>

          </header>



          {error && <div className="sales-error">{error}</div>}



          <form onSubmit={save} className="sales-form">

            <label>

              {tab === "Orders"

                ? "Order number"

                : tab === "Invoices"

                  ? "Invoice number"

                  : "Receipt number"}



              <input

                required

                maxLength="80"

                disabled={Boolean(editingOrder) || Boolean(editingInvoice)}

                value={form.documentNumber}

                onChange={(e) =>

                  setForm({

                    ...form,

                    documentNumber: e.target.value,

                  })

                }

              />

            </label>



            <label>

              Customer

              <select

                required

                value={form.customerId}

                onChange={(e) =>

                  setForm({

                    ...form,

                    customerId: e.target.value,

                    invoiceId: "",

                  })

                }

              >

                <option value="">Choose customer</option>



                {customers.map((c) => (

                  <option key={c.id} value={c.id}>

                    {c.businessName} — {c.phone}

                  </option>

                ))}

              </select>

            </label>



            <label>

              {tab === "Invoices" ? "Invoice date" : "Order date"}



              <input

                type="date"

                required

                value={form.date}

                onChange={(e) =>

                  setForm({ ...form, date: e.target.value })

                }

              />

            </label>



            {tab === "Invoices" && (

              <label>

                Due date

                <input

                  type="date"

                  min={form.date}

                  value={form.dueDate}

                  onChange={(e) =>

                    setForm({ ...form, dueDate: e.target.value })

                  }

                />

              </label>

            )}



            {(

              <div className="sales-line-items">

                <div className="sales-line-heading">

                  <strong>Items</strong>



                  <button

                    type="button"

                    className="sales-secondary"

                    onClick={() =>

                      setForm({

                        ...form,

                        items: [...form.items, emptyLine()],

                      })

                    }

                  >

                    ＋ Add item

                  </button>

                </div>



                {form.items.map((line, index) => (

                  <div className="sales-line" key={index}>

                    <label>

                      Product / Catalogue



                      <ProductPicker

                        line={line}

                        onChange={(updatedLine) =>

                          setForm({

                            ...form,

                            items: form.items.map((item, i) =>

                              i === index ? updatedLine : item

                            ),

                          })

                        }

                      />

                    </label>



                    <label>

                      Qty

                      <input

                        type="number"

                        min="0.001"

                        step="0.001"

                        required

                        value={line.quantity}

                        onChange={(e) =>

                          setForm({

                            ...form,

                            items: form.items.map((item, i) =>

                              i === index

                                ? {

                                  ...item,

                                  quantity: e.target.value,

                                }

                                : item

                            ),

                          })

                        }

                      />

                    </label>



                    <label>

                      Unit price ₹

                      <input

                        type="number"

                        min="0"

                        step="0.01"

                        required

                        value={line.unitPrice}

                        onChange={(e) =>

                          setForm({

                            ...form,

                            items: form.items.map((item, i) =>

                              i === index

                                ? {

                                  ...item,

                                  unitPrice: e.target.value,

                                }

                                : item

                            ),

                          })

                        }

                      />

                    </label>



                    <label>

                      Discount %

                      <input

                        type="number"

                        min="0"

                        max="100"

                        step="0.01"

                        value={line.discountPercent}

                        onChange={(e) =>

                          setForm({

                            ...form,

                            items: form.items.map((item, i) =>

                              i === index

                                ? {

                                  ...item,

                                  discountPercent: e.target.value,

                                }

                                : item

                            ),

                          })

                        }

                      />

                    </label>



                    <label>

                      GST %

                      <input

                        type="number"

                        min="0"

                        max="100"

                        step="0.01"

                        value={line.taxPercent}

                        onChange={(e) =>

                          setForm({

                            ...form,

                            items: form.items.map((item, i) =>

                              i === index

                                ? {

                                  ...item,

                                  taxPercent: e.target.value,

                                }

                                : item

                            ),

                          })

                        }

                      />

                    </label>



                    {form.items.length > 1 && (

                      <button

                        type="button"

                        className="sales-remove"

                        onClick={() =>

                          setForm({

                            ...form,

                            items: form.items.filter(

                              (_, i) => i !== index

                            ),

                          })

                        }

                      >

                        Remove

                      </button>

                    )}

                  </div>

                ))}



                <div className="sales-totals">

                  <span>

                    Subtotal <b>{money(totals.subtotal)}</b>

                  </span>



                  <span>

                    Discount <b>{money(totals.discount)}</b>

                  </span>



                  <span>

                    Tax <b>{money(totals.tax)}</b>

                  </span>



                  <span className="sales-grand-total">

                    Total <b>{money(totals.total)}</b>

                  </span>

                </div>

              </div>

            )}



            <label className="sales-form-wide">

              Notes

              <textarea

                rows="2"

                maxLength="2000"

                value={form.notes}

                onChange={(e) =>

                  setForm({ ...form, notes: e.target.value })

                }

              />

            </label>



            <footer className="sales-form-actions">

              <button

                type="button"

                className="sales-secondary"

                onClick={() => setModal(false)}

              >

                Cancel

              </button>



              <button

                className="sales-primary"

                disabled={saving || !customers.length}

              >

                {saving ? "Saving…" : (editingOrder || editingInvoice) ? "Update" : "Save record"}

              </button>

            </footer>

          </form>

        </section>

      </div>

    )
}

    </div>

    {viewOrder && (
      <OrderDetailsModal
        order={viewOrder}
        onClose={() => { setViewOrder(null); setAutoPrint(false); }}
        onEdit={openEditOrder}
        autoPrint={autoPrint}
      />
    )}

    {viewInvoice && (
      <InvoiceDetailsModal
        invoice={viewInvoice}
        onClose={() => { setViewInvoice(null); setAutoPrintInvoice(false); }}
        onEdit={openEditInvoice}
        autoPrint={autoPrintInvoice}
      />
    )}

    </>

  );

}
