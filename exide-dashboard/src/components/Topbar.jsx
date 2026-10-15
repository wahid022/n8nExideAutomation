
export default function Topbar({ search, onSearch }) {
  return (
    <header className="topbar">
      <div className="mobile-brand">Exide <span>& Microtek</span></div>

      <div className="global-search">
        <span className="search-icon">⌕</span>
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search product name, model, code..."
          aria-label="Search products"
        />
        {search && (
          <button onClick={() => onSearch("")} aria-label="Clear search">
            ×
          </button>
        )}
      </div>

      <div className="topbar-right">
        <div className="connection-indicator">
          <span className="status-dot" />
          Wahid
        </div>
        <div className="avatar">EM</div>
      </div>
    </header>
  );
}
