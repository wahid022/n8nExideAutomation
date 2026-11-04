
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Sidebar.css";

const ICON_PATHS = {
  dashboard: <><path d="m3 10 9-7 9 7" /><path d="M5 9.5V20h14V9.5" /><path d="M9 20v-6h6v6" /></>,
  salesDashboard: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 2 5-7" /><path d="M16 6h3v3" /></>,
  sales: <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.2a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6L23 6H6" /></>,
  invoice: <><path d="M6 2h9l5 5v15l-4-2-4 2-4-2-4 2V2z" /><path d="M14 2v6h6M8 12h8M8 16h8" /></>,
  order: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  quotation: <><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h5" /><path d="m14 16 2 2 4-4" /></>,
  credit: <><path d="M3 7h18v13H3z" /><path d="M3 7l3-4h12l3 4M8 12h8M8 16h5" /></>,
  delivery: <><path d="M3 6h11v11H3z" /><path d="M14 10h4l3 4v3h-7z" /><circle cx="7" cy="19" r="2" /><circle cx="18" cy="19" r="2" /></>,
  customers: <><circle cx="9" cy="8" r="4" /><path d="M2 21v-2a7 7 0 0 1 14 0v2z" /><path d="M16 4a4 4 0 0 1 0 8M18 14a6 6 0 0 1 4 6v1" /></>,
  purchase: <><path d="M3 7h18v13H3z" /><path d="M7 7V4h10v3M7 11h10M7 15h6" /></>,
  reports: <><path d="M4 20V4M4 20h17" /><rect x="7" y="12" width="3" height="6" /><rect x="13" y="8" width="3" height="10" /><rect x="19" y="5" width="2" height="13" /></>,
  tax: <><path d="m12 2 9 5v10l-9 5-9-5V7z" /><path d="M8 9h8M8 13h8M8 17h4" /></>,
  accounting: <><path d="M5 3h14v18H5z" /><path d="M8 7h8M8 11h8M8 15h8" /></>,
  purchaseInvoice: <><path d="M5 2h10l4 4v16H5z" /><path d="M15 2v5h4M8 11h8M8 15h8M8 18h4" /></>,
  purchaseOrder: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h10M7 12h6M7 16h8" /></>,
  debitNote: <><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h5" /><path d="M16 15h-5m2-2-2 2 2 2" /></>,
  vendor: <><circle cx="9" cy="8" r="3" /><path d="M2 20v-2a7 7 0 0 1 14 0v2z" /><path d="M17 8h5M19.5 5.5v5" /></>,
  profit: <><path d="M3 20h18M5 17l5-5 4 3 5-8" /><path d="M15 7h4v4" /></>,
  balance: <><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h8M8 16h4" /></>,
  cashflow: <><path d="M4 7h16M4 17h16" /><path d="m8 4-4 3 4 3M16 14l4 3-4 3" /></>,
  banking: <><path d="m3 9 9-6 9 6" /><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" /></>,
  tds: <><path d="M4 3h16v18H4z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  gst: <><path d="M4 3h16v18H4z" /><path d="M8 8h8M8 12h8M8 16h4" /></>,
  filing: <><path d="M6 2h9l5 5v15H6z" /><path d="M15 2v6h5M9 13l2 2 4-4" /></>,
  receipt: <><path d="M5 2h14v20l-3-2-4 2-4-2-3 2z" /><path d="M8 8h8M8 12h8" /></>,
  payment: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  contra: <><path d="M7 7h13l-3-3M17 17H4l3 3" /><path d="M20 7v5M4 17v-5" /></>,
  journal: <><path d="M4 3h16v18H4z" /><path d="M8 7h8M8 11h8M8 15h5" /></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
};

function NavIcon({ name, size = 18 }) {
  return (
    <svg
      className="bb-svg-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

const NAV_GROUPS = [

  {
    title: "Sales",
    icon: "sales",
    items: [
      {
        label: "Sales Dashboard",
        icon: "salesDashboard",
        path: "/sales",
      },
      {
        label: "Sales Invoice",
        icon: "invoice",
        path: "/sales/invoices",
      },
      {
        label: "Sales Order",
        icon: "order",
        path: "/sales/orders",
      },
      {
        label: "Quotation",
        icon: "quotation",
        path: "/sales/quotation",
      },
      {
        label: "Credit Notes",
        icon: "credit",
        path: "/sales-operations/credit-notes",
      },
      {
        label: "Delivery Challan",
        icon: "delivery",
        path: "/sales-operations/delivery-challans",
      },
      {
        label: "Customers",
        icon: "customers",
        path: "/sales/customers",
      },
    ],
  },

  {
    title: "Purchase",
    icon: "purchase",
    items: [
      { label: "Purchase Invoice", icon: "purchaseInvoice" },
      { label: "Purchase Order", icon: "purchaseOrder" },
      { label: "Debit Notes", icon: "debitNote" },
      { label: "Vendor List", icon: "vendor" },
    ],
  },
  {
    title: "Reports",
    icon: "reports",
    items: [
      { label: "Profit & Loss", icon: "profit" },
      { label: "Balance Sheet", icon: "balance" },
      { label: "Cash Flow", icon: "cashflow" },
      { label: "Banking", icon: "banking" },
    ],
  },
  {
    title: "Tax & Compliance",
    icon: "tax",
    items: [
      { label: "TDS Calculations", icon: "tds" },
      { label: "GST Calculations", icon: "gst", path: "/sales" },
      { label: "GST Filing", icon: "filing" },
    ],
  },
  {
    title: "Accounting",
    icon: "accounting",
    items: [
      { label: "Receipt Entry", icon: "receipt", path: "/sales" },
      { label: "Payment Entry", icon: "payment" },
      { label: "Contra Entry", icon: "contra" },
      { label: "Journal Entry", icon: "journal" },
    ],
  },
];

export default function Sidebar({ activePage }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [expanded, setExpanded] = useState({ Sales: true });

  const toggle = (title) =>
    setExpanded((old) => ({ ...old, [title]: !old[title] }));

  const dashboardActive = location.pathname === "/dashboard";

  const isItemActive = (item) => {
    if (!item.path) return false;
    return location.pathname === item.path;
  };

  const go = (item) => {
    if (!item.path) return;

    navigate(item.path, {
      state: item.state || null,
    });
  };

  return (
    <aside className="sidebar bb-sidebar">
      <div className="brand bb-brand">
        <div className="brand-mark">BB</div>
        <div>
          <div className="brand-name">Bharat Batteries</div>
          <div className="brand-subtitle">
            Your Trusted Partner in Power Solutions
          </div>
        </div>
      </div>

      <nav className="nav-menu bb-nav" aria-label="Main navigation">
        <button
          className={`bb-dashboard ${dashboardActive ? "bb-active" : ""}`}
          type="button"
          onClick={() => navigate("/dashboard")}
        >
          <span className="bb-nav-icon">
            <NavIcon name="dashboard" />
          </span>
          <span>Dashboard</span>
        </button>

        {NAV_GROUPS.map((group) => {
          const open = !!expanded[group.title];
          const active = group.items.some(isItemActive);

          return (
            <section className="bb-group" key={group.title}>
              <button
                type="button"
                className={`bb-group-head ${active ? "bb-group-current" : ""
                  }`}
                aria-expanded={open}
                onClick={() => toggle(group.title)}
              >
                <span className="bb-nav-icon">
                  <NavIcon name={group.icon} />
                </span>

                <span className="bb-group-title">{group.title}</span>

                <span
                  className={`bb-chevron ${open ? "bb-chevron-open" : ""
                    }`}
                >
                  ⌄
                </span>
              </button>

              {open && (
                <div className="bb-subnav">
                  {group.items.map((item) => {
                    const selected = isItemActive(item);
                    const pending = !item.path;

                    return (
                      <button
                        key={item.label}
                        type="button"
                        className={`bb-subitem ${selected ? "bb-selected" : ""
                          } ${pending ? "bb-pending" : ""}`}
                        disabled={pending}
                        onClick={() => go(item)}
                      >
                        <span className="bb-sub-icon">
                          <NavIcon name={item.icon || "order"} size={15} />
                        </span>

                        <span className="bb-sub-label">{item.label}</span>

                        {pending && (
                          <span className="bb-soon">Soon</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </nav>

      <div className="sidebar-bottom bb-database">
        <div className="database-icon">
          <NavIcon name="database" size={20} />
        </div>

        <div>
          <strong>Master Database</strong>
          <p>Excel workbook</p>
          <span className="status-pill">
            <span className="status-dot" />
            Excel data source
          </span>
        </div>
      </div>
    </aside>
  );
}
