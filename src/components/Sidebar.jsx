
const navItems = [
  { icon: "▦", label: "Dashboard" },
  { icon: "▤", label: "Quotation" },
];

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">BB</div>

        <div>
          <div className="brand-name">
            Bharat Batteries
          </div>
          <div className="brand-subtitle">Wholesale Workspace</div>
        </div>
      </div>

      <nav className="nav-menu">
        {navItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`nav-item ${
              activePage === item.label ? "active" : ""
            }`}
            onClick={() => onNavigate(item.label)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="database-icon">▤</div>

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
