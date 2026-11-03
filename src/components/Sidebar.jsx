import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const groups = [
  {
    title: "Dashboard", icon: "⌂", initiallyOpen: true,
    items: [{ label: "Dashboard Overview", path: "/dashboard", done: true }]
  },
  {
    title: "Sales", icon: "🛒", initiallyOpen: true,
    items: [
      { label: "Sales Invoice", path: "/sales", salesTab: "Invoices", done: true },
      { label: "Sales Order", path: "/sales", salesTab: "Orders", done: true },
      { label: "Quotation", path: "/quotation", done: true },
      { label: "Credit Notes", path: "/sales-operations", tab: "Credit Notes", done: true },
      { label: "Delivery Challan", path: "/sales-operations", tab: "Delivery Challans", done: true },
      { label: "Customer List", path: "/customers", done: true },
    ]
  },
  {
    title: "Purchase", icon: "▣", initiallyOpen: false,
    items: [
      { label: "Purchase Invoice" }, { label: "Purchase Order" },
      { label: "Debit Notes" }, { label: "Vendor List" }
    ]
  },
  {
    title: "Reports", icon: "▥", initiallyOpen: false,
    items: [{ label: "Profit & Loss" }, { label: "Balance Sheet" }, { label: "Cash Flow" }, { label: "Banking" }]
  },
  {
    title: "Tax Compliance", icon: "⬡", initiallyOpen: true,
    items: [
      { label: "TDS Calculations" },
      { label: "GST Calculations", path: "/sales", done: true },
      { label: "GST Filing" }
    ]
  },
  {
    title: "Accounting", icon: "▤", initiallyOpen: true,
    items: [
      { label: "Receipt Entry", path: "/sales", done: true },
      { label: "Payment Entry", path: "/sales", done: true },
      { label: "Contra Entry" }, { label: "Journal Entry" }
    ]
  },
];

export default function Sidebar({ activePage }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState(() => Object.fromEntries(groups.map(g => [g.title, g.initiallyOpen])));
  const toggle = (title) => setOpenGroups(prev => ({ ...prev, [title]: !prev[title] }));

  const isActive = (item) => {
    if (!item.path) return false;
    if (item.path === "/sales-operations") return location.pathname === item.path;
    if (item.path === "/sales") return location.pathname === "/sales";
    return location.pathname === item.path;
  };

  const go = (item) => {
    if (!item.path) return;
    navigate(item.path, item.tab ? { state: { salesOperationsTab: item.tab } } : item.salesTab ? { state: { salesTab: item.salesTab } } : undefined);
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">BB</div>
        <div>
          <div className="brand-name">Bharat Batteries</div>
          <div className="brand-subtitle">Your Trusted Partner in Power Solutions</div>
        </div>
      </div>

      <nav className="nav-menu" aria-label="Main navigation">
        {groups.map((group) => {
          const expanded = !!openGroups[group.title];
          const groupActive = group.items.some(isActive);
          return (
            <section className={`nav-group ${groupActive ? "nav-group-active" : ""}`} key={group.title}>
              <button
                type="button"
                className={`nav-group-heading ${groupActive ? "active" : ""}`}
                aria-expanded={expanded}
                onClick={() => toggle(group.title)}
              >
                <span className="nav-icon">{group.icon}</span>
                <span className="nav-group-title">{group.title}</span>
                <span className={`nav-chevron ${expanded ? "expanded" : ""}`}>⌄</span>
              </button>
              {expanded && (
                <div className="nav-subitems">
                  {group.items.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className={`nav-subitem ${isActive(item) ? "active" : ""} ${!item.path ? "nav-subitem-pending" : ""}`}
                      onClick={() => go(item)}
                      disabled={!item.path}
                      title={!item.path ? "Planned for a future phase" : item.label}
                    >
                      <span className="nav-subitem-bullet">•</span>
                      <span className="nav-subitem-label">{item.label}</span>
                      <span className={`nav-status ${item.done ? "done" : "pending"}`} aria-label={item.done ? "Implemented" : "Planned"}>
                        {item.done ? "✓" : "•"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="database-icon">▤</div>
        <div>
          <strong>Master Database</strong>
          <p>Excel workbook</p>
          <span className="status-pill"><span className="status-dot" />Excel data source</span>
        </div>
      </div>
    </aside>
  );
}
