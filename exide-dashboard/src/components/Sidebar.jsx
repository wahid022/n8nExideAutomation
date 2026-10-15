
const navItems = [
  { icon: "▦", label: "Dashboard" },
  { icon: "□", label: "Products" },
  { icon: "₹", label: "Price Lists" },
  { icon: "▤", label: "Categories" },
  { icon: "↻", label: "Import & Logs" },
];

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">E</div>
        <div>
          <div className="brand-name">
            Exide <span>& Microtek</span>
          </div>
          <div className="brand-subtitle">Product Catalogue</div>
        </div>
      </div>

      <nav className="nav-menu">
        {navItems.map((item) => (
          <button
            key={item.label}
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
            Awaiting data connection
          </span>
        </div>
      </div>
    </aside>
  );
}
