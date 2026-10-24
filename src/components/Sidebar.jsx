
import { useNavigate } from "react-router-dom";

const navItems = [
  { icon: "▦", label: "Dashboard", path: "/dashboard" },
  { icon: "▤", label: "Quotation", path: "/quotation" },
  { icon: "♙", label: "Customers", path: "/customers" },
];

export default function Sidebar({ activePage }) {
  const navigate = useNavigate();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">BB</div>

        <div>
          <div className="brand-name">Bharat Batteries</div>
          <div className="brand-subtitle">Your Trusted Partner in Power Solutions</div>
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
            onClick={() => navigate(item.path)}
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
