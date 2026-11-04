import { useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { api } from "../lib/api";
import { QK } from "../lib/queryKeys";
import { money, today, formatDate, statusClass } from "../lib/formatters";
import { useDebounce } from "../hooks/useDebounce";
import "./Sales.css";

export default function PaymentEntry({ activePage = "Payment Entry" }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 200);

  const { data: paymentsRaw, isLoading: loading } = useQuery({
    queryKey: [QK.salesPayments, debouncedSearch],
    queryFn: () => api(`/sales/payments?search=${encodeURIComponent(debouncedSearch)}`),
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });
  const { data: invoicesRaw } = useQuery({ queryKey: [QK.salesInvoices, ""], queryFn: () => api("/sales/invoices?search="), staleTime: 20_000 });
  const { data: customersRaw } = useQuery({ queryKey: [QK.customers], queryFn: () => api("/customers"), staleTime: 60_000 });

  const payments  = paymentsRaw?.data  || [];
  const invoices  = invoicesRaw?.data  || [];
  const customers = customersRaw?.data || [];

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    receiptNumber: "",
    customerId: "",
    invoiceId: "",
    date: today(),
    amount: "",
    paymentMethod: "UPI",
    referenceNumber: "",
    notes: "",
  });

  const customerInvoices = invoices.filter(
    (inv) => String(inv.customer?.id) === String(form.customerId)
  );

  const selectedCustomer = customers.find(
    (c) => String(c.id) === String(form.customerId)
  );

  const openCreate = () => {
    setError("");
    setNotice("");
    setForm({
      receiptNumber: `RCPT-${Date.now().toString().slice(-8)}`,
      customerId: customers[0] ? String(customers[0].id) : "",
      invoiceId: "",
      date: today(),
      amount: "",
      paymentMethod: "UPI",
      referenceNumber: "",
      notes: "",
    });
    setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (!selectedCustomer) throw new Error("Choose a customer first.");
      if (!form.amount || Number(form.amount) <= 0)
        throw new Error("Enter a valid payment amount.");

      await api("/sales/payments", {
        method: "POST",
        body: JSON.stringify({
          receiptNumber: form.receiptNumber,
          customerId: selectedCustomer.id,
          invoiceId: form.invoiceId || null,
          paymentDate: form.date,
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod,
          referenceNumber: form.referenceNumber || null,
          notes: form.notes || null,
        }),
      });

      setNotice("Payment recorded successfully.");
      setModal(false);
      qc.invalidateQueries({ queryKey: [QK.salesPayments] });
      qc.invalidateQueries({ queryKey: [QK.salesInvoices] });
      qc.invalidateQueries({ queryKey: [QK.salesSummary] });
    } catch (e) {
      setError(e.message || "Unable to save payment.");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    "Receipt No.",
    "Customer",
    "Invoice",
    "Date",
    "Amount",
    "Method",
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
              <span className="sales-eyebrow">ACCOUNTING</span>
              <h1>Payment Entry</h1>
              <p>Record customer payments against invoices.</p>
            </div>
            <button className="sales-primary" onClick={openCreate}>
              ＋ New payment
            </button>
          </div>

          {notice && <div className="sales-notice">{notice}</div>}
          {error && !modal && <div className="sales-error">{error}</div>}

          <section className="sales-card">
            <div className="sales-toolbar">
              <input
                aria-label="Search payments"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search receipt or customer…"
              />
            </div>

            <div className="sales-table-wrap">
              <table className="sales-table">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col}>{col}</th>
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
                  ) : payments.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="sales-empty">
                        No payment records yet. Use the button above to record
                        the first payment.
                      </td>
                    </tr>
                  ) : (
                    payments.map((rec) => (
                      <tr key={rec.id}>
                        <td>
                          <strong>{rec.receiptNumber || `#${rec.id}`}</strong>
                        </td>
                        <td>{rec.businessName || rec.customer?.businessName || "—"}</td>
                        <td>{rec.invoiceNumber || "—"}</td>
                        <td>{formatDate(rec.paymentDate)}</td>
                        <td>{money(rec.amount)}</td>
                        <td>{rec.paymentMethod || "—"}</td>
                        <td>
                          <span
                            className={`sales-status ${statusClass(rec.status)}`}
                          >
                            {rec.status || "Received"}
                          </span>
                        </td>
                      </tr>
                    ))
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
            aria-labelledby="payment-modal-title"
          >
            <header>
              <div>
                <h2 id="payment-modal-title">New Payment Entry</h2>
                <p>Record a customer payment against an invoice.</p>
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
                Receipt number
                <input
                  required
                  maxLength="80"
                  value={form.receiptNumber}
                  onChange={(e) =>
                    setForm({ ...form, receiptNumber: e.target.value })
                  }
                />
              </label>

              <label>
                Customer
                <select
                  required
                  value={form.customerId}
                  onChange={(e) =>
                    setForm({ ...form, customerId: e.target.value, invoiceId: "" })
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
                Invoice (optional)
                <select
                  value={form.invoiceId}
                  onChange={(e) =>
                    setForm({ ...form, invoiceId: e.target.value })
                  }
                >
                  <option value="">— Unlinked payment —</option>
                  {customerInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {money(inv.grandTotal)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Payment date
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>

              <label>
                Amount ₹
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </label>

              <label>
                Payment method
                <select
                  value={form.paymentMethod}
                  onChange={(e) =>
                    setForm({ ...form, paymentMethod: e.target.value })
                  }
                >
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </label>

              <label>
                Reference number
                <input
                  maxLength="120"
                  value={form.referenceNumber}
                  placeholder="UTR / Cheque No. / Transaction ID"
                  onChange={(e) =>
                    setForm({ ...form, referenceNumber: e.target.value })
                  }
                />
              </label>

              <label className="sales-form-wide">
                Notes
                <textarea
                  rows="2"
                  maxLength="2000"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
                  {saving ? "Saving…" : "Record payment"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
