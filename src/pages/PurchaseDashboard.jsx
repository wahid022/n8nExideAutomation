import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { api } from "../lib/api";
import { moneyCompact } from "../lib/formatters";
import DonutChart from "../components/DonutChart";
import "./Purchase.css";
import "./SalesDashboard.css";

const PO_STATUS_COLOR = {
  Draft:               "#94a3b8",
  Sent:                "#0ea5e9",
  Confirmed:           "#6366f1",
  "Partially Received": "#f59e0b",
  Received:            "#16a34a",
  Cancelled:           "#ef4444",
};

function IconOrders() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 8h10M7 12h6M7 16h8" />
    </svg>
  );
}
function IconInvoice() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M5 2h10l4 4v16H5z" />
      <path d="M15 2v5h4M8 11h8M8 15h8M8 18h4" />
    </svg>
  );
}
function IconPayment() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export default function PurchaseDashboard({ activePage = "Purchase Dashboard" }) {
  const navigate = useNavigate();

  const { data: summaryRaw, isLoading: sumLoading, error: sumErr } = useQuery({ queryKey: ["purchase-summary"], queryFn: () => api("/purchase/summary"), staleTime: 20_000 });
  const { data: ordersRaw,  isLoading: ordLoading                 } = useQuery({ queryKey: ["purchase-orders", ""], queryFn: () => api("/purchase/orders?search="), staleTime: 20_000 });

  const summary = summaryRaw      || null;
  const orders  = ordersRaw?.data  || [];
  const loading = sumLoading || ordLoading;
  const error   = sumErr?.message  || "";

  const statusCounts = orders.reduce((acc, o) => {
    const s = o.status || "Unknown";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const statusValues = orders.reduce((acc, o) => {
    const s = o.status || "Unknown";
    acc[s] = (acc[s] || 0) + Number(o.grandTotal || 0);
    return acc;
  }, {});

  const totalOrderValue = Object.values(statusValues).reduce((s, v) => s + v, 0);

  const donutSegments = Object.entries(statusCounts).map(([status, count]) => ({
    label: status,
    value: count,
    color: PO_STATUS_COLOR[status] || "#94a3b8",
    unit: "POs",
  }));

  const invoiceValue = Number(summary?.invoices?.value || 0);
  const paid = Number(summary?.payments?.paid || 0);
  const outstanding = Number(summary?.outstanding || 0);
  const paymentEfficiency =
    invoiceValue > 0 ? Math.min(100, Math.round((paid / invoiceValue) * 100)) : 0;

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="purchase-page-shell">
      <Sidebar activePage={activePage} />
      <main className="purchase-main">
        <Topbar activePage={activePage} />

        <div className="sd-content">
          {/* Header */}
          <div className="sd-header">
            <div>
              <span className="purchase-eyebrow">BUSINESS MANAGEMENT</span>
              <h1 style={{ fontSize: 26, fontWeight: 800, margin: "5px 0", color: "#0F172A", letterSpacing: "-0.3px" }}>
                Purchase Dashboard
              </h1>
              <p style={{ margin: 0, color: "#64748B", fontSize: 13 }}>{todayLabel}</p>
            </div>
            <div className="sd-header-actions">
              <button className="purchase-secondary" onClick={() => navigate("/purchase/orders")}>+ New Order</button>
              <button className="purchase-primary" onClick={() => navigate("/purchase/invoices")}>+ New Invoice</button>
            </div>
          </div>

          {error && <div className="sales-error">{error}</div>}

          {/* KPI Cards */}
          <div className="sd-kpi-row">
            <div className="sd-kpi sd-kpi--blue">
              <div className="sd-kpi-top">
                <span className="sd-kpi-label">Purchase Orders</span>
                <div className="sd-kpi-icon"><IconOrders /></div>
              </div>
              <strong className="sd-kpi-value">{loading ? "—" : (summary?.orders?.count ?? "0")}</strong>
              <small className="sd-kpi-sub">{moneyCompact(summary?.orders?.value)} total value</small>
            </div>

            <div className="sd-kpi sd-kpi--green">
              <div className="sd-kpi-top">
                <span className="sd-kpi-label">Purchase Invoices</span>
                <div className="sd-kpi-icon"><IconInvoice /></div>
              </div>
              <strong className="sd-kpi-value">{loading ? "—" : (summary?.invoices?.count ?? "0")}</strong>
              <small className="sd-kpi-sub">{moneyCompact(invoiceValue)} invoice value</small>
            </div>

            <div className="sd-kpi sd-kpi--indigo">
              <div className="sd-kpi-top">
                <span className="sd-kpi-label">Total Paid</span>
                <div className="sd-kpi-icon"><IconPayment /></div>
              </div>
              <strong className="sd-kpi-value">{loading ? "—" : moneyCompact(paid)}</strong>
              <small className="sd-kpi-sub">Payments made to vendors</small>
            </div>

            <div className="sd-kpi sd-kpi--red">
              <div className="sd-kpi-top">
                <span className="sd-kpi-label">Outstanding</span>
                <div className="sd-kpi-icon"><IconAlert /></div>
              </div>
              <strong className="sd-kpi-value">{loading ? "—" : moneyCompact(outstanding)}</strong>
              <small className="sd-kpi-sub">Unpaid invoice balance</small>
            </div>
          </div>

          {/* Charts row */}
          <div className="sd-charts-row">
            {/* Donut — PO Status */}
            <div className="sd-card">
              <div className="sd-card-header"><h2>Order Status</h2></div>
              <div className="sd-donut-wrap">
                <DonutChart segments={donutSegments} />
                <div className="sd-donut-legend">
                  {donutSegments.map((seg) => (
                    <div key={seg.label} className="sd-legend-item">
                      <span className="sd-legend-dot" style={{ background: seg.color }} />
                      <span className="sd-legend-label">{seg.label}</span>
                      <strong className="sd-legend-val">{seg.value}</strong>
                    </div>
                  ))}
                  {donutSegments.length === 0 && (
                    <p className="sd-empty" style={{ padding: 0, textAlign: "left" }}>No orders yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Efficiency */}
            <div className="sd-card">
              <div className="sd-card-header"><h2>Payment Efficiency</h2></div>
              <div className="sd-gauge-wrap">
                <div className="sd-gauge-label">
                  <span>{loading ? "—" : `${paymentEfficiency}%`}</span>
                  <small>of invoice value paid</small>
                </div>
                <div className="sd-gauge-bar">
                  <div
                    className="sd-gauge-fill"
                    style={{
                      width: loading ? "0%" : `${paymentEfficiency}%`,
                      background: "linear-gradient(90deg, #34D399, #059669)",
                    }}
                  />
                </div>
                <div className="sd-gauge-ticks">
                  {[0, 25, 50, 75, 100].map((t) => (
                    <span key={t}>{t}%</span>
                  ))}
                </div>
                <div className="sd-gauge-pills">
                  <div className="sd-gauge-pill sd-gauge-pill--green">
                    <span>Paid</span>
                    <strong>{moneyCompact(paid)}</strong>
                  </div>
                  <div className="sd-gauge-pill sd-gauge-pill--red">
                    <span>Outstanding</span>
                    <strong>{moneyCompact(outstanding)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="sd-card">
              <div className="sd-card-header"><h2>Quick Actions</h2></div>
              <div className="sd-action-grid">
                <button className="sd-action-btn sd-action-btn--order" onClick={() => navigate("/purchase/orders")}>
                  <div className="sd-btn-icon">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                  New Order
                </button>
                <button className="sd-action-btn sd-action-btn--invoice" onClick={() => navigate("/purchase/invoices")}>
                  <div className="sd-btn-icon">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 2h10l4 4v16H5z" />
                      <polyline points="15 2 15 7 19 7" />
                    </svg>
                  </div>
                  New Invoice
                </button>
                <button
                  className="sd-action-btn"
                  style={{ "--hover-bg": "#FEF3C7", "--hover-color": "#D97706", "--hover-border": "#FDE68A" }}
                  onClick={() => navigate("/purchase/debit-notes")}
                >
                  <div className="sd-btn-icon" style={{ background: "#FEF3C7", border: "1.5px solid #FDE68A" }}>
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="#D97706">
                      <path d="M4 4h16v16H4z" />
                      <path d="M8 8h8M8 12h5" />
                      <path d="M16 15h-5m2-2-2 2 2 2" />
                    </svg>
                  </div>
                  Debit Note
                </button>
                <button className="sd-action-btn sd-action-btn--challan" onClick={() => navigate("/purchase/vendors")}>
                  <div className="sd-btn-icon">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="8" r="3" />
                      <path d="M2 20v-2a7 7 0 0 1 14 0v2z" />
                      <path d="M17 8h5M19.5 5.5v5" />
                    </svg>
                  </div>
                  Vendors
                </button>
              </div>
            </div>
          </div>

          {/* Spend by PO Status — stacked bar */}
          {totalOrderValue > 0 && (
            <div className="sd-card sd-revenue-card">
              <div className="sd-card-header">
                <h2>Spend by Order Status</h2>
                <span className="sd-revenue-total">{moneyCompact(totalOrderValue)} total</span>
              </div>
              <div className="sd-revenue-body">
                <div className="sd-stacked-bar">
                  {Object.entries(statusValues).map(([status, val]) => (
                    <div
                      key={status}
                      className="sd-stacked-seg"
                      style={{
                        width: `${(val / totalOrderValue) * 100}%`,
                        background: PO_STATUS_COLOR[status] || "#94a3b8",
                      }}
                      title={`${status}: ${moneyCompact(val)}`}
                    />
                  ))}
                </div>
                <div className="sd-stacked-legend">
                  {Object.entries(statusValues).map(([status, val]) => (
                    <div key={status} className="sd-stacked-item">
                      <span className="sd-legend-dot" style={{ background: PO_STATUS_COLOR[status] || "#94a3b8" }} />
                      <span>{status}</span>
                      <strong>{moneyCompact(val)}</strong>
                      <em>{Math.round((val / totalOrderValue) * 100)}%</em>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
