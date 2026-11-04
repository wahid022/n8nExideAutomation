import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { api } from "../lib/api";
import { moneyCompact } from "../lib/formatters";
import DonutChart from "../components/DonutChart";
import "./Sales.css";
import "./SalesDashboard.css";

const STATUS_COLOR = {
  Draft: "#6366f1",
  Confirmed: "#16a34a",
  Cancelled: "#ef4444",
  Paid: "#0ea5e9",
};

function IconOrders() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}
function IconInvoice() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
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

export default function SalesDashboard({ activePage = "Sales Dashboard" }) {
  const navigate = useNavigate();

  const { data: summaryRaw, isLoading: sumLoading, error: sumErr } = useQuery({ queryKey: ["sales-summary"], queryFn: () => api("/sales/summary"), staleTime: 20_000 });
  const { data: ordersRaw,  isLoading: ordLoading                 } = useQuery({ queryKey: ["sales-orders", ""], queryFn: () => api("/sales/orders?search="), staleTime: 20_000 });

  const summary = summaryRaw     || null;
  const orders  = ordersRaw?.data || [];
  const loading = sumLoading || ordLoading;
  const error   = sumErr?.message || "";

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
    color: STATUS_COLOR[status] || "#94a3b8",
    unit: "ORDERS",
  }));

  const invoiceValue = Number(summary?.invoices?.value || 0);
  const received = Number(summary?.payments?.received || 0);
  const outstanding = Number(summary?.invoices?.outstanding || 0);
  const efficiency =
    invoiceValue > 0 ? Math.min(100, Math.round((received / invoiceValue) * 100)) : 0;

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="sales-page-shell">
      <Sidebar activePage={activePage} />
      <main className="sales-main">
        <Topbar activePage={activePage} />

        <div className="sd-content">
          {/* Header */}
          <div className="sd-header">
            <div>
              <span className="sales-eyebrow">BUSINESS MANAGEMENT</span>
              <h1>Sales Dashboard</h1>
              <p>{todayLabel}</p>
            </div>
            <div className="sd-header-actions">
              <button className="sales-secondary" onClick={() => navigate("/sales/orders")}>+ New Order</button>
              <button className="sales-primary" onClick={() => navigate("/sales/invoices")}>+ New Invoice</button>
            </div>
          </div>

          {error && <div className="sales-error">{error}</div>}

          {/* KPI Cards */}
          <div className="sd-kpi-row">
            <div className="sd-kpi sd-kpi--blue">
              <div className="sd-kpi-top">
                <span className="sd-kpi-label">Sales Orders</span>
                <div className="sd-kpi-icon"><IconOrders /></div>
              </div>
              <strong className="sd-kpi-value">{loading ? "—" : (summary?.orders?.count ?? "0")}</strong>
              <small className="sd-kpi-sub">{moneyCompact(summary?.orders?.value)} total value</small>
            </div>

            <div className="sd-kpi sd-kpi--green">
              <div className="sd-kpi-top">
                <span className="sd-kpi-label">Invoices</span>
                <div className="sd-kpi-icon"><IconInvoice /></div>
              </div>
              <strong className="sd-kpi-value">{loading ? "—" : (summary?.invoices?.count ?? "0")}</strong>
              <small className="sd-kpi-sub">{moneyCompact(invoiceValue)} invoice value</small>
            </div>

            <div className="sd-kpi sd-kpi--indigo">
              <div className="sd-kpi-top">
                <span className="sd-kpi-label">Payments Received</span>
                <div className="sd-kpi-icon"><IconPayment /></div>
              </div>
              <strong className="sd-kpi-value">{loading ? "—" : moneyCompact(received)}</strong>
              <small className="sd-kpi-sub">Recorded receipts</small>
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
            {/* Donut — Order Status */}
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

            {/* Collection Efficiency */}
            <div className="sd-card">
              <div className="sd-card-header"><h2>Collection Efficiency</h2></div>
              <div className="sd-gauge-wrap">
                <div className="sd-gauge-label">
                  <span>{loading ? "—" : `${efficiency}%`}</span>
                  <small>of invoice value collected</small>
                </div>
                <div className="sd-gauge-bar">
                  <div className="sd-gauge-fill" style={{ width: loading ? "0%" : `${efficiency}%` }} />
                </div>
                <div className="sd-gauge-ticks">
                  {[0, 25, 50, 75, 100].map((t) => (
                    <span key={t}>{t}%</span>
                  ))}
                </div>
                <div className="sd-gauge-pills">
                  <div className="sd-gauge-pill sd-gauge-pill--green">
                    <span>Collected</span>
                    <strong>{moneyCompact(received)}</strong>
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
                <button className="sd-action-btn sd-action-btn--order" onClick={() => navigate("/sales/orders")}>
                  <div className="sd-btn-icon">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                  New Order
                </button>
                <button className="sd-action-btn sd-action-btn--invoice" onClick={() => navigate("/sales/invoices")}>
                  <div className="sd-btn-icon">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  New Invoice
                </button>
                <button className="sd-action-btn sd-action-btn--challan" onClick={() => navigate("/sales-operations/delivery-challans")}>
                  <div className="sd-btn-icon">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="3" width="15" height="13" />
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                  </div>
                  Challan
                </button>
                <button className="sd-action-btn sd-action-btn--credit" onClick={() => navigate("/sales-operations/credit-notes")}>
                  <div className="sd-btn-icon">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                    </svg>
                  </div>
                  Credit Note
                </button>
              </div>
            </div>
          </div>

          {/* Revenue by Status — stacked bar */}
          {totalOrderValue > 0 && (
            <div className="sd-card sd-revenue-card">
              <div className="sd-card-header">
                <h2>Revenue by Order Status</h2>
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
                        background: STATUS_COLOR[status] || "#94a3b8",
                      }}
                      title={`${status}: ${moneyCompact(val)}`}
                    />
                  ))}
                </div>
                <div className="sd-stacked-legend">
                  {Object.entries(statusValues).map(([status, val]) => (
                    <div key={status} className="sd-stacked-item">
                      <span className="sd-legend-dot" style={{ background: STATUS_COLOR[status] || "#94a3b8" }} />
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
