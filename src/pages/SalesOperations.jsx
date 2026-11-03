
import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { supabase } from "../lib/supabase";
import "./Sales.css";

const API_BASE = (
  import.meta.env.VITE_PRODUCTS_API_URL ||
  "http://127.0.0.1:3001/api/products"
).replace(/\/products\/?$/, "");

const today = () => new Date().toISOString().slice(0, 10);

const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(n || 0));

async function api(path, options = {}) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error("Session expired. Please sign in again.");
  }

  const r = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(options.headers || {}),
    },
  });

  const body = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw new Error(body.error || `Request failed (${r.status}).`);
  }

  return body;
}

const blankItem = () => ({
  productName: "",
  productCode: "",
  productId: "",
  productSearch: "",
  quantity: 1,
  unitPrice: 0,
  discountPercent: 0,
  taxPercent: 18,
});

const VALID_TABS = [
  "Delivery Challans",
  "Credit Notes",
  "Recurring Invoices",
  "Quotation Conversion",
];

export default function SalesOperations({ activePage }) {
  // When opened through a separate route, lock the page to that module.
  const isStandalone = Boolean(activePage);

  const initialTab = VALID_TABS.includes(activePage)
    ? activePage
    : "Delivery Challans";

  const [tab, setTab] = useState(initialTab);

  const [customers, setCustomers] = useState([]);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({});
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Keep the standalone page selected even when navigating back/forward.
  useEffect(() => {
    if (isStandalone && VALID_TABS.includes(activePage)) {
      setTab(activePage);
      setSearch("");
      setModal(false);
    }
  }, [activePage, isStandalone]);

  const load = useCallback(async () => {
    setError("");

    // Quotation Conversion does not need the document list.
    if (tab === "Quotation Conversion") {
      setRows([]);
      return;
    }

    try {
      const c = await api("/customers");
      setCustomers(c.data || []);

      const paths = {
        "Delivery Challans": "/sales/challans",
        "Credit Notes": "/sales/credit-notes",
        "Recurring Invoices": "/sales/recurring-invoices",
      };

      const path = paths[tab];

      if (!path) {
        throw new Error(`Unsupported Sales Operations tab: ${tab}`);
      }

      const query = search
        ? `?search=${encodeURIComponent(search)}`
        : "";

      const r = await api(`${path}${query}`);
      setRows(r.data || []);
    } catch (e) {
      setError(e.message);
    }
  }, [tab, search]);

  useEffect(() => {
    const t = setTimeout(load, 150);
    return () => clearTimeout(t);
  }, [load]);

  const open = () => {
    setError("");
    setNotice("");

    setForm({
      number: `${
        tab === "Delivery Challans"
          ? "DC"
          : tab === "Credit Notes"
          ? "CN"
          : "RINV"
      }-${Date.now().toString().slice(-8)}`,

      customerId: customers[0]
        ? String(customers[0].id)
        : "",

      date: today(),
      amount: "",
      reason: "",
      invoiceId: "",
      frequency: "Monthly",
      nextRunDate: today(),
      endDate: "",
      dueDays: 30,
      items: [blankItem()],
      notes: "",
    });

    setModal(true);

  };

  const searchProducts = useCallback(
    (query) =>
      api(`/products?search=${encodeURIComponent(query)}&pageSize=20`),
    []
  );

  const changeItem = (i, k, v) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((x, j) =>
        i === j ? { ...x, [k]: v } : x
      ),
    }));

  const save = async (e) => {
    e.preventDefault();

    setBusy(true);
    setError("");

    try {
      const customer = customers.find(
        (c) => String(c.id) === String(form.customerId)
      );

      if (!customer) {
        throw new Error("Choose a saved customer.");
      }

      let path;
      let payload;

      if (tab === "Delivery Challans") {
        path = "/sales/challans";

        payload = {
          challanNumber: form.number,
          customer,
          challanDate: form.date,
          // Delivery Challans contain only product description and quantity.
          items: form.items.map(({ productName, productSearch, productCode, productId, quantity }) => ({
            productName: productName || productSearch || "",
            productCode: productCode || null,
            productId: productId || null,
            quantity: Number(quantity),
          })),
          notes: form.notes,
          status: "Draft",
        };
      } else if (tab === "Credit Notes") {
        path = "/sales/credit-notes";

        payload = {
          creditNoteNumber: form.number,
          customerId: Number(form.customerId),
          invoiceId: form.invoiceId || null,
          creditDate: form.date,
          amount: Number(form.amount),
          reason: form.reason,
          status: "Draft",
        };
      } else {
        path = "/sales/recurring-invoices";

        payload = {
          templateNumber: form.number,
          customer,
          items: form.items,
          frequency: form.frequency,
          nextRunDate: form.nextRunDate,
          endDate: form.endDate || null,
          dueDays: Number(form.dueDays),
          notes: form.notes,
        };
      }

      await api(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setNotice(
        tab === "Delivery Challans"
          ? "Delivery Challan saved."
          : tab === "Credit Notes"
          ? "Credit Note saved."
          : "Recurring Invoice saved."
      );

      setModal(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const titleKey =
    tab === "Delivery Challans"
      ? "challanNumber"
      : tab === "Credit Notes"
      ? "creditNoteNumber"
      : "templateNumber";

  const pageTitle = isStandalone
    ? activePage
    : "Sales Operations";

  const pageDescription = isStandalone
    ? activePage === "Credit Notes"
      ? "Manage customer credit notes, issue credits and track credit amounts."
      : "Manage delivery challans, dispatch documents and delivery status."
    : "Manage recurring invoice templates and quotation conversion.";

  return (
    <div className="sales-page-shell">
      <Sidebar activePage={pageTitle} />

      <main className="sales-main">
        <Topbar activePage={pageTitle} />

        <div className="sales-content">
          <div className="sales-heading">
            <div>
              <span className="sales-eyebrow">
                SALES WORKFLOWS
              </span>

              <h1>{pageTitle}</h1>
              <p>{pageDescription}</p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {tab === "Recurring Invoices" && (
                <button
                  className="sales-secondary"
                  onClick={async () => {
                    try {
                      const r = await api(
                        "/sales/recurring-invoices/run-due",
                        {
                          method: "POST",
                          body: JSON.stringify({}),
                        }
                      );

                      setNotice(
                        `Generated ${r.generated} recurring invoice(s).`
                      );

                      await load();
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  Generate due invoices
                </button>
              )}

              {tab !== "Quotation Conversion" && (
                <button className="sales-primary" onClick={open}>
                  ＋ New{" "}
                  {tab === "Delivery Challans"
                    ? "challan"
                    : tab === "Credit Notes"
                    ? "credit note"
                    : "recurring template"}
                </button>
              )}
            </div>
          </div>

          {notice && (
            <div className="sales-notice">{notice}</div>
          )}

          {error && !modal && (
            <div className="sales-error">{error}</div>
          )}

          <section className="sales-card">
            {/* Hide the four tabs on standalone pages */}
            {!isStandalone && (
              <div className="sales-toolbar">
                <div className="sales-tabs">
                  {VALID_TABS.map((x) => (
                    <button
                      key={x}
                      className={tab === x ? "selected" : ""}
                      onClick={() => {
                        setTab(x);
                        setSearch("");
                      }}
                    >
                      {x}
                    </button>
                  ))}
                </div>

                {tab !== "Quotation Conversion" && (
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search documents…"
                  />
                )}
              </div>
            )}

            {/* Standalone Credit Notes / Delivery Challans */}
            {tab === "Quotation Conversion" ? (
              <QuotationConvert
                onDone={async (msg) => {
                  setNotice(msg);
                  setTab("Delivery Challans");
                }}
              />
            ) : (
              <>
                {/* Search is retained for standalone pages */}
                {isStandalone && (
                  <div className="sales-toolbar">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={`Search ${tab.toLowerCase()}…`}
                    />
                  </div>
                )}

                <div className="sales-table-wrap">
                  <table className="sales-table">
                    <thead>
                      <tr>
                        <th>Document</th>
                        <th>Customer</th>
                        <th>Date / Next run</th>
                        <th>Details</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="sales-empty">
                            No records found.
                          </td>
                        </tr>
                      ) : (
                        rows.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <strong>{r[titleKey]}</strong>
                            </td>

                            <td>
                              {r.customer?.businessName ||
                                `Customer #${r.customerId || "—"}`}
                            </td>

                            <td>
                              {String(
                                r.challanDate ||
                                  r.creditDate ||
                                  r.nextRunDate ||
                                  ""
                              ).slice(0, 10)}
                            </td>

                            <td>
                              {tab === "Credit Notes"
                                ? money(r.amount)
                                : tab === "Recurring Invoices"
                                ? `${r.frequency} · every cycle`
                                : Array.isArray(r.items)
                                ? `${r.items.length} item line(s)`
                                : "—"}
                            </td>

                            <td>
                              {r.status ||
                                (r.active ? "Active" : "Paused")}
                            </td>

                            <td>
                              {tab === "Delivery Challans" &&
                                r.status !== "Delivered" &&
                                r.status !== "Cancelled" && (
                                  <button
                                    className="sales-secondary"
                                    onClick={async () => {
                                      try {
                                        await api(
                                          `/sales/challans/${r.id}/status`,
                                          {
                                            method: "PATCH",
                                            body: JSON.stringify({
                                              status:
                                                r.status === "Draft"
                                                  ? "Dispatched"
                                                  : "Delivered",
                                            }),
                                          }
                                        );

                                        await load();
                                      } catch (e) {
                                        setError(e.message);
                                      }
                                    }}
                                  >
                                    {r.status === "Draft"
                                      ? "Dispatch"
                                      : "Mark delivered"}
                                  </button>
                                )}

                              {tab === "Credit Notes" &&
                                r.status === "Draft" && (
                                  <button
                                    className="sales-secondary"
                                    onClick={async () => {
                                      try {
                                        await api(
                                          `/sales/credit-notes/${r.id}/status`,
                                          {
                                            method: "PATCH",
                                            body: JSON.stringify({
                                              status: "Issued",
                                            }),
                                          }
                                        );

                                        await load();
                                      } catch (e) {
                                        setError(e.message);
                                      }
                                    }}
                                  >
                                    Issue
                                  </button>
                                )}

                              {tab === "Recurring Invoices" && (
                                <button
                                  className="sales-secondary"
                                  onClick={async () => {
                                    try {
                                      await api(
                                        `/sales/recurring-invoices/${r.id}`,
                                        {
                                          method: "PATCH",
                                          body: JSON.stringify({
                                            active: !r.active,
                                          }),
                                        }
                                      );

                                      await load();
                                    } catch (e) {
                                      setError(e.message);
                                    }
                                  }}
                                >
                                  {r.active ? "Pause" : "Activate"}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {/* Existing Create modal functionality */}
      {modal && (
        <div className="sales-modal-backdrop">
          <section
            className="sales-modal"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <h2>New {tab.toLowerCase()}</h2>
                <p>
                  Server-side validation is applied before saving.
                </p>
              </div>

              <button
                type="button"
                className="sales-close"
                onClick={() => setModal(false)}
              >
                ×
              </button>
            </header>

            {error && <div className="sales-error">{error}</div>}

            <form className="sales-form" onSubmit={save}>
              <label>
                Document / template number
                <input
                  required
                  maxLength="80"
                  value={form.number || ""}
                  onChange={(e) =>
                    setForm({ ...form, number: e.target.value })
                  }
                />
              </label>

              <label>
                Customer
                <select
                  required
                  value={form.customerId || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      customerId: e.target.value,
                    })
                  }
                >
                  <option value="">Select customer</option>

                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.businessName} — {c.phone}
                    </option>
                  ))}
                </select>
              </label>

              {tab !== "Recurring Invoices" && (
                <label>
                  Date
                  <input
                    type="date"
                    required
                    value={form.date || today()}
                    onChange={(e) =>
                      setForm({ ...form, date: e.target.value })
                    }
                  />
                </label>
              )}

              {tab === "Credit Notes" ? (
                <>
                  <label>
                    Invoice ID (optional)
                    <input
                      type="number"
                      min="1"
                      value={form.invoiceId || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          invoiceId: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Credit amount (₹)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={form.amount || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          amount: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="sales-form-wide">
                    Reason
                    <input
                      required
                      maxLength="1000"
                      value={form.reason || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          reason: e.target.value,
                        })
                      }
                    />
                  </label>
                </>
              ) : (
                <>
                  {tab === "Recurring Invoices" && (
                    <>
                      <label>
                        Frequency
                        <select
                          value={form.frequency}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              frequency: e.target.value,
                            })
                          }
                        >
                          {[
                            "Weekly",
                            "Monthly",
                            "Quarterly",
                            "Yearly",
                          ].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Next run date
                        <input
                          type="date"
                          required
                          value={form.nextRunDate}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              nextRunDate: e.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        End date (optional)
                        <input
                          type="date"
                          min={form.nextRunDate}
                          value={form.endDate}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              endDate: e.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        Due days
                        <input
                          type="number"
                          min="0"
                          max="365"
                          value={form.dueDays}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              dueDays: e.target.value,
                            })
                          }
                        />
                      </label>
                    </>
                  )}

                  <div className="sales-line-items">
                    <div className="sales-line-heading">
                      <strong>Items</strong>

                      <button
                        type="button"
                        className="sales-secondary"
                        onClick={() =>
                          setForm({
                            ...form,
                            items: [...form.items, blankItem()],
                          })
                        }
                      >
                        ＋ Add item
                      </button>
                    </div>

                    {form.items.map((x, i) => (
                      <div className="sales-line" key={i}>
                        <label>
                          Description
                          {tab === "Delivery Challans" ? (
                            <DeliveryProductSearch
                              line={x}
                              onChange={(updates) =>
                                setForm((current) => ({
                                  ...current,
                                  items: current.items.map((item, index) =>
                                    index === i ? { ...item, ...updates } : item
                                  ),
                                }))
                              }
                              searchProducts={searchProducts}
                            />
                          ) : (
                            <input
                              required
                              value={x.productName}
                              onChange={(e) => changeItem(i, "productName", e.target.value)}
                            />
                          )}
                        </label>

                        <label>
                          Qty
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            required
                            value={x.quantity}
                            onChange={(e) =>
                              changeItem(i, "quantity", e.target.value)
                            }
                          />
                        </label>

                        {/* Pricing/tax fields are only for recurring invoices, not Delivery Challans. */}
                        {tab !== "Delivery Challans" && (
                          <>
                            <label>
                              Unit price
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                value={x.unitPrice}
                                onChange={(e) =>
                                  changeItem(i, "unitPrice", e.target.value)
                                }
                              />
                            </label>

                            <label>
                              Discount %
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={x.discountPercent}
                                onChange={(e) =>
                                  changeItem(i, "discountPercent", e.target.value)
                                }
                              />
                            </label>

                            <label>
                              GST %
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={x.taxPercent}
                                onChange={(e) =>
                                  changeItem(i, "taxPercent", e.target.value)
                                }
                              />
                            </label>
                          </>
                        )}

                        {form.items.length > 1 && (
                          <button
                            type="button"
                            className="sales-remove"
                            onClick={() =>
                              setForm({
                                ...form,
                                items: form.items.filter(
                                  (_, j) => i !== j
                                ),
                              })
                            }
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              <label className="sales-form-wide">
                Notes
                <textarea
                  rows="2"
                  value={form.notes || ""}
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

                <button className="sales-primary" disabled={busy}>
                  {busy ? "Saving…" : "Save"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function DeliveryProductSearch({ line, onChange, searchProducts }) {
  const [query, setQuery] = useState(line.productSearch || line.productName || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || query.trim().length < 2 || line.productId) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await searchProducts(query.trim());
        setResults(response.data || []);
      } catch (error) {
        console.error("Delivery Challan product search failed:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open, line.productId, searchProducts]);

  const selectProduct = (product) => {
    const name = [product.brand, product.modelSku, product.specsCapacity]
      .filter(Boolean)
      .join(" ");
    const productName = name || product.productCode || "";
    const productCode = product.productCode || "";
    onChange({
      productId: product.id,
      productName,
      productCode,
      productSearch: `${productName}${productCode ? ` — ${productCode}` : ""}`,
    });
    setQuery(`${productName}${productCode ? ` — ${productCode}` : ""}`);
    setOpen(false);
  };

  return (
    <div className="dc-product-search" style={{ position: "relative" }}>
      <input
        required
        value={query}
        placeholder="Search product, SKU or code..."
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          setOpen(true);
          onChange({
            productSearch: value,
            productId: null,
            productName: "",
            productCode: "",
          });
        }}
      />
      {open && query.trim().length >= 2 && !line.productId && (
        <div
          className="dc-product-results"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 30,
            maxHeight: 220,
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #d8e1ef",
            borderRadius: 6,
            boxShadow: "0 8px 20px rgba(20,40,80,.14)",
          }}
        >
          {loading && <div style={{ padding: "10px 12px", color: "#64748b" }}>Searching...</div>}
          {!loading && results.length === 0 && (
            <div style={{ padding: "10px 12px", color: "#64748b" }}>No products found.</div>
          )}
          {!loading && results.map((product) => {
            const name = [product.brand, product.modelSku, product.specsCapacity]
              .filter(Boolean)
              .join(" ") || product.productCode || "Product";
            const code = product.productCode || "";
            return (
              <button
                type="button"
                key={product.id}
                onClick={() => selectProduct(product)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 12px",
                  border: 0,
                  borderRadius: 0,
                  background: "white",
                  color: "#172b4d",
                  cursor: "pointer",
                }}
              >
                {name}{code ? ` — ${code}` : ""}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuotationConvert({ onDone }) {
  const [id, setId] = useState("");
  const [number, setNumber] = useState(
    `SO-${Date.now().toString().slice(-8)}`
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="sales-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");

        try {
          await api(
            `/sales/quotations/${encodeURIComponent(id)}/convert`,
            {
              method: "POST",
              body: JSON.stringify({ orderNumber: number }),
            }
          );

          onDone("Quotation converted to a sales order.");
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        Enter the existing quotation database ID. Conversion locks
        the quotation and prevents duplicate conversion.
      </p>

      {error && <div className="sales-error">{error}</div>}

      <label>
        Quotation ID
        <input
          required
          type="number"
          min="1"
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
      </label>

      <label>
        Sales order number
        <input
          required
          maxLength="80"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
      </label>

      <button className="sales-primary" disabled={busy}>
        {busy ? "Converting…" : "Convert quotation"}
      </button>
    </form>
  );
}
