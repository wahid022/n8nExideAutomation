

import { useCallback, useEffect, useMemo, useState } from "react";

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



function OrderDetailsModal({ order, onClose }) {

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
          <div className="print-company"><h1>BHARAT BATTERIES</h1><p>SALES ORDER</p></div>
          <div className="print-order-meta">
            <div><span>Order No.</span><strong>{order.orderNumber || `Order #${ order.id }`}</strong></div>
            <div><span>Order Date</span><strong>{formatDate(order.orderDate || order.createdAt)}</strong></div>
            <div><span>Status</span><strong>{order.status || "Pending"}</strong></div>
          </div>
          <h3>Bill To</h3>
          <div className="print-customer"><strong>{customer.businessName || customer.name || "—"}</strong>
            <div>{customer.contactPerson || ""}</div><div>{customer.phone || ""}{customer.email ? ` · ${ customer.email }` : ""}</div>
            <div>{[customer.address,customer.city,customer.state,customer.pincode].filter(Boolean).join(", ")}</div>
            {customer.gstin && <div>GSTIN: {customer.gstin}</div>}
          </div>
          <table className="print-items"><thead><tr><th>#</th><th>Product</th><th>Code</th><th>Qty</th><th>Unit price</th><th>Discount</th><th>GST</th><th>Total</th></tr></thead>
          <tbody>{items.map((item,index)=>{const q=Number(item.quantity||0),p=Number(item.unitPrice??item.dealerPrice??0),d=Number(item.discountPercent||0),t=Number(item.taxPercent??18),g=q*p,da=g*d/100,taxableLine=g-da,ga=taxableLine*t/100;return <tr key={`${ item.productId || item.productCode || index } - ${ index }`}><td>{index+1}</td><td>{item.productName||item.name||"—"}</td><td>{item.productCode||"—"}</td><td>{q}</td><td>{money(p)}</td><td>{d}% ({money(da)})</td><td>{t}% ({money(ga)})</td><td>{money(item.lineTotal??taxableLine+ga)}</td></tr>;})}</tbody></table>
          <div className="print-total-area"><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Discount</span><b>{money(discount)}</b></div><div><span>Taxable value</span><b>{money(taxable)}</b></div><div><span>GST</span><b>{money(tax)}</b></div><div className="print-grand"><span>Grand total</span><b>{money(total)}</b></div></div>
          {order.notes && <div className="print-notes"><strong>Notes:</strong> {order.notes}</div>}
          <div className="print-signatures"><div>Customer Signature</div><div>For BHARAT BATTERIES<br/><br/>Authorised Signatory</div></div>
          <p className="print-footer">Computer-generated sales order.</p>
        </div>
        

        <header>

          <div>

            <span className="sales-eyebrow">SALES ORDER DETAILS</span>

            <h2 id="order-details-title">

              {order.orderNumber || `Order #${order.id}`}

            </h2>

            <p>

              Created on {formatDate(order.orderDate || order.createdAt)}

            </p>

          </div>



          <div className="sales-print-actions">
            <button type="button" className="sales-secondary" onClick={() => window.print()}>Print Order</button>
            <button type="button" className="sales-primary" onClick={() => window.print()}>Download PDF</button>
          </div>

          <button

            type="button"

            className="sales-close"

            onClick={onClose}

            aria-label="Close order details"

          >

            ×

          </button>

        </header>



        <div className="sales-details-section">

          <div className="sales-details-heading">

            <h3>Order information</h3>

            <span className={`sales-status ${statusClass(order.status)}`}>

              {order.status || "Pending"}

            </span>

          </div>



          <div className="sales-details-grid">

            <div>

              <span>Order number</span>

              <strong>{order.orderNumber || "—"}</strong>

            </div>



            <div>

              <span>Order date</span>

              <strong>{formatDate(order.orderDate)}</strong>

            </div>



            <div>

              <span>Order ID</span>

              <strong>{order.id ?? "—"}</strong>

            </div>



            <div>

              <span>Created at</span>

              <strong>{formatDate(order.createdAt)}</strong>

            </div>

          </div>

        </div>



        <div className="sales-details-section">

          <h3>Customer information</h3>



          <div className="sales-details-grid">

            <div>

              <span>Business name</span>

              <strong>{customer.businessName || "—"}</strong>

            </div>



            <div>

              <span>Customer name</span>

              <strong>{customer.contactPerson || customer.name || "—"}</strong>

            </div>



            <div>

              <span>Phone</span>

              <strong>{customer.phone || "—"}</strong>

            </div>



            <div>

              <span>Email</span>

              <strong>{customer.email || "—"}</strong>

            </div>



            <div className="sales-details-full">

              <span>Address</span>

              <strong>

                {[

                  customer.address,

                  customer.city,

                  customer.state,

                  customer.pincode,

                ]

                  .filter(Boolean)

                  .join(", ") || "—"}

              </strong>

            </div>

          </div>

        </div>



        <div className="sales-details-section">

          <h3>Order items</h3>



          <div className="sales-table-wrap sales-details-table-wrap">

            <table className="sales-table sales-details-table">

              <thead>

                <tr>

                  <th>Product</th>

                  <th>Code</th>

                  <th>Qty</th>

                  <th>MRP</th>

                  <th>Unit price</th>

                  <th>Discount</th>

                  <th>GST</th>

                  <th>Total</th>

                </tr>

              </thead>



              <tbody>

                {items.length === 0 ? (

                  <tr>

                    <td colSpan={8} className="sales-empty">

                      No item details available.

                    </td>

                  </tr>

                ) : (

                  items.map((item, index) => {

                    const quantity = Number(item.quantity || 0);

                    const unitPrice = Number(item.unitPrice || 0);

                    const discountPercent = Number(

                      item.discountPercent || 0

                    );

                    const taxPercent = Number(item.taxPercent || 0);



                    const gross = quantity * unitPrice;

                    const discountAmount =

                      gross * (discountPercent / 100);

                    const taxableAmount = gross - discountAmount;

                    const taxAmount = taxableAmount * (taxPercent / 100);

                    const lineTotal = taxableAmount + taxAmount;



                    return (

                      <tr key={`${item.productId || item.productCode || index}-${index}`}>

                        <td>

                          <strong>

                            {item.productName || item.name || "—"}

                          </strong>

                          {(item.brand || item.modelSku) && (

                            <small className="sales-item-subtitle">

                              {[item.brand, item.modelSku]

                                .filter(Boolean)

                                .join(" ")}

                            </small>

                          )}

                        </td>



                        <td>{item.productCode || "—"}</td>

                        <td>{quantity}</td>

                        <td>{money(item.mrp)}</td>

                        <td>{money(unitPrice)}</td>

                        <td>

                          {discountPercent}%{" "}

                          <small>{money(discountAmount)}</small>

                        </td>

                        <td>

                          {taxPercent}%{" "}

                          <small>{money(taxAmount)}</small>

                        </td>

                        <td>

                          <strong>{money(lineTotal)}</strong>

                        </td>

                      </tr>

                    );

                  })

                )}

              </tbody>

            </table>

          </div>

        </div>



        <div className="sales-details-bottom">

          <div className="sales-details-notes">

            <h3>Notes</h3>

            <p>{order.notes || "No notes added."}</p>

          </div>



          <div className="sales-totals sales-details-totals">

            <span>

              Subtotal <b>{money(subtotal)}</b>

            </span>



            <span>

              Discount <b>{money(discount)}</b>

            </span>



            <span>

              Taxable value <b>{money(taxable)}</b>

            </span>



            <span>

              GST <b>{money(tax)}</b>

            </span>



            <span className="sales-grand-total">

              Grand total <b>{money(total)}</b>

            </span>

          </div>

        </div>



        <footer className="sales-details-footer">

          <button

            type="button"

            className="sales-secondary"

            onClick={onClose}

          >

            Close

          </button>

        </footer>

      </section>

    </div>

  );

}



export default function Sales({ activePage = "Sales" }) {

  const [tab, setTab] = useState("Orders");

  const [summary, setSummary] = useState(null);

  const [orders, setOrders] = useState([]);

  const [invoices, setInvoices] = useState([]);

  const [payments, setPayments] = useState([]);

  const [customers, setCustomers] = useState([]);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [modal, setModal] = useState(false);

  const [saving, setSaving] = useState(false);

  const [viewOrder, setViewOrder] = useState(null);



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



  const load = useCallback(async () => {

    setLoading(true);

    setError("");



    try {

      const [sum, ord, inv, pay, cust] = await Promise.all([

        api("/sales/summary"),

        api(`/sales/orders?search=${encodeURIComponent(search)}`),

        api(`/sales/invoices?search=${encodeURIComponent(search)}`),

        api("/sales/payments"),

        api("/customers"),

      ]);



      setSummary(sum);

      setOrders(ord.data || []);

      setInvoices(inv.data || []);

      setPayments(pay.data || []);

      setCustomers(cust.data || []);

    } catch (e) {

      setError(e.message || "Unable to load Sales.");

    } finally {

      setLoading(false);

    }

  }, [search]);



  useEffect(() => {

    const timer = setTimeout(load, 200);

    return () => clearTimeout(timer);

  }, [load]);



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

    setError("");

    setNotice("");



    setForm({

      documentNumber: `${tab === "Orders" ? "SO" : tab === "Invoices" ? "INV" : "RCPT"

    }-${Date.now().toString().slice(-8)}`,

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

          payload.orderNumber = form.documentNumber;

          payload.orderDate = form.date;



          result = await api("/sales/orders", {

            method: "POST",

            body: JSON.stringify(payload),

          });

        } else {

          payload.invoiceNumber = form.documentNumber;

          payload.invoiceDate = form.date;

          payload.dueDate = form.dueDate || null;



          result = await api("/sales/invoices", {

            method: "POST",

            body: JSON.stringify(payload),

          });

        }

      } else {

        result = await api("/sales/payments", {

          method: "POST",

          body: JSON.stringify({

            receiptNumber: form.documentNumber,

            customerId: Number(form.customerId),

            invoiceId: form.invoiceId || null,

            paymentDate: form.date,

            amount: Number(form.amount),

            paymentMethod: form.paymentMethod,

            referenceNumber: form.referenceNumber,

            notes: form.notes,

          }),

        });

      }



      setNotice(`${tab.slice(0, -1)} saved successfully.`);

      setModal(false);

      await load();

    } catch (e) {

      setError(e.message || "Unable to save record.");

    } finally {

      setSaving(false);

    }

  };



  const tabs = ["Orders", "Invoices", "Payments"];



  const records =

    tab === "Orders"

      ? orders

      : tab === "Invoices"

        ? invoices

        : payments;



  const columns =

    tab === "Orders"

      ? ["Order number", "Customer", "Date", "Status", "Total", "Actions"]

      : tab === "Invoices"

        ? [

          "Invoice number",

          "Customer",

          "Invoice date",

          "Due date",

          "Status",

          "Total",

          "Paid",

          "Balance",

        ]

        : [

          "Receipt",

          "Customer",

          "Invoice",

          "Date",

          "Method",

          "Amount",

          "Status",

        ];



  return (

    <div className="sales-page-shell">

      <Sidebar activePage={activePage} />



      <main className="sales-main">

        <Topbar activePage={activePage} />



        <div className="sales-content">

          <div className="sales-heading">

            <div>

              <span className="sales-eyebrow">BUSINESS MANAGEMENT</span>

              <h1>Sales</h1>

              <p>

                Manage orders, invoices, customer payments and outstanding

                balances.

              </p>

            </div>



            <button className="sales-primary" onClick={openCreate}>

              ＋ New{" "}

              {tab === "Orders"

                ? "order"

                : tab === "Invoices"

                  ? "invoice"

                  : "payment"}

            </button>

          </div>



          {notice && <div className="sales-notice">{notice}</div>}

          {error && !modal && <div className="sales-error">{error}</div>}



          <section className="sales-stats">

            <article>

              <span>Sales orders</span>

              <strong>{summary?.orders?.count ?? "—"}</strong>

              <small>{money(summary?.orders?.value)} order value</small>

            </article>



            <article>

              <span>Invoices</span>

              <strong>{summary?.invoices?.count ?? "—"}</strong>

              <small>{money(summary?.invoices?.value)} invoice value</small>

            </article>



            <article>

              <span>Payments received</span>

              <strong>{money(summary?.payments?.received)}</strong>

              <small>Recorded receipts</small>

            </article>



            <article>

              <span>Outstanding</span>

              <strong>{money(summary?.invoices?.outstanding)}</strong>

              <small>Invoices less received payments</small>

            </article>

          </section>



          <section className="sales-card">

            <div className="sales-toolbar">

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

                        return (

                          <tr key={record.id}>

                            <td>

                              <strong>{record.orderNumber}</strong>

                            </td>



                            <td>

                              {record.customer?.businessName || "—"}

                            </td>



                            <td>{formatDate(record.orderDate)}</td>



                            <td>

                              <span

                                className={`sales-status ${statusClass(

      record.status

    )}`}

                              >

                                {record.status}

                              </span>

                            </td>



                            <td>{money(record.grandTotal)}</td>



                            <td>

                              <button

                                type="button"

                                className="sales-view-button"

                                onClick={() => setViewOrder(record)}

                              >

                                View details

                              </button>

                            </td>

                          </tr>

                        );

                      }



                      if (tab === "Invoices") {

                        const balance = Math.max(

                          0,

                          Number(record.grandTotal || 0) -

                          Number(record.amountPaid || 0)

                        );



                        return (

                          <tr key={record.id}>

                            <td>

                              <strong>{record.invoiceNumber}</strong>

                            </td>



                            <td>

                              {record.customer?.businessName || "—"}

                            </td>



                            <td>{formatDate(record.invoiceDate)}</td>



                            <td>{formatDate(record.dueDate)}</td>



                            <td>

                              <span

                                className={`sales-status ${statusClass(

      record.status

    )}`}

                              >

                                {record.status}

                              </span>

                            </td>



                            <td>{money(record.grandTotal)}</td>

                            <td>{money(record.amountPaid)}</td>

                            <td>{money(balance)}</td>

                          </tr>

                        );

                      }



                      return (

                        <tr key={record.id}>

                          <td>

                            <strong>{record.receiptNumber}</strong>

                          </td>



                          <td>

                            {record.businessName ||

                              customers.find(

                                (c) =>

                                  String(c.id) ===

                                  String(record.customerId)

                              )?.businessName ||

                              `Customer #${record.customerId}`}

                          </td>



                          <td>{record.invoiceNumber || "Unallocated"}</td>



                          <td>{formatDate(record.paymentDate)}</td>



                          <td>{record.paymentMethod}</td>



                          <td>{money(record.amount)}</td>



                          <td>{record.status}</td>

                        </tr>

                      );

                    })

                  )}

                </tbody>

              </table>

            </div>

          </section>

        </div>

      </main>



      {modal && (

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

                  New{" "}

                  {tab === "Orders"

                    ? "sales order"

                    : tab === "Invoices"

                      ? "sales invoice"

                      : "customer payment"}

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

                {tab === "Invoices"

                  ? "Invoice date"

                  : tab === "Payments"

                    ? "Payment date"

                    : "Order date"}



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



              {tab === "Payments" ? (

                <>

                  <label>

                    Invoice (optional)

                    <select

                      value={form.invoiceId}

                      onChange={(e) =>

                        setForm({ ...form, invoiceId: e.target.value })

                      }

                    >

                      <option value="">Unallocated payment</option>



                      {invoices

                        .filter(

                          (i) =>

                            String(i.customer?.id) ===

                            String(form.customerId) &&

                            !["Paid", "Void"].includes(i.status)

                        )

                        .map((i) => (

                          <option key={i.id} value={i.id}>

                            {i.invoiceNumber} — balance{" "}

                            {money(

                              Number(i.grandTotal) -

                              Number(i.amountPaid)

                            )}

                          </option>

                        ))}

                    </select>

                  </label>



                  <label>

                    Amount (₹)

                    <input

                      type="number"

                      min="0.01"

                      step="0.01"

                      required

                      value={form.amount}

                      onChange={(e) =>

                        setForm({ ...form, amount: e.target.value })

                      }

                    />

                  </label>



                  <label>

                    Payment method

                    <select

                      value={form.paymentMethod}

                      onChange={(e) =>

                        setForm({

                          ...form,

                          paymentMethod: e.target.value,

                        })

                      }

                    >

                      {[

                        "Cash",

                        "UPI",

                        "Bank Transfer",

                        "Cheque",

                        "Card",

                        "Other",

                      ].map((m) => (

                        <option key={m}>{m}</option>

                      ))}

                    </select>

                  </label>



                  <label>

                    Reference number

                    <input

                      maxLength="120"

                      value={form.referenceNumber}

                      onChange={(e) =>

                        setForm({

                          ...form,

                          referenceNumber: e.target.value,

                        })

                      }

                    />

                  </label>

                </>

              ) : (

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

                  {saving ? "Saving…" : "Save record"}

                </button>

              </footer>

            </form>

          </section>

        </div>

      )}



      {viewOrder && (

        <OrderDetailsModal

          order={viewOrder}

          onClose={() => setViewOrder(null)}

        />

      )}

    </div>

  );

}
