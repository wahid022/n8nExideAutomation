import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { api } from "../lib/api";
import { money, today, fmtDate } from "../lib/formatters";
import { useDebounce } from "../hooks/useDebounce";
import { useAutoPrint } from "../hooks/useAutoPrint";
import "./Sales.css";

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

  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 200);

  const TAB_PATHS = {
    "Delivery Challans":  "/sales/challans",
    "Credit Notes":       "/sales/credit-notes",
    "Recurring Invoices": "/sales/recurring-invoices",
  };
  const TAB_KEYS = {
    "Delivery Challans":  "sales-challans",
    "Credit Notes":       "sales-credit-notes",
    "Recurring Invoices": "sales-recurring-invoices",
  };

  const { data: customersRaw } = useQuery({ queryKey: ["customers"], queryFn: () => api("/customers"), staleTime: 60_000 });
  const { data: rowsRaw, isLoading, error: rowsErr } = useQuery({
    queryKey: [TAB_KEYS[tab] || tab, debouncedSearch],
    queryFn: () => {
      const path = TAB_PATHS[tab];
      if (!path) return { data: [] };
      return api(`${path}${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ""}`);
    },
    enabled: tab !== "Quotation Conversion",
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });

  const customers = customersRaw?.data || [];
  const rows      = rowsRaw?.data      || [];

  const [form, setForm] = useState({});
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [viewCreditNote, setViewCreditNote] = useState(null);
  const [autoPrintCreditNote, setAutoPrintCreditNote] = useState(false);

  // Keep the standalone page selected even when navigating back/forward.
  useEffect(() => {
    if (isStandalone && VALID_TABS.includes(activePage)) {
      setTab(activePage);
      setSearch("");
      setModal(false);
    }
  }, [activePage, isStandalone]);


  const open = () => {
    setEditingId(null);
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

  const openEditCreditNote = (row) => {
    setEditingId(row.id);
    setError("");
    setNotice("");
    setForm({
      number: row.creditNoteNumber,
      customerId: String(row.customerId),
      date: String(row.creditDate || "").slice(0, 10) || today(),
      amount: row.amount || "",
      reason: row.reason || "",
      invoiceId: row.invoiceId ? String(row.invoiceId) : "",
      frequency: "Monthly",
      nextRunDate: today(),
      endDate: "",
      dueDays: 30,
      items: [blankItem()],
      notes: row.notes || "",
    });
    setModal(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setError("");
    setNotice("");
    setForm({
      number: row.challanNumber,
      customerId: String(row.customerId),
      date: String(row.challanDate || "").slice(0, 10) || today(),
      amount: "",
      reason: "",
      invoiceId: "",
      frequency: "Monthly",
      nextRunDate: today(),
      endDate: "",
      dueDays: 30,
      items: Array.isArray(row.items) && row.items.length > 0
        ? row.items.map((item) => ({
            productName: item.productName || "",
            productCode: item.productCode || "",
            productId: item.productId || "",
            productSearch: item.productName
              ? `${item.productName}${item.productCode ? ` — ${item.productCode}` : ""}`
              : "",
            quantity: item.quantity || 1,
            unitPrice: 0,
            discountPercent: 0,
            taxPercent: 18,
          }))
        : [blankItem()],
      notes: row.notes || "",
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
        path = editingId ? `/sales/challans/${editingId}` : "/sales/challans";

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
        path = editingId ? `/sales/credit-notes/${editingId}` : "/sales/credit-notes";

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
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      setNotice(
        tab === "Delivery Challans"
          ? editingId ? "Delivery Challan updated." : "Delivery Challan saved."
          : tab === "Credit Notes"
          ? "Credit Note saved."
          : "Recurring Invoice saved."
      );

      setModal(false);
      qc.invalidateQueries({ queryKey: [TAB_KEYS[tab] || tab] });
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
    <>
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

                      qc.invalidateQueries({ queryKey: [TAB_KEYS[tab] || tab] });
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
                        <th>{tab === "Recurring Invoices" ? "Next run" : "Date"}</th>
                        <th>{tab === "Credit Notes" ? "Amount" : "Items"}</th>
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
                        rows.map((r) => {
                          const rawDate = r.challanDate || r.creditDate || r.nextRunDate || "";
                          const formattedDate = rawDate
                            ? new Date(rawDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                            : "—";

                          const statusStyles = {
                            Draft:       { background: "#fef3c7", color: "#92400e" },
                            Dispatched:  { background: "#dbeafe", color: "#1e40af" },
                            Delivered:   { background: "#dcfce7", color: "#166534" },
                            Cancelled:   { background: "#fee2e2", color: "#991b1b" },
                            Issued:      { background: "#dbeafe", color: "#1e40af" },
                            Applied:     { background: "#dcfce7", color: "#166534" },
                            Void:        { background: "#fee2e2", color: "#991b1b" },
                            Active:      { background: "#dcfce7", color: "#166534" },
                            Paused:      { background: "#f1f5f9", color: "#475569" },
                          };
                          const statusLabel = r.status || (r.active ? "Active" : "Paused");
                          const badgeStyle = statusStyles[statusLabel] || { background: "#f1f5f9", color: "#475569" };

                          const itemSummary = (() => {
                            if (tab === "Credit Notes") return money(r.amount);
                            if (tab === "Recurring Invoices") return `${r.frequency} · every cycle`;
                            if (!Array.isArray(r.items) || r.items.length === 0) return "—";
                            const first = r.items[0];
                            const totalQty = r.items.reduce((s, x) => s + Number(x.quantity || 0), 0);
                            const label = first.productName || first.productCode || "Item";
                            const truncated = label.length > 32 ? label.slice(0, 32) + "…" : label;
                            return r.items.length === 1
                              ? `${truncated} × ${totalQty}`
                              : `${truncated} +${r.items.length - 1} more · Qty ${totalQty}`;
                          })();

                          const customerName = r.customer?.businessName || `Customer #${r.customerId || "—"}`;
                          const SO_AVATAR_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899"];
                          const soAvatarColor = SO_AVATAR_COLORS[customerName.charCodeAt(0) % SO_AVATAR_COLORS.length];

                          return (
                          <tr key={r.id} className="si-row">
                            {/* Document number */}
                            <td>
                              <div className="si-inv-num">
                                <svg className="si-inv-icon" viewBox="0 0 16 16" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="1.5" width="10" height="13" rx="1.5" stroke="currentColor"/><line x1="5" y1="5" x2="10.5" y2="5" stroke="currentColor" strokeWidth="1"/><line x1="5" y1="7.5" x2="10.5" y2="7.5" stroke="currentColor" strokeWidth="1"/><line x1="5" y1="10" x2="8" y2="10" stroke="currentColor" strokeWidth="1"/></svg>
                                <strong>{r[titleKey]}</strong>
                              </div>
                            </td>
                            {/* Customer with avatar */}
                            <td>
                              <div className="si-customer">
                                <span className="si-avatar" style={{ background: soAvatarColor }}>{customerName.charAt(0).toUpperCase()}</span>
                                <span className="si-customer-name">{customerName}</span>
                              </div>
                            </td>

                            <td style={{ whiteSpace: "nowrap" }}>{formattedDate}</td>

                            {/* Items + Notes stacked */}
                            <td>
                              <span style={{ display: "block" }}>{itemSummary}</span>
                              {tab === "Delivery Challans" && r.notes && (
                                <span style={{ fontSize: "0.8em", color: "#94a3b8", display: "block", marginTop: 2 }}>
                                  {r.notes.length > 55 ? r.notes.slice(0, 55) + "…" : r.notes}
                                </span>
                              )}
                            </td>

                            {/* Colored status badge */}
                            <td>
                              <span style={{
                                display: "inline-block",
                                padding: "3px 10px",
                                borderRadius: 999,
                                fontSize: "0.78em",
                                fontWeight: 600,
                                letterSpacing: "0.02em",
                                ...badgeStyle,
                              }}>
                                {statusLabel}
                              </span>
                            </td>

                            <td>
                              <div className="si-action-group">
                              {tab === "Delivery Challans" &&
                                r.status === "Draft" && (
                                  <button className="si-action-btn si-action-btn--edit" onClick={() => openEdit(r)}>
                                    <svg viewBox="0 0 14 14" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5l2 2-6 6H3.5v-2l6-6z"/><path d="M8 4l2 2"/></svg>
                                    Edit
                                  </button>
                                )}

                              {tab === "Delivery Challans" &&
                                r.status !== "Delivered" &&
                                r.status !== "Cancelled" && (
                                  <button
                                    className="si-action-btn si-action-btn--preview"
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
                                        qc.invalidateQueries({ queryKey: [TAB_KEYS[tab] || tab] });
                                      } catch (e) {
                                        setError(e.message);
                                      }
                                    }}
                                  >
                                    {r.status === "Draft" ? "Dispatch" : "Mark delivered"}
                                  </button>
                                )}

                              {tab === "Credit Notes" &&
                                !["Void"].includes(r.status) && (
                                  <button className="si-action-btn si-action-btn--edit" onClick={() => openEditCreditNote(r)}>
                                    <svg viewBox="0 0 14 14" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5l2 2-6 6H3.5v-2l6-6z"/><path d="M8 4l2 2"/></svg>
                                    Edit
                                  </button>
                                )}

                              {tab === "Credit Notes" &&
                                r.status === "Draft" && (
                                  <button
                                    className="si-action-btn si-action-btn--preview"
                                    onClick={async () => {
                                      try {
                                        await api(
                                          `/sales/credit-notes/${r.id}/status`,
                                          {
                                            method: "PATCH",
                                            body: JSON.stringify({ status: "Issued" }),
                                          }
                                        );
                                        qc.invalidateQueries({ queryKey: [TAB_KEYS[tab] || tab] });
                                      } catch (e) {
                                        setError(e.message);
                                      }
                                    }}
                                  >
                                    Issue
                                  </button>
                                )}

                              {tab === "Credit Notes" && (
                                <button className="si-action-btn si-action-btn--print" onClick={() => { setAutoPrintCreditNote(true); setViewCreditNote(r); }}>
                                  <svg viewBox="0 0 14 14" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 5V1.5h7V5"/><rect x="1.5" y="5" width="11" height="6" rx="1"/><path d="M3.5 9h7" strokeWidth="1"/><circle cx="11.5" cy="7" r="0.6" fill="currentColor"/></svg>
                                  Print
                                </button>
                              )}

                              {tab === "Credit Notes" && (
                                <button className="si-action-btn si-action-btn--preview" onClick={() => { setAutoPrintCreditNote(false); setViewCreditNote(r); }}>
                                  <svg viewBox="0 0 14 14" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7s2.5-4.5 6-4.5S13 7 13 7s-2.5 4.5-6 4.5S1 7 1 7z"/><circle cx="7" cy="7" r="1.75"/></svg>
                                  Preview
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

                                      qc.invalidateQueries({ queryKey: [TAB_KEYS[tab] || tab] });
                                    } catch (e) {
                                      setError(e.message);
                                    }
                                  }}
                                >
                                  {r.active ? "Pause" : "Activate"}
                                </button>
                              )}
                              </div>
                            </td>
                          </tr>
                          );
                        })
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
                <h2>{editingId ? "Edit" : "New"} {tab.toLowerCase()}</h2>
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

    {viewCreditNote && (
      <CreditNoteModal
        record={viewCreditNote}
        autoPrint={autoPrintCreditNote}
        onClose={() => setViewCreditNote(null)}
      />
    )}

    </>
  );
}

function CreditNoteModal({ record, autoPrint, onClose }) {
  useAutoPrint(autoPrint);

  const statusColors = {
    Draft:   { bg: "#fef9c3", color: "#854d0e" },
    Issued:  { bg: "#dbeafe", color: "#1e40af" },
    Applied: { bg: "#dcfce7", color: "#166534" },
    Void:    { bg: "#fee2e2", color: "#991b1b" },
  };
  const badge = statusColors[record.status] || { bg: "#f1f5f9", color: "#475569" };

  return (
    <div className="sales-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="sales-modal" style={{ maxWidth: 640, width: "100%" }} role="dialog" aria-modal="true" aria-label="Credit Note Preview">
        <header style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 14, marginBottom: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17 }}>Credit Note Preview</h2>
            <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: 13 }}>{record.creditNoteNumber}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="sales-secondary" onClick={() => window.print()}>Print</button>
            <button type="button" className="sales-close" onClick={onClose} aria-label="Close">×</button>
          </div>
        </header>

        <div className="sales-print-document" style={{ padding: "24px 28px" }}>
          {/* Company header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 20, color: "#172033", letterSpacing: "-0.3px" }}>Bharat Batteries</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Your Trusted Partner in Power Solutions</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{
                display: "inline-block",
                padding: "3px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                background: badge.bg,
                color: badge.color,
                marginBottom: 6,
              }}>{record.status || "Draft"}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#2563eb" }}>CREDIT NOTE</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{record.creditNoteNumber}</div>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1.5px solid #e2e8f0", margin: "0 0 20px" }} />

          {/* Meta grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Issued To</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#172033" }}>
                {record.customer?.businessName || `Customer #${record.customerId}`}
              </div>
              {record.customer?.phone && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{record.customer.phone}</div>}
              {record.customer?.email && <div style={{ fontSize: 12, color: "#64748b" }}>{record.customer.email}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Credit Date</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#172033" }}>{fmtDate(record.creditDate)}</div>
              {record.invoiceId && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginTop: 10, marginBottom: 4 }}>Against Invoice</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>#{record.invoiceId}</div>
                </>
              )}
            </div>
          </div>

          {/* Credit amount */}
          <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: ".06em" }}>Credit Amount</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#166534", marginTop: 2 }}>{money(record.amount)}</div>
            </div>
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>

          {/* Reason */}
          {record.reason && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Reason for Credit</div>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 13.5, color: "#334155", lineHeight: 1.5 }}>
                {record.reason}
              </div>
            </div>
          )}

          {/* Notes */}
          {record.notes && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Notes</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>{record.notes}</div>
            </div>
          )}

          <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "0 0 16px" }} />

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              Generated by Bharat Batteries Business Portal
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 28 }}>Authorised Signatory</div>
              <div style={{ borderTop: "1px solid #334155", paddingTop: 4, fontSize: 12, color: "#334155", fontWeight: 600 }}>
                Bharat Batteries
              </div>
            </div>
          </div>
        </div>
      </section>
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
