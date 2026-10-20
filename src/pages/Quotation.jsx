

import { useEffect, useMemo, useState } from "react";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

import { getProducts } from "../services/productService";

import { useQuotationDraft } from "../context/QuotationContext";

import "../Quotation.css";

const money = (value) =>

  new Intl.NumberFormat("en-IN", {

    style: "currency",

    currency: "INR",

    maximumFractionDigits: 2,

  }).format(Number(value) || 0);

const field = (product, alias, key) =>

  product?.[alias] ?? product?.[key] ?? "";

const validNumber = (value) =>

  value !== "" &&

  value !== null &&

  value !== undefined &&

  Number.isFinite(Number(value));

export default function Quotation({

  activePage = "Quotation",

  onNavigate = () => { },

}) {

  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");

  const [notice, setNotice] = useState("");

  const { draft, setDraft } = useQuotationDraft();

  const { selected, customer, supplier, quote } = draft;

  const setSelected = (value) => {

    setDraft((previous) => ({

      ...previous,

      selected:

        typeof value === "function"

          ? value(previous.selected)

          : value,

    }));

  };

  const setCustomer = (value) => {

    setDraft((previous) => ({

      ...previous,

      customer:

        typeof value === "function"

          ? value(previous.customer)

          : value,

    }));

  };

  const setSupplier = (value) => {

    setDraft((previous) => ({

      ...previous,

      supplier:

        typeof value === "function"

          ? value(previous.supplier)

          : value,

    }));

  };

  const setQuote = (value) => {

    setDraft((previous) => ({

      ...previous,

      quote:

        typeof value === "function"

          ? value(previous.quote)

          : value,

    }));

  };

  useEffect(() => {

    let active = true;

    setLoading(true);

    setLoadError("");

    getProducts()

      .then((items) => {

        if (!active) return;

        setProducts(items);

        // Refresh product data without losing quantity or margin.

        setSelected((currentItems) =>

          currentItems.map((item) => {

            const updatedProduct = items.find(

              (product) =>

                String(field(product, "product_id", "Product Code")) ===

                item.id

            );

            return updatedProduct

              ? { ...item, product: updatedProduct }

              : item;

          })

        );

      })

      .catch((error) => {

        if (active) {

          setLoadError(

            error?.message || "Could not load products."

          );

        }

      })

      .finally(() => {

        if (active) setLoading(false);

      });

    return () => {

      active = false;

    };

    // Load the catalogue whenever this route mounts.

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);

  const results = useMemo(() => {

    const term = search.trim().toLowerCase();

    const matches = !term

      ? products

      : products.filter((product) =>

        [

          field(product, "product_id", "Product Code"),

          field(product, "product_name", "Model / SKU"),

          field(product, "brand", "Brand"),

          field(product, "category", "Category"),

        ]

          .join(" ")

          .toLowerCase()

          .includes(term)

      );

    return matches.slice(0, 5);

  }, [products, search]);

  const addProduct = (product) => {

    const id = String(field(product, "product_id", "Product Code"));

    if (selected.some((item) => item.id === id)) {

      setNotice("This product is already in the quotation.");

      return;

    }

    if (!validNumber(field(product, "dealer_price", "Dealer Price"))) {

      setNotice("This product has no valid dealer price.");

      return;

    }

    setSelected((items) => [

      ...items,

      { id, product, quantity: 1, margin: 10 },

    ]);

    setSearch("");

    setNotice("");

  };

  const updateItem = (id, key, value) => {

    setSelected((items) =>

      items.map((item) =>

        item.id === id ? { ...item, [key]: value } : item

      )

    );

  };

  const updateCustomer = (key, value) => {

    setCustomer((previous) => ({ ...previous, [key]: value }));

  };

  const updateSupplier = (key, value) => {

    setSupplier((previous) => ({ ...previous, [key]: value }));

  };

  const updateQuote = (key, value) => {

    setQuote((previous) => ({ ...previous, [key]: value }));

  };

  const totals = useMemo(

    () =>

      selected.reduce(

        (acc, item) => {

          const dp = Number(

            field(item.product, "dealer_price", "Dealer Price")

          );

          const margin = Number(item.margin) || 0;

          const qty = Number(item.quantity) || 0;

          const unit = dp * (1 + margin / 100);

          const base = unit * qty;

          const rawGst = field(item.product, "gst_rate", "GST Rate %");

          const gstValid =

            validNumber(rawGst) && Number(rawGst) >= 0;

          const gst = gstValid ? (base * Number(rawGst)) / 100 : 0;

          acc.subtotal += base;

          acc.gst += gst;

          acc.grand += base + gst;

          if (!gstValid) {

            acc.missingGst.push(

              String(

                field(item.product, "product_name", "Model / SKU") ||

                item.id

              )

            );

          }

          acc.rows.push({

            ...item,

            dp,

            margin,

            qty,

            unit,

            base,

            gstRate: gstValid ? Number(rawGst) : null,

            gst,

          });

          return acc;

        },

        { subtotal: 0, gst: 0, grand: 0, missingGst: [], rows: [] }

      ),

    [selected]

  );

  const getQuotationFileName = () => {

    const safeName = (value) =>

      String(value || "")

        .trim()

        .replace(/[<>:"|?*\x00-\x1F]/g, "")
        .replace(/[\\/]/g, "")

        .replace(/\s+/g, "-")

        .replace(/-+/g, "-");

    const quotationNumber = safeName(quote.number) || "Draft";

    const customerName = safeName(customer.company) || "Customer";

    const quotationDate = quote.date || new Date().toISOString().slice(0, 10);

    return `BB-${quotationNumber}_${customerName}_${quotationDate}.pdf`;

  };

  const printQuote = () => {

    if (!selected.length) {

      setNotice("Add at least one product before generating a quotation.");

      return;

    }

    if (

      !customer.name.trim() ||

      !customer.company.trim() ||

      !customer.phone.trim()

    ) {

      setNotice("Enter customer name, company and phone number.");

      return;

    }

    if (!supplier.businessName.trim() || !supplier.address.trim()) {

      setNotice("Enter your business name and address.");

      return;

    }

    if (totals.missingGst.length) {

      setNotice(

        "Add verified GST rates in the product master before finalising the quotation."

      );

      return;

    }

    setNotice("");

    const originalTitle = document.title;

    document.title = getQuotationFileName().replace(/\.pdf$/i, "");

    window.print();

    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);

  };

  const clearQuotation = () => {

    setSelected([]);

    setNotice("");

  };

  return (

    <div className="app-layout">

      <Sidebar activePage={activePage} onNavigate={onNavigate} />

      <div className="main-area quotation-area">

        <Topbar />

        <main className="page-content quotation-content">

          <div className="page-heading quotation-heading no-print">

            <div>

              <div className="eyebrow">SALES WORKSPACE</div>

              <h1>Create quotation</h1>

              <p>

                Build a professional quotation with live pricing and GST.

              </p>

            </div>

            <button

              type="button"

              className="secondary-button"

              onClick={clearQuotation}

            >

              Clear products

            </button>

          </div>

          {loadError && (

            <div className="quote-alert error no-print">

              Could not load products: {loadError}. Check your product

              webhook.

            </div>

          )}

          {notice && (

            <div className="quote-alert no-print" role="status">

              {notice}

            </div>

          )}

          <section className="quote-layout">

            <div className="quote-main-column">

              <section className="panel quote-panel no-print">

                <div className="quote-section-title">

                  <span className="step-number">1</span>

                  <div>

                    <h2>Customer details</h2>

                    <p>Who is this quotation for?</p>

                  </div>

                </div>

                <div className="quote-form-grid">

                  <label>

                    Customer name *

                    <input

                      value={customer.name}

                      onChange={(e) =>

                        updateCustomer("name", e.target.value)

                      }

                      placeholder="e.g. Rahul Kumar"

                    />

                  </label>

                  <label>

                    Company name *

                    <input

                      value={customer.company}

                      onChange={(e) =>

                        updateCustomer("company", e.target.value)

                      }

                      placeholder="e.g. Rahul Electricals"

                    />

                  </label>

                  <label>

                    Phone number *

                    <input

                      value={customer.phone}

                      onChange={(e) =>

                        updateCustomer("phone", e.target.value)

                      }

                      inputMode="tel"

                      placeholder="Contact number"

                    />

                  </label>

                  <label>

                    Customer GSTIN

                    <input

                      value={customer.gstin}

                      onChange={(e) =>

                        updateCustomer("gstin", e.target.value.toUpperCase())

                      }

                      maxLength={15}

                      placeholder="Optional"

                    />

                  </label>

                  <label className="full-width">

                    Billing address

                    <input

                      value={customer.address}

                      onChange={(e) =>

                        updateCustomer("address", e.target.value)

                      }

                      placeholder="Street, city, state and PIN code"

                    />

                  </label>

                </div>

              </section>

              <section className="panel quote-panel no-print">

                <div className="quote-section-title">

                  <span className="step-number">2</span>

                  <div>

                    <h2>Add products</h2>

                    <p>Search the catalogue and add as many products as needed.</p>

                  </div>

                </div>

                <div className="quote-search">

                  <span>⌕</span>

                  <input

                    value={search}

                    onChange={(e) => setSearch(e.target.value)}

                    placeholder="Search product name, code or brand..."

                    aria-label="Search products"

                  />

                </div>

                <div className="quote-product-results">

                  {loading ? (

                    <p className="quote-muted">Loading products...</p>

                  ) : results.length === 0 ? (

                    <p className="quote-muted">No matching products found.</p>

                  ) : (

                    results.map((product) => {

                      const id = String(

                        field(product, "product_id", "Product Code")

                      );

                      const already = selected.some(

                        (item) => item.id === id

                      );

                      return (

                        <div className="quote-product-result" key={id}>

                          <div className="quote-product-info">

                            <strong>

                              {field(product, "product_name", "Model / SKU") ||

                                "Unnamed product"}

                            </strong>

                            <span>

                              {id} · {field(product, "brand", "Brand")} ·{" "}

                              {field(product, "category", "Category")}

                            </span>

                          </div>

                          <div className="quote-product-price">

                            {money(

                              field(product, "dealer_price", "Dealer Price")

                            )}

                            <small>Dealer price</small>

                          </div>

                          <button

                            type="button"

                            className="primary-button add-button"

                            disabled={already}

                            onClick={() => addProduct(product)}

                          >

                            {already ? "Added" : "+ Add"}

                          </button>

                        </div>

                      );

                    })

                  )}

                </div>

              </section>

              <section className="panel quote-panel">

                <div className="quote-section-title">

                  <span className="step-number">3</span>

                  <div>

                    <h2>

                      Quotation items{" "}

                      <span className="item-count">

                        {selected.length} selected

                      </span>

                    </h2>

                    <p>

                      Adjust quantities and internal margins. Margins are

                      not printed on the customer quotation.

                    </p>

                  </div>

                </div>

                {selected.length === 0 ? (

                  <div className="quote-empty">

                    <span>＋</span>

                    <strong>No products added yet</strong>

                    <p>Search above and add products to get started.</p>

                  </div>

                ) : (

                  <div className="quote-items-list">

                    {totals.rows.map((item) => (

                      <div className="quote-item-card" key={item.id}>

                        <div className="quote-item-head">

                          <div>

                            <strong>

                              {field(

                                item.product,

                                "product_name",

                                "Model / SKU"

                              ) || item.id}

                            </strong>

                            <span>

                              {item.id} ·{" "}

                              {field(item.product, "brand", "Brand")}

                            </span>

                          </div>

                          <button

                            type="button"

                            className="text-button no-print"

                            onClick={() =>

                              setSelected((items) =>

                                items.filter((row) => row.id !== item.id)

                              )

                            }

                          >

                            Remove

                          </button>

                        </div>

                        <div className="quote-item-controls">

                          <label>

                            Qty

                            <input

                              type="number"

                              min="1"

                              step="1"

                              value={item.quantity}

                              onChange={(e) =>

                                updateItem(

                                  item.id,

                                  "quantity",

                                  Math.max(

                                    1,

                                    Math.floor(Number(e.target.value) || 1)

                                  )

                                )

                              }

                            />

                          </label>

                          <label className="no-print">

                            Margin %

                            <input

                              type="number"

                              min="1"

                              max="20"

                              step="0.5"

                              value={item.margin}

                              onChange={(e) =>

                                updateItem(

                                  item.id,

                                  "margin",

                                  Math.min(

                                    20,

                                    Math.max(1, Number(e.target.value) || 1)

                                  )

                                )

                              }

                            />

                          </label>

                          <div>

                            <span>Dealer price</span>

                            <strong>{money(item.dp)}</strong>

                          </div>

                          <div>

                            <span>Selling price / unit</span>

                            <strong>{money(item.unit)}</strong>

                          </div>

                          <div>

                            <span>GST rate</span>

                            <strong>

                              {item.gstRate === null

                                ? "Missing"

                                : `${item.gstRate}%`}

                            </strong>

                          </div>

                          <div>

                            <span>Line total before GST</span>

                            <strong>{money(item.base)}</strong>

                          </div>

                        </div>

                      </div>

                    ))}

                  </div>

                )}

              </section>

              <section className="panel quote-panel no-print">

                <div className="quote-section-title">

                  <span className="step-number">4</span>

                  <div>

                    <h2>Quotation settings</h2>

                    <p>Set the reference number, date and validity.</p>

                  </div>

                </div>

                <div className="quote-form-grid">

                  <label>

                    Quotation number

                    <input

                      value={quote.number}

                      onChange={(e) => updateQuote("number", e.target.value)}

                    />

                  </label>

                  <label>

                    Quotation date

                    <input

                      type="date"

                      value={quote.date}

                      onChange={(e) => updateQuote("date", e.target.value)}

                    />

                  </label>

                  <label>

                    Valid for (days)

                    <input

                      type="number"

                      min="1"

                      value={quote.validDays}

                      onChange={(e) =>

                        updateQuote("validDays", e.target.value)

                      }

                    />

                  </label>

                  <label className="full-width">

                    Terms & conditions

                    <textarea

                      rows="3"

                      value={quote.terms}

                      onChange={(e) => updateQuote("terms", e.target.value)}

                    />

                  </label>

                </div>

              </section>

              <div className="quote-actions no-print">

                <button

                  type="button"

                  className="secondary-button"

                  onClick={() => window.print()}

                >

                  Print preview

                </button>

                <button

                  type="button"

                  className="primary-button generate-button"

                  onClick={printQuote}

                >

                  Generate / Download PDF ↗

                </button>

              </div>

            </div>

            <aside className="quote-preview-wrap">

              <div className="preview-heading no-print">

                <div>

                  <h2>Live preview</h2>

                  <p>Updates as you edit the quotation.</p>

                </div>

                <span className="preview-live"><i /> LIVE</span>

              </div>

              <article className="quote-document" id="quotation-document">

                <div className="document-brand">

                  <div className="document-mark">BB</div>

                  <div className="document-company">

                    <strong>{supplier.businessName || "Business name"}</strong>

                    <span>{supplier.tagline}</span>

                    <span>{supplier.address}</span>

                    <span>

                      Phone: {supplier.phone || "—"} · Email:{" "}

                      {supplier.email || "—"}

                    </span>

                    <span>GSTIN: {supplier.gstin || "Not provided"}</span>

                    <span>

                      State: {supplier.state || "—"} (

                      {supplier.stateCode || "—"})

                    </span>

                  </div>

                  <div className="document-quotation-label">QUOTATION</div>

                </div>

                <div className="document-meta">

                  <div>

                    <span>QUOTATION NO.</span>

                    <strong>{quote.number || "—"}</strong>

                  </div>

                  <div>

                    <span>DATE</span>

                    <strong>{quote.date || "—"}</strong>

                  </div>

                  <div>

                    <span>VALIDITY</span>

                    <strong>{quote.validDays || "—"} days</strong>

                  </div>

                </div>

                <div className="document-customer">

                  <span>QUOTATION FOR</span>

                  <strong>{customer.company || "Customer company name"}</strong>

                  <p>{customer.name || "Customer name"}</p>

                  {customer.phone && <p>Phone: {customer.phone}</p>}

                  {customer.gstin && <p>GSTIN: {customer.gstin}</p>}

                  {customer.address && <p>{customer.address}</p>}

                </div>

                <div className="document-table-wrap">

                  <table className="document-table">

                    <thead>

                      <tr>

                        <th>Item</th>

                        <th>Qty</th>

                        <th>Rate</th>

                        <th>GST</th>

                        <th className="align-right">Amount</th>

                      </tr>

                    </thead>

                    <tbody>

                      {totals.rows.length ? (

                        totals.rows.map((item) => (

                          <tr key={item.id}>

                            <td>

                              <strong>

                                {field(

                                  item.product,

                                  "product_name",

                                  "Model / SKU"

                                ) || item.id}

                              </strong>

                              <small>

                                {item.id} · HSN{" "}

                                {field(item.product, "hsn", "HSN") || "—"}

                              </small>

                            </td>

                            <td>{item.qty}</td>

                            <td>{money(item.unit)}</td>

                            <td>

                              {item.gstRate === null

                                ? "Missing"

                                : `${item.gstRate}%`}

                            </td>

                            <td className="align-right">

                              {money(item.base)}

                            </td>

                          </tr>

                        ))

                      ) : (

                        <tr>

                          <td colSpan="5" className="document-empty">

                            Your selected products will appear here.

                          </td>

                        </tr>

                      )}

                    </tbody>

                  </table>

                </div>

                <div className="document-totals">

                  <div>

                    <span>Subtotal</span>

                    <strong>{money(totals.subtotal)}</strong>

                  </div>

                  <div>

                    <span>GST total</span>

                    <strong>{money(totals.gst)}</strong>

                  </div>

                  <div className="document-grand">

                    <span>Grand total</span>

                    <strong>{money(totals.grand)}</strong>

                  </div>

                  {totals.missingGst.length > 0 && (

                    <p className="document-warning">

                      GST rate missing for {totals.missingGst.length} item(s).

                    </p>

                  )}

                </div>

                <div className="document-terms">

                  <strong>Terms & conditions</strong>

                  <p>{quote.terms || "—"}</p>

                </div>

                <div className="document-signature">

                  <span>For {supplier.businessName || "Business name"}</span>

                  <div className="signature-line" />

                  <strong>Authorised Signatory</strong>

                </div>

                <footer className="document-footer">

                  Thank you for your business.

                </footer>

              </article>

              <p className="preview-note no-print">

                Choose <strong>Save as PDF</strong> in your browser's print

                dialog. Enable background graphics to preserve the colours.

              </p>

            </aside>

          </section>

        </main>

      </div>

    </div>

  );

}
