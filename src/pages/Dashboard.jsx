
import { Fragment, useEffect, useMemo, useState } from "react";
import { getProducts } from "../services/productService";
import useProductFilters from "../hooks/useProductFilters";
import useProductSorting from "../hooks/useProductSorting";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import PriceLookup from "../components/PriceLookup";

const DEFAULT_BRAND = "All Brands";
const DEFAULT_CATEGORY = "All Categories";
const DEFAULT_PAGE_SIZE = 25;

function formatINR(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
}

function getField(product, alias, workbookField) {
  return product?.[alias] ?? product?.[workbookField] ?? "";
}

function getProductCode(product) {
  return String(product?.product_id ?? product?.["Product Code"] ?? "").trim();
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function hasPrice(product, field) {
  const value = field === "MRP" ? getField(product, "mrp", "MRP") : getField(product, "dealer_price", "Dealer Price");
  return hasValue(value) && Number.isFinite(Number(value));
}

function catBadgeClass(category) {
  const c = String(category || "").toLowerCase();
  if (c.includes("automotive")) return "cat-badge--auto";
  if (c.includes("inverter")) return "cat-badge--inv";
  if (c.includes("tubular")) return "cat-badge--tub";
  if (c.includes("smf")) return "cat-badge--smf";
  return "cat-badge--other";
}

function Icon({ size = 18, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      {children}
    </svg>
  );
}

export default function Dashboard({ activePage = "Dashboard", onNavigate = () => {} }) {
  const [sortBy, setSortBy] = useState("default");
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [editingProductId, setEditingProductId] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      try {
        setLoading(true); setError("");
        const data = await getProducts();
        if (!cancelled) setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load products.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadProducts();
    return () => { cancelled = true; };
  }, []);

  const brands = useMemo(
    () => [...new Set(products.map(p => getField(p, "brand", "Brand")).filter(hasValue).map(v => String(v).trim()))].sort((a, b) => a.localeCompare(b)),
    [products]
  );
  const categories = useMemo(
    () => [...new Set(products.map(p => getField(p, "category", "Category")).filter(hasValue).map(v => String(v).trim()))].sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const filteredProducts = useProductFilters({ products, search, brand, category });
  const sortedProducts = useProductSorting({ products: filteredProducts, sortBy });
  const totalProducts = sortedProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
  const visiblePage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    const start = (visiblePage - 1) * pageSize;
    return sortedProducts.slice(start, start + pageSize);
  }, [sortedProducts, visiblePage, pageSize]);

  const startRecord = totalProducts === 0 ? 0 : (visiblePage - 1) * pageSize + 1;
  const endRecord = Math.min(visiblePage * pageSize, totalProducts);

  const pageNumbers = useMemo(() => {
    const max = 5;
    let start = Math.max(1, visiblePage - 2);
    let end = Math.min(totalPages, start + max - 1);
    start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [visiblePage, totalPages]);

  const pricedProductsCount = useMemo(
    () => products.filter(p => hasPrice(p, "MRP") || hasPrice(p, "Dealer Price")).length,
    [products]
  );

  const activeFilters = [
    brand !== DEFAULT_BRAND && { key: "brand", label: brand, clear: () => { setBrand(DEFAULT_BRAND); setCurrentPage(1); } },
    category !== DEFAULT_CATEGORY && { key: "cat", label: category, clear: () => { setCategory(DEFAULT_CATEGORY); setCurrentPage(1); } },
    sortBy !== "default" && { key: "sort", label: "Custom sort", clear: () => { setSortBy("default"); setCurrentPage(1); } },
    search !== "" && { key: "q", label: `"${search}"`, clear: () => { setSearch(""); setCurrentPage(1); } },
  ].filter(Boolean);

  function goToPage(page) { setCurrentPage(Math.min(Math.max(page, 1), totalPages)); }
  function clearFilters() { setSearch(""); setBrand(DEFAULT_BRAND); setCategory(DEFAULT_CATEGORY); setSortBy("default"); setCurrentPage(1); setEditingProductId(""); }

  function handlePriceUpdated({ product_code, field, value }) {
    setProducts(prev => prev.map(p => {
      if (getProductCode(p) !== String(product_code)) return p;
      if (field !== "MRP" && field !== "Dealer Price") return p;
      return { ...p, [field]: value, ...(field === "MRP" ? { mrp: value } : {}), ...(field === "Dealer Price" ? { dealer_price: value } : {}) };
    }));
  }

  return (
    <div className="app-layout">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <div className="main-area">
        <Topbar />

        <main className="page-content db-page">

          {/* ── Page Header ── */}
          <div className="db-header">
            <div>
              <p className="db-eyebrow">PRODUCT CATALOGUE</p>
              <h1 className="db-title">Product Dashboard</h1>
              <p className="db-subtitle">
                {loading
                  ? "Loading your catalogue…"
                  : `${products.length.toLocaleString()} products · ${brands.length} brands · ${categories.length} categories`}
              </p>
            </div>
            <span className={`db-live-pill ${loading ? "db-live-pill--loading" : error ? "db-live-pill--error" : "db-live-pill--ok"}`}>
              <span className="db-live-dot" />
              {loading ? "Syncing" : error ? "Offline" : "Live"}
            </span>
          </div>

          {error && <div className="db-error-banner" role="alert">⚠ {error}</div>}

          {/* ── Stat Cards ── */}
          <div className="db-stats">
            <div className="db-stat db-stat--blue">
              <div className="db-stat-top">
                <span className="db-stat-label">Total Products</span>
                <div className="db-stat-icon"><Icon><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></Icon></div>
              </div>
              <div className="db-stat-value">{loading ? "—" : products.length.toLocaleString()}</div>
              <div className="db-stat-note">From Product Master</div>
            </div>

            <div className="db-stat db-stat--rose">
              <div className="db-stat-top">
                <span className="db-stat-label">Brands</span>
                <div className="db-stat-icon"><Icon><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></Icon></div>
              </div>
              <div className="db-stat-value">{loading ? "—" : brands.length}</div>
              <div className="db-stat-note">{loading ? "Loading…" : brands.slice(0, 3).join(", ")}</div>
            </div>

            <div className="db-stat db-stat--violet">
              <div className="db-stat-top">
                <span className="db-stat-label">Categories</span>
                <div className="db-stat-icon"><Icon><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></Icon></div>
              </div>
              <div className="db-stat-value">{loading ? "—" : categories.length}</div>
              <div className="db-stat-note">Product types</div>
            </div>

            <div className="db-stat db-stat--amber">
              <div className="db-stat-top">
                <span className="db-stat-label">Priced</span>
                <div className="db-stat-icon"><Icon><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></Icon></div>
              </div>
              <div className="db-stat-value">{loading ? "—" : pricedProductsCount.toLocaleString()}</div>
              <div className="db-stat-note">
                {loading ? "Loading…" : `${Math.round(pricedProductsCount / (products.length || 1) * 100)}% with pricing set`}
              </div>
            </div>
          </div>

          {/* ── Catalogue ── */}
          <section className="db-catalogue">

            {/* Search + Filters */}
            <div className="db-toolbar">
              <div className="db-search">
                <Icon size={15}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></Icon>
                <input
                  value={search}
                  onChange={e => { setCurrentPage(1); setSearch(e.target.value); }}
                  placeholder="Search product, model, SKU or code…"
                  aria-label="Search products"
                />
                {search && <button className="db-search-x" onClick={() => { setSearch(""); setCurrentPage(1); }} aria-label="Clear">×</button>}
              </div>

              <select className="db-select" value={brand} onChange={e => { setCurrentPage(1); setBrand(e.target.value); setEditingProductId(""); }} aria-label="Brand">
                <option value={DEFAULT_BRAND}>All Brands</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>

              <select className="db-select" value={category} onChange={e => { setCurrentPage(1); setCategory(e.target.value); setEditingProductId(""); }} aria-label="Category">
                <option value={DEFAULT_CATEGORY}>All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select className="db-select" value={sortBy} onChange={e => { setCurrentPage(1); setSortBy(e.target.value); setEditingProductId(""); }} aria-label="Sort">
                <option value="default">Default order</option>
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
                <option value="price-asc">Price: Low → High</option>
                <option value="price-desc">Price: High → Low</option>
              </select>

              <div className="db-toolbar-right">
                {activeFilters.length > 0 && (
                  <button className="db-clear-btn" onClick={clearFilters}>✕ Clear ({activeFilters.length})</button>
                )}
                <span className="db-result-count">
                  {loading ? "…" : `${totalProducts.toLocaleString()} results`}
                </span>
              </div>
            </div>

            {/* Filter chips */}
            {activeFilters.length > 0 && (
              <div className="db-chips">
                {activeFilters.map(f => (
                  <button key={f.key} className="db-chip" onClick={f.clear}>
                    {f.label} ×
                  </button>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Brand</th>
                    <th>Category</th>
                    <th className="db-th-right">MRP</th>
                    <th className="db-th-right">Dealer Price</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i} className="db-skel-row">
                        <td>
                          <div className="db-skel" style={{ width: "72%", height: 13 }} />
                          <div className="db-skel" style={{ width: "38%", height: 10, marginTop: 7, borderRadius: 4 }} />
                        </td>
                        <td><div className="db-skel" style={{ width: "55%", height: 13 }} /></td>
                        <td><div className="db-skel" style={{ width: "60%", height: 20, borderRadius: 20 }} /></td>
                        <td><div className="db-skel" style={{ width: "60%", height: 13, marginLeft: "auto" }} /></td>
                        <td><div className="db-skel" style={{ width: "70%", height: 15, marginLeft: "auto" }} /></td>
                        <td><div className="db-skel" style={{ width: 68, height: 28, borderRadius: 6 }} /></td>
                      </tr>
                    ))
                  ) : error ? (
                    <tr><td colSpan={6}>
                      <div className="db-empty">
                        <div className="db-empty-icon">⚠</div>
                        <strong>Could not load products</strong>
                        <p>Check your connection and reload the page.</p>
                      </div>
                    </td></tr>
                  ) : paginatedProducts.length === 0 ? (
                    <tr><td colSpan={6}>
                      <div className="db-empty">
                        <div className="db-empty-icon">
                          <Icon size={30}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></Icon>
                        </div>
                        <strong>No products found</strong>
                        <p>Try a different search or clear your filters.</p>
                        <button className="db-clear-btn" onClick={clearFilters}>Clear all filters</button>
                      </div>
                    </td></tr>
                  ) : (
                    paginatedProducts.map((product, index) => {
                      const productId = getProductCode(product);
                      const productName = getField(product, "product_name", "Model / SKU");
                      const productBrand = getField(product, "brand", "Brand");
                      const productCategory = getField(product, "category", "Category");
                      const mrp = formatINR(getField(product, "mrp", "MRP"));
                      const dealer = formatINR(getField(product, "dealer_price", "Dealer Price"));
                      const isEditing = editingProductId === productId;

                      return (
                        <Fragment key={productId || index}>
                          <tr className={`db-row${isEditing ? " db-row--open" : ""}`}>
                            <td>
                              <span className="db-prod-name">{productName || "—"}</span>
                              {productId && <span className="db-prod-code">{productId}</span>}
                            </td>
                            <td className="db-brand">{productBrand || "—"}</td>
                            <td>
                              {productCategory
                                ? <span className={`cat-badge ${catBadgeClass(productCategory)}`}>{productCategory}</span>
                                : <span className="db-muted">—</span>}
                            </td>
                            <td className="db-price-mrp">
                              {mrp ? <span>{mrp}</span> : <span className="db-muted">—</span>}
                            </td>
                            <td className="db-price-dealer">
                              {dealer
                                ? <span className="db-dealer-val">{dealer}</span>
                                : <span className="db-no-price">Not set</span>}
                            </td>
                            <td className="db-action-col">
                              <button
                                type="button"
                                className={`db-edit-btn${isEditing ? " db-edit-btn--on" : ""}`}
                                disabled={!productId}
                                aria-expanded={isEditing}
                                onClick={() => setEditingProductId(isEditing ? "" : productId)}
                              >
                                {isEditing ? "✓ Done" : "Edit Price"}
                              </button>
                            </td>
                          </tr>

                          {isEditing && (
                            <tr className="db-editor-row">
                              <td colSpan={6}>
                                <PriceLookup
                                  key={productId}
                                  product={product}
                                  onPriceUpdated={handlePriceUpdated}
                                  onCancel={() => setEditingProductId("")}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="db-pager">
              <span className="db-pager-info">
                {loading ? "Loading…" : `${startRecord.toLocaleString()}–${endRecord.toLocaleString()} of ${totalProducts.toLocaleString()} products`}
              </span>

              <div className="db-pager-controls">
                <label className="db-page-size-label">
                  Show
                  <select value={pageSize} onChange={e => { setCurrentPage(1); setPageSize(Number(e.target.value)); setEditingProductId(""); }} disabled={loading}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>

                <div className="db-page-btns">
                  <button className="db-pgbtn" disabled={visiblePage === 1 || loading} onClick={() => goToPage(visiblePage - 1)}>‹</button>

                  {pageNumbers[0] > 1 && <>
                    <button className="db-pgbtn" disabled={loading} onClick={() => goToPage(1)}>1</button>
                    {pageNumbers[0] > 2 && <span className="db-ellipsis">…</span>}
                  </>}

                  {pageNumbers.map(page => (
                    <button key={page}
                      className={`db-pgbtn${visiblePage === page ? " db-pgbtn--cur" : ""}`}
                      disabled={loading}
                      onClick={() => goToPage(page)}
                      aria-current={visiblePage === page ? "page" : undefined}>
                      {page}
                    </button>
                  ))}

                  {pageNumbers[pageNumbers.length - 1] < totalPages && <>
                    {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span className="db-ellipsis">…</span>}
                    <button className="db-pgbtn" disabled={loading} onClick={() => goToPage(totalPages)}>{totalPages}</button>
                  </>}

                  <button className="db-pgbtn" disabled={visiblePage === totalPages || loading} onClick={() => goToPage(visiblePage + 1)}>›</button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
