import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { api } from "../lib/api";
import { QK } from "../lib/queryKeys";
import { moneyCompact as money, fmtDate } from "../lib/formatters";
import DonutChart from "../components/DonutChart";
import "./Sales.css";
import "./SalesDashboard.css";
import "./Reports.css";

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const monthLabel = (yyyyMM) => { const [,m] = String(yyyyMM||"").split("-"); return MONTH_SHORT[parseInt(m,10)-1] || yyyyMM; };

const TODAY = new Date().toISOString().slice(0, 10);

function getPreset(key) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (key === "this-month") {
    return { from: `${y}-${String(m+1).padStart(2,"0")}-01`, to: TODAY };
  }
  if (key === "this-quarter") {
    const qs = new Date(y, Math.floor(m/3)*3, 1);
    return { from: qs.toISOString().slice(0,10), to: TODAY };
  }
  if (key === "this-fy") {
    const fyYear = m >= 3 ? y : y - 1;
    return { from: `${fyYear}-04-01`, to: TODAY };
  }
  return { from: `${y}-01-01`, to: TODAY };
}

function BarChart({ data = [], bar1Key, bar2Key, bar1Color = "#4f46e5", bar2Color = "#ef4444", height = 180 }) {
  if (!data.length) return <p className="rpt-empty">No data for this period.</p>;
  const maxVal = Math.max(1, ...data.flatMap(d => [Number(d[bar1Key]||0), bar2Key ? Number(d[bar2Key]||0) : 0]));
  const W = 600; const H = height; const PAD_B = 22; const PAD_T = 8;
  const chartH = H - PAD_B - PAD_T;
  const n = data.length;
  const groupW = W / n;
  const hasTwo = Boolean(bar2Key);
  const bw = Math.min(hasTwo ? groupW * 0.3 : groupW * 0.5, hasTwo ? 20 : 32);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {data.map((d, i) => {
        const cx = (i + 0.5) * groupW;
        const v1 = Number(d[bar1Key]||0);
        const v2 = hasTwo ? Number(d[bar2Key]||0) : 0;
        const h1 = (v1 / maxVal) * chartH;
        const h2 = (v2 / maxVal) * chartH;
        return (
          <g key={i}>
            <rect x={hasTwo ? cx - bw - 2 : cx - bw/2} y={PAD_T + chartH - h1} width={bw} height={Math.max(h1,0)} fill={bar1Color} rx={3} opacity={0.9}>
              <title>{money(v1)}</title>
            </rect>
            {hasTwo && <rect x={cx + 2} y={PAD_T + chartH - h2} width={bw} height={Math.max(h2,0)} fill={bar2Color} rx={3} opacity={0.9}><title>{money(v2)}</title></rect>}
            <text x={cx} y={H - 4} textAnchor="middle" fontSize="8.5" fill="#94a3b8">{monthLabel(d.month)}</text>
          </g>
        );
      })}
    </svg>
  );
}


function Loading() { return <div className="rpt-loading"><div className="rpt-spinner"/><span>Loading report&hellip;</span></div>; }
function ErrorMsg({ msg }) { return <div className="sales-error" style={{ margin: "20px 0" }}>{msg || "Failed to load report."}</div>; }

function KpiCard({ label, value, sub, accent = "blue", icon }) {
  return (
    <div className={`sd-kpi sd-kpi--${accent}`}>
      <div className="sd-kpi-top">
        <span className="sd-kpi-label">{label}</span>
        {icon && <div className="sd-kpi-icon">{icon}</div>}
      </div>
      <strong className="sd-kpi-value">{value}</strong>
      {sub && <small className="sd-kpi-sub">{sub}</small>}
    </div>
  );
}

const METHOD_COLOR = { UPI: "#8b5cf6", NEFT: "#0ea5e9", Cheque: "#f59e0b", Cash: "#059669", RTGS: "#4f46e5", "Bank Transfer": "#0d9488", Other: "#94a3b8" };
const methodColor = (m) => METHOD_COLOR[m] || METHOD_COLOR.Other;

function TallyLedger({ leftRows, rightRows }) {
  const maxLen = Math.max(leftRows.length, rightRows.length);
  const EMPTY = { type: "empty", label: "" };
  const left  = [...leftRows,  ...Array(Math.max(0, maxLen - leftRows.length)).fill(EMPTY)];
  const right = [...rightRows, ...Array(Math.max(0, maxLen - rightRows.length)).fill(EMPTY)];

  const renderSide = (rows) =>
    rows.map((row, i) => {
      const t = row.type || "item";
      if (t === "divider") return (
        <tr key={i}><td className="rpt-lr-divider" colSpan={3} /></tr>
      );
      const pad = (row.indent || 0) * 18 + 10;
      const sub = row.sub !== undefined
        ? (row.sub < 0 ? `(${money(Math.abs(row.sub))})` : money(row.sub))
        : "";
      const col = row.total !== undefined ? money(Math.abs(row.total)) : "";
      return (
        <tr key={i} className={`rpt-lr--${t}`}>
          <td className="rpt-lr-label" style={{ paddingLeft: pad }}>{row.label || " "}</td>
          <td className="rpt-lr-sub">{sub}</td>
          <td className="rpt-lr-col">{col}</td>
        </tr>
      );
    });

  return (
    <div className="sd-card rpt-ledger-card">
      <div className="rpt-ledger-wrap">
        <table className="rpt-ledger-table">
          <thead><tr>
            <th className="rpt-lh-label">Particulars</th>
            <th className="rpt-lh-amt">Amount</th>
            <th className="rpt-lh-amt">Total</th>
          </tr></thead>
          <tbody>{renderSide(left)}</tbody>
        </table>
        <div className="rpt-ledger-vline" />
        <table className="rpt-ledger-table">
          <thead><tr>
            <th className="rpt-lh-label">Particulars</th>
            <th className="rpt-lh-amt">Amount</th>
            <th className="rpt-lh-amt">Total</th>
          </tr></thead>
          <tbody>{renderSide(right)}</tbody>
        </table>
      </div>
    </div>
  );
}

function ProfitLoss({ from, to }) {
  const { data, isLoading, error } = useQuery({
    queryKey: [QK.reportsPL, from, to],
    queryFn: () => api(`/reports/profit-loss?from=${from}&to=${to}`),
    staleTime: 60_000,
  });
  if (isLoading) return <Loading />;
  if (error) return <ErrorMsg msg={error.message} />;
  if (!data) return null;

  const {
    revenue, creditDeductions, netRevenue,
    totalCogs, debitCredits, netCogs,
    directExpenses = 0, directByCategory = [],
    indirectExpenses = 0, indirectByCategory = [],
    totalExpenses = 0,
    grossProfit, grossMargin,
    netProfit = grossProfit, netMargin = grossMargin,
    monthly, revenueByGst = [], cogsByGst = [],
  } = data;

  const grossLoss = grossProfit < 0 ? Math.abs(grossProfit) : 0;
  const netLoss   = netProfit   < 0 ? Math.abs(netProfit)   : 0;

  // Trading Account - Dr (left)
  const drRows = [];
  drRows.push({ label: "TRADING ACCOUNT", type: "section" });
  drRows.push({ label: "Purchase Accounts", type: "subsection" });
  if (cogsByGst.length > 0) {
    for (const g of cogsByGst) drRows.push({ label: g.label, sub: g.taxable, indent: 1 });
  } else {
    drRows.push({ label: "Purchase Invoices", sub: totalCogs, indent: 1 });
  }
  if (debitCredits > 0) drRows.push({ label: "Less: Debit Notes", sub: -debitCredits, indent: 1 });
  drRows.push({ label: "Net Purchases", total: netCogs });
  drRows.push({ type: "empty" });

  drRows.push({ label: "Direct Expenses", type: "subsection" });
  if (directByCategory.length > 0) {
    for (const c of directByCategory) drRows.push({ label: c.name, sub: c.total, indent: 1 });
  } else {
    drRows.push({ label: "No direct expenses recorded", sub: 0, indent: 1 });
  }
  drRows.push({ label: "Total Direct Expenses", total: directExpenses });
  drRows.push({ type: "empty" });

  if (grossProfit >= 0) drRows.push({ label: "Gross Profit  c/f", total: grossProfit, type: "grand" });
  if (grossLoss   >  0) drRows.push({ label: "Gross Loss  c/f",   total: grossLoss,   type: "grand" });
  drRows.push({ type: "divider" });
  drRows.push({ label: "Total", total: netRevenue, type: "total" });
  drRows.push({ type: "divider" });

  // P&L Account - Dr (left)
  drRows.push({ label: "P&L ACCOUNT", type: "section" });
  drRows.push({ label: "Indirect Expenses", type: "subsection" });
  if (indirectByCategory.length > 0) {
    for (const c of indirectByCategory) drRows.push({ label: c.name, sub: c.total, indent: 1 });
  } else {
    drRows.push({ label: "No indirect expenses recorded", sub: 0, indent: 1 });
  }
  drRows.push({ label: "Total Indirect Expenses", total: indirectExpenses });
  drRows.push({ type: "empty" });

  if (netProfit >= 0) drRows.push({ label: "Net Profit",    total: netProfit, type: "grand" });
  if (netLoss   >  0) drRows.push({ label: "Net Loss  c/f", total: netLoss,   type: "grand" });
  drRows.push({ type: "divider" });
  const plDrTotal = grossProfit >= 0 ? grossProfit : indirectExpenses;
  drRows.push({ label: "Total", total: plDrTotal, type: "total" });
  drRows.push({ type: "divider" });
  drRows.push({ label: `Net Margin: ${netMargin}%`, type: "note" });

  // Trading Account - Cr (right)
  const crRows = [];
  crRows.push({ label: "TRADING ACCOUNT", type: "section" });
  crRows.push({ label: "Sales Accounts", type: "subsection" });
  if (revenueByGst.length > 0) {
    for (const g of revenueByGst) crRows.push({ label: g.label, sub: g.taxable, indent: 1 });
  } else {
    crRows.push({ label: "Gross Sales (Invoices)", sub: revenue, indent: 1 });
  }
  if (creditDeductions > 0) crRows.push({ label: "Less: Credit Notes", sub: -creditDeductions, indent: 1 });
  crRows.push({ label: "Net Sales", total: netRevenue });
  crRows.push({ type: "empty" });

  if (grossLoss > 0) crRows.push({ label: "Gross Loss  c/f", total: grossLoss, type: "grand" });
  else               crRows.push({ type: "empty" });
  crRows.push({ type: "empty" });
  crRows.push({ type: "divider" });
  crRows.push({ label: "Total", total: netRevenue, type: "total" });
  crRows.push({ type: "divider" });

  // P&L Account - Cr (right)
  crRows.push({ label: "P&L ACCOUNT", type: "section" });
  if (grossProfit >= 0) crRows.push({ label: "Gross Profit  b/f", total: grossProfit, type: "grand" });
  if (grossLoss   >  0) crRows.push({ label: "Gross Loss  b/f",  total: grossLoss,   type: "grand" });
  crRows.push({ type: "empty" });
  crRows.push({ type: "empty" });
  if (netLoss > 0) crRows.push({ label: "Net Loss  b/f", total: netLoss, type: "grand" });
  else             crRows.push({ type: "empty" });
  crRows.push({ type: "empty" });
  crRows.push({ type: "divider" });
  crRows.push({ label: "Total", total: plDrTotal, type: "total" });
  crRows.push({ type: "divider" });
  crRows.push({ label: `Gross Margin: ${grossMargin}%`, type: "note" });

  return (
    <div className="rpt-section">
      {/* KPI summary strip */}
      <div className="sd-kpi-row rpt-no-print" style={{ marginBottom: 18 }}>
        <KpiCard
          label="Net Revenue"
          value={money(netRevenue)}
          sub={creditDeductions > 0 ? `After credit notes ${money(creditDeductions)}` : "Gross sales net of returns"}
          accent="blue"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
        />
        <KpiCard
          label={grossProfit >= 0 ? "Gross Profit" : "Gross Loss"}
          value={money(Math.abs(grossProfit))}
          sub={`Margin ${grossMargin}% after purchases & direct exp.`}
          accent={grossProfit >= 0 ? "green" : "red"}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
        />
        <KpiCard
          label="Total Expenses"
          value={money(totalExpenses)}
          sub={`Direct ${money(directExpenses)} | Indirect ${money(indirectExpenses)}`}
          accent="indigo"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/></svg>}
        />
        <KpiCard
          label={netProfit >= 0 ? "Net Profit" : "Net Loss"}
          value={money(Math.abs(netProfit))}
          sub={`Net margin ${netMargin}% after all expenses`}
          accent={netProfit >= 0 ? "green" : "red"}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18"/><path d="M7 16l5-5 4 4 5-5"/></svg>}
        />
      </div>

      <div className="rpt-report-actions">
        <div className="rpt-period-label">Period: {fmtDate(from)} \u2014 {fmtDate(to)}</div>
        <button className="rpt-print-btn" onClick={() => window.print()}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print / Export PDF
        </button>
      </div>
      <div className="rpt-print-header">
        <div className="rpt-print-company">Bharat Batteries</div>
        <div className="rpt-print-title">Profit &amp; Loss Account</div>
        <div className="rpt-print-period">{fmtDate(from)} to {fmtDate(to)}</div>
      </div>

      <TallyLedger leftRows={drRows} rightRows={crRows} />

      {monthly.length > 0 && (
        <div className="sd-card rpt-no-print">
          <div className="sd-card-header">
            <h2>Monthly Revenue vs Total Cost</h2>
            <div className="rpt-legend">
              <span className="rpt-legend-dot" style={{ background: "#4f46e5" }} />Revenue
              <span className="rpt-legend-dot" style={{ background: "#ef4444", marginLeft: 12 }} />Total Cost (COGS + Expenses)
            </div>
          </div>
          <div style={{ padding: "16px 20px 12px" }}>
            <BarChart data={monthly} bar1Key="revenue" bar2Key="totalCost" bar1Color="#4f46e5" bar2Color="#ef4444" />
          </div>
        </div>
      )}
    </div>
  );
}


function BalanceSheet() {
  const { data, isLoading, error } = useQuery({
    queryKey: [QK.reportsBS],
    queryFn: () => api("/reports/balance-sheet"),
    staleTime: 60_000,
  });
  if (isLoading) return <Loading />;
  if (error) return <ErrorMsg msg={error.message} />;
  if (!data) return null;

  const { assets, liabilities, asOf } = data;
  const plProfit = liabilities.plProfit ?? 0;
  const gstPos = liabilities.gstPosition || {};

  // Group AP by vendor
  const apByVendor = {};
  for (const r of (liabilities.apDetail || [])) {
    if (!apByVendor[r.vendorName]) apByVendor[r.vendorName] = { name: r.vendorName, total: 0, invoices: [] };
    apByVendor[r.vendorName].total += r.outstanding;
    apByVendor[r.vendorName].invoices.push(r);
  }

  const liabRows = [];
  liabRows.push({ label: "Current Liabilities", type: "section" });
  liabRows.push({ label: "Sundry Creditors", type: "subsection" });
  for (const v of Object.values(apByVendor)) {
    liabRows.push({ label: v.name, sub: v.total, indent: 2 });
    for (const inv of v.invoices) {
      liabRows.push({ label: `${inv.invoiceNumber}  ${fmtDate(inv.dueDate)}`, sub: inv.outstanding, indent: 3, type: "detail" });
    }
  }
  if (Object.keys(apByVendor).length === 0) liabRows.push({ label: "No outstanding payables", sub: 0, indent: 2 });
  liabRows.push({ label: "Total Sundry Creditors", total: liabilities.accountsPayable });
  liabRows.push({ type: "empty" });
  liabRows.push({ label: "Duties & Taxes", type: "subsection" });
  liabRows.push({ label: "Output GST (Sales)", sub: gstPos.outputGst || 0, indent: 2 });
  liabRows.push({ label: "Less: Input GST (Purchases)", sub: -(gstPos.inputGst || 0), indent: 2 });
  liabRows.push({ label: "Net GST Payable", total: Math.max(0, gstPos.netGstPayable || 0) });
  liabRows.push({ type: "empty" });
  liabRows.push({ label: "Profit & Loss A/c", type: "subsection" });
  liabRows.push({ label: "Current Period Profit (Gross)", sub: plProfit, indent: 2 });
  liabRows.push({ label: " ", total: plProfit });
  liabRows.push({ type: "divider" });
  liabRows.push({ label: "Total", total: liabilities.totalLiabilities, type: "total" });

  const assetRows = [];
  assetRows.push({ label: "Current Assets", type: "section" });
  assetRows.push({ label: "Sundry Debtors  (Accounts Receivable)", type: "subsection" });
  for (const c of (assets.arDetail || [])) {
    assetRows.push({ label: c.name, sub: c.total, indent: 2 });
    for (const inv of c.invoices) {
      assetRows.push({ label: `${inv.invoiceNumber}  Due ${fmtDate(inv.dueDate)}${inv.status === "Overdue" ? " !" : ""}`, sub: inv.outstanding, indent: 3, type: inv.status === "Overdue" ? "detail-overdue" : "detail" });
    }
  }
  if ((assets.arDetail || []).length === 0) assetRows.push({ label: "No outstanding receivables", sub: 0, indent: 2 });
  assetRows.push({ label: "Total Sundry Debtors", total: assets.accountsReceivable });
  assetRows.push({ type: "empty" });
  assetRows.push({ label: "Cash-in-Hand & Bank  (Collected)", sub: assets.cashCollected, indent: 1 });
  assetRows.push({ label: " ", total: assets.totalAssets });
  assetRows.push({ type: "divider" });
  assetRows.push({ label: "Total", total: assets.totalAssets, type: "total" });

  return (
    <div className="rpt-section">
      <div className="rpt-report-actions">
        <div className="rpt-period-label">As at {fmtDate(asOf)}</div>
        <button className="rpt-print-btn" onClick={() => window.print()}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print / Export PDF
        </button>
      </div>
      <div className="rpt-print-header">
        <div className="rpt-print-company">Bharat Batteries</div>
        <div className="rpt-print-title">Balance Sheet</div>
        <div className="rpt-print-period">As at {fmtDate(asOf)}</div>
      </div>
      <TallyLedger leftRows={liabRows} rightRows={assetRows} />
    </div>
  );
}

function CashFlow({ from, to }) {
  const { data, isLoading, error } = useQuery({
    queryKey: [QK.reportsCF, from, to],
    queryFn: () => api(`/reports/cash-flow?from=${from}&to=${to}`),
    staleTime: 60_000,
  });
  if (isLoading) return <Loading />;
  if (error) return <ErrorMsg msg={error.message} />;
  if (!data) return null;

  const { totalInflow, totalOutflow, netCashFlow, monthly, recentPayments } = data;

  return (
    <div className="rpt-section">
      <div className="sd-kpi-row">
        <KpiCard label="Total Inflows" value={money(totalInflow)} sub="Payments received" accent="green"
          icon={<svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>} />
        <KpiCard label="Total Outflows" value={money(totalOutflow)} sub="Purchase payments made" accent="red"
          icon={<svg viewBox="0 0 24 24"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>} />
        <KpiCard label="Net Cash Flow" value={money(netCashFlow)} sub="Inflows minus outflows" accent={netCashFlow >= 0 ? "indigo" : "red"}
          icon={<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>} />
      </div>

      {monthly.length > 0 && (
        <div className="sd-card">
          <div className="sd-card-header">
            <h2>Monthly Cash Flow</h2>
            <div className="rpt-legend">
              <span className="rpt-legend-dot" style={{ background: "#059669" }}/>Inflows
              <span className="rpt-legend-dot" style={{ background: "#ef4444", marginLeft: 12 }}/>Outflows
            </div>
          </div>
          <div style={{ padding: "16px 20px 12px" }}>
            <BarChart data={monthly} bar1Key="inflow" bar2Key="outflow" bar1Color="#059669" bar2Color="#ef4444" />
          </div>
        </div>
      )}

      {recentPayments.length > 0 && (
        <div className="sd-card">
          <div className="sd-card-header"><h2>Recent Inflows</h2></div>
          <table className="rpt-table rpt-table--striped">
            <thead><tr><th>Receipt</th><th>Customer</th><th>Method</th><th>Date</th><th className="rpt-amt">Amount</th></tr></thead>
            <tbody>
              {recentPayments.map((p, i) => (
                <tr key={i}>
                  <td><strong>{p.receiptNumber || "—"}</strong></td>
                  <td>{p.customer?.businessName || "—"}</td>
                  <td><span className="rpt-method-badge" style={{ background: methodColor(p.paymentMethod) + "22", color: methodColor(p.paymentMethod) }}>{p.paymentMethod}</span></td>
                  <td>{fmtDate(p.paymentDate)}</td>
                  <td className="rpt-amt rpt-pos"><strong>{money(p.amount)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Banking({ from, to }) {
  const { data, isLoading, error } = useQuery({
    queryKey: [QK.reportsBanking, from, to],
    queryFn: () => api(`/reports/banking?from=${from}&to=${to}`),
    staleTime: 60_000,
  });
  if (isLoading) return <Loading />;
  if (error) return <ErrorMsg msg={error.message} />;
  if (!data) return null;

  const { summary, byMethod, recentTransactions, monthly } = data;
  const donutSegments = byMethod.map(m => ({ label: m.method, value: m.total, color: methodColor(m.method), pct: m.pct }));

  return (
    <div className="rpt-section">
      <div className="sd-kpi-row" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <KpiCard label="Total Received" value={money(summary.totalReceived)} sub="Completed payments" accent="green"
          icon={<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>} />
        <KpiCard label="Transactions" value={summary.transactionCount} sub={`${from} to ${to}`} accent="blue"
          icon={<svg viewBox="0 0 24 24"><path d="M7 7h13M7 12h13M7 17h13M3 7h.01M3 12h.01M3 17h.01"/></svg>} />
      </div>

      <div className="rpt-bs-grid">
        <div className="sd-card">
          <div className="sd-card-header"><h2>Payment Methods</h2></div>
          <div className="sd-donut-wrap">
            <DonutChart segments={donutSegments} centerLabel={{ top: summary.transactionCount, bottom: "txns" }} />
            <div className="sd-donut-legend">
              {byMethod.map(m => (
                <div key={m.method} className="sd-legend-item">
                  <span className="sd-legend-dot" style={{ background: methodColor(m.method) }}/>
                  <span className="sd-legend-label">{m.method}</span>
                  <div style={{ textAlign: "right" }}>
                    <strong className="sd-legend-val">{m.pct}%</strong>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>{money(m.total)}</div>
                  </div>
                </div>
              ))}
              {byMethod.length === 0 && <p className="sd-empty" style={{ padding: 0 }}>No payments yet.</p>}
            </div>
          </div>
        </div>

        {monthly.length > 0 && (
          <div className="sd-card">
            <div className="sd-card-header"><h2>Monthly Collections</h2></div>
            <div style={{ padding: "16px 20px 12px" }}>
              <BarChart data={monthly} bar1Key="total" bar1Color="#059669" height={160} />
            </div>
          </div>
        )}
      </div>

      {byMethod.length > 0 && (
        <div className="sd-card">
          <div className="sd-card-header"><h2>Breakdown by Method</h2></div>
          <div className="rpt-method-grid">
            {byMethod.map(m => (
              <div key={m.method} className="rpt-method-card" style={{ borderLeftColor: methodColor(m.method) }}>
                <div className="rpt-method-name" style={{ color: methodColor(m.method) }}>{m.method}</div>
                <div className="rpt-method-amount">{money(m.total)}</div>
                <div className="rpt-method-meta">{m.count} transaction{m.count !== 1 ? "s" : ""} &middot; {m.pct}%</div>
                <div className="rpt-method-bar"><div style={{ width: `${m.pct}%`, background: methodColor(m.method) }}/></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentTransactions.length > 0 && (
        <div className="sd-card">
          <div className="sd-card-header"><h2>Recent Transactions</h2></div>
          <table className="rpt-table rpt-table--striped">
            <thead><tr><th>Receipt</th><th>Customer</th><th>Method</th><th>Ref.</th><th>Date</th><th className="rpt-amt">Amount</th></tr></thead>
            <tbody>
              {recentTransactions.map((t, i) => (
                <tr key={i}>
                  <td><strong>{t.receiptNumber || "—"}</strong></td>
                  <td>{t.customer?.businessName || "—"}</td>
                  <td><span className="rpt-method-badge" style={{ background: methodColor(t.paymentMethod) + "22", color: methodColor(t.paymentMethod) }}>{t.paymentMethod}</span></td>
                  <td style={{ color: "#94a3b8", fontSize: 12 }}>{t.referenceNumber || "—"}</td>
                  <td>{fmtDate(t.paymentDate)}</td>
                  <td className="rpt-amt rpt-pos"><strong>{money(t.amount)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const TAB_BY_PAGE = { "Profit & Loss": "pl", "Balance Sheet": "bs", "Cash Flow": "cf", "Banking": "banking" };
const TABS = [
  { key: "pl",      label: "Profit & Loss" },
  { key: "bs",      label: "Balance Sheet" },
  { key: "cf",      label: "Cash Flow" },
  { key: "banking", label: "Banking" },
];

export default function Reports({ activePage }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState(TAB_BY_PAGE[activePage] || "pl");
  const [preset, setPreset] = useState("this-fy");
  const [dateRange, setDateRange] = useState(getPreset("this-fy"));

  useEffect(() => {
    if (TAB_BY_PAGE[activePage]) setTab(TAB_BY_PAGE[activePage]);
  }, [activePage]);

  const setPresetRange = (key) => { setPreset(key); setDateRange(getPreset(key)); };
  const hasDateFilter = tab !== "bs";

  const tabPaths = { pl: "/reports/profit-loss", bs: "/reports/balance-sheet", cf: "/reports/cash-flow", banking: "/reports/banking" };
  const handleTab = (key) => { setTab(key); navigate(tabPaths[key]); };

  const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="sales-page-shell">
      <Sidebar activePage={activePage} />
      <main className="sales-main">
        <Topbar activePage={activePage} />
        <div className="rpt-content">
          <div className="sd-header rpt-no-print">
            <div>
              <span className="sales-eyebrow">BUSINESS MANAGEMENT</span>
              <h1 style={{ fontSize: 26, fontWeight: 800, margin: "5px 0", color: "#0F172A", letterSpacing: "-0.3px" }}>Reports</h1>
              <p style={{ margin: 0, color: "#64748B", fontSize: 13 }}>{todayLabel}</p>
            </div>
          </div>

          <div className="rpt-topbar rpt-no-print">
            <div className="rpt-tabs">
              {TABS.map(t => (
                <button key={t.key} className={`rpt-tab ${tab === t.key ? "rpt-tab--active" : ""}`} onClick={() => handleTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>

            {hasDateFilter && (
              <div className="rpt-date-bar">
                {["this-month","this-quarter","this-fy"].map(p => (
                  <button key={p} className={`rpt-preset ${preset === p ? "rpt-preset--active" : ""}`} onClick={() => setPresetRange(p)}>
                    {p === "this-month" ? "This Month" : p === "this-quarter" ? "This Quarter" : "This FY"}
                  </button>
                ))}
                <div className="rpt-custom-range">
                  <input type="date" value={dateRange.from} onChange={e => { setPreset("custom"); setDateRange(d => ({...d, from: e.target.value})); }} />
                  <span>&mdash;</span>
                  <input type="date" value={dateRange.to} onChange={e => { setPreset("custom"); setDateRange(d => ({...d, to: e.target.value})); }} />
                </div>
              </div>
            )}
          </div>

          {tab === "pl"      && <ProfitLoss   from={dateRange.from} to={dateRange.to} />}
          {tab === "bs"      && <BalanceSheet />}
          {tab === "cf"      && <CashFlow     from={dateRange.from} to={dateRange.to} />}
          {tab === "banking" && <Banking      from={dateRange.from} to={dateRange.to} />}
        </div>
      </main>
    </div>
  );
}
