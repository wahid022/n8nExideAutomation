
import { Fragment, useEffect, useMemo, useState } from "react";
import { getProducts } from "../services/productService";
import useProductFilters from "../hooks/useProductFilters";
import useProductSorting from "../hooks/useProductSorting";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import StatCard from "../components/StatCard";
import PriceLookup from "../components/PriceLookup";

const DEFAULT_BRAND = "All Brands";
const DEFAULT_CATEGORY = "All Categories";
const DEFAULT_PAGE_SIZE = 25;

function formatINR(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return "—";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function getField(product, alias, workbookField) {
  return product?.[alias] ?? product?.[workbookField] ?? "";
}

function getProductCode(product) {
  return String(
    product?.product_id ?? product?.["Product Code"] ?? ""
  ).trim();
}

function hasValue(value) {
  return (
    value !== null &&
    value !== undefined &&
    String(value).trim() !== ""
  );
}

function hasPrice(product, field) {
  const value =
    field === "MRP"
      ? getField(product, "mrp", "MRP")
      : getField(product, "dealer_price", "Dealer Price");

  return hasValue(value) && Number.isFinite(Number(value));
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
        setLoading(true);
        setError("");

        const data = await getProducts();

        if (!cancelled) {
          setProducts(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to load products.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  const brands = useMemo(
    () =>
      [
        ...new Set(
          products
            .map((product) => getField(product, "brand", "Brand"))
            .filter(hasValue)
            .map((value) => String(value).trim())
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const categories = useMemo(
    () =>
      [
        ...new Set(
          products
            .map((product) => getField(product, "category", "Category"))
            .filter(hasValue)
            .map((value) => String(value).trim())
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const filteredProducts = useProductFilters({
    products,
    search,
    brand,
    category,
  });

  const sortedProducts = useProductSorting({
    products: filteredProducts,
    sortBy,
  });

  const totalProducts = sortedProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
  const visiblePage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    const startIndex = (visiblePage - 1) * pageSize;
    return sortedProducts.slice(startIndex, startIndex + pageSize);
  }, [sortedProducts, visiblePage, pageSize]);

  const startRecord =
    totalProducts === 0 ? 0 : (visiblePage - 1) * pageSize + 1;

  const endRecord = Math.min(visiblePage * pageSize, totalProducts);

  const pageNumbers = useMemo(() => {
    const maxVisiblePages = 5;
    let start = Math.max(1, visiblePage - 2);
    let end = Math.min(totalPages, start + maxVisiblePages - 1);

    start = Math.max(1, end - maxVisiblePages + 1);

    return Array.from(
      { length: end - start + 1 },
      (_, index) => start + index
    );
  }, [visiblePage, totalPages]);

  const pricedProductsCount = useMemo(
    () =>
      products.filter(
        (product) =>
          hasPrice(product, "MRP") ||
          hasPrice(product, "Dealer Price")
      ).length,
    [products]
  );

  function goToPage(page) {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  }

  function handleSearch(value) {
    setCurrentPage(1);
    setSearch(value);
  }

  function clearFilters() {
    setSearch("");
    setBrand(DEFAULT_BRAND);
    setCategory(DEFAULT_CATEGORY);
    setSortBy("default");
    setCurrentPage(1);
    setEditingProductId("");
  }

  function handlePriceUpdated({ product_code, field, value }) {
    setProducts((previous) =>
      previous.map((product) => {
        if (getProductCode(product) !== String(product_code)) {
          return product;
        }

        if (field !== "MRP" && field !== "Dealer Price") {
          return product;
        }

        return {
          ...product,
          [field]: value,
          ...(field === "MRP" ? { mrp: value } : {}),
          ...(field === "Dealer Price"
            ? { dealer_price: value }
            : {}),
        };
      })
    );
  }

  return (
    <div className="app-layout">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />

      <div className="main-area">
        <Topbar />

        <div className="dashboard-search-toolbar no-print">
          <div className="search-toolbar-label">Product catalogue</div>
          <div className="global-search">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={(event) => handleSearch(event.target.value)}
              placeholder="Search product name, model, code..."
              aria-label="Search products"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearch("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <main className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">PRODUCT INTELLIGENCE</div>
              <h1>{activePage}</h1>
              <p>
                Explore your Exide and Microtek catalogue and pricing data.
              </p>
            </div>

            <div className="data-status">
              <span
                className={`status-dot ${
                  loading || error ? "pending" : ""
                }`}
              />
              {loading
                ? "Loading product data..."
                : error
                  ? "Product API unavailable"
                  : "Product data connected"}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              style={{ color: "#b91c1c", marginBottom: 16 }}
            >
              Could not load products: {error}
            </div>
          )}

          <section className="stats-grid">
            <StatCard
              icon="□"
              label="Total Products"
              value={loading ? "…" : products.length}
              note="From Product Master"
              color="blue"
            />

            <StatCard
              icon="◆"
              label="Brands"
              value={loading ? "…" : brands.length}
              note="Distinct brands"
              color="red"
            />

            <StatCard
              icon="▦"
              label="Categories"
              value={loading ? "…" : categories.length}
              note="Distinct product categories"
              color="purple"
            />

            <StatCard
              icon="₹"
              label="Priced Products"
              value={loading ? "…" : pricedProductsCount}
              note="Products with MRP or Dealer Price"
              color="amber"
            />
          </section>

          <section className="catalogue-panel">
            <div className="panel-heading catalogue-header">
              <div className="catalogue-heading-text">
                <h2>Product Catalogue</h2>
                <p>
                  Search and explore products from your master workbook.
                </p>
              </div>

              <span className="record-count">
                {loading ? "Loading..." : `${totalProducts} products found`}
              </span>
            </div>

            <div className="filters-row">
              <label className="filter-field">
                <span>Brand</span>
                <select
                  value={brand}
                  onChange={(event) => {
                    setCurrentPage(1);
                    setBrand(event.target.value);
                    setEditingProductId("");
                  }}
                >
                  <option value={DEFAULT_BRAND}>All Brands</option>
                  {brands.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-field">
                <span>Category</span>
                <select
                  value={category}
                  onChange={(event) => {
                    setCurrentPage(1);
                    setCategory(event.target.value);
                    setEditingProductId("");
                  }}
                >
                  <option value={DEFAULT_CATEGORY}>All Categories</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-field">
                <span>Sort By</span>
                <select
                  value={sortBy}
                  onChange={(event) => {
                    setCurrentPage(1);
                    setSortBy(event.target.value);
                    setEditingProductId("");
                  }}
                >
                  <option value="default">Default Order</option>
                  <option value="name-asc">Product Name: A–Z</option>
                  <option value="name-desc">Product Name: Z–A</option>
                  <option value="brand-asc">Brand: A–Z</option>
                  <option value="brand-desc">Brand: Z–A</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                </select>
              </label>

              <button
                type="button"
                className="secondary-button"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>

            <div className="table-wrapper">
              <table className="product-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Brand</th>
                    <th>Model / Code</th>
                    <th>Category</th>
                    <th>MRP</th>
                    <th>Dealer Price</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">
                          <h3>Loading products...</h3>
                          <p>Please wait while we fetch your catalogue.</p>
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">
                          <h3>Unable to load products</h3>
                          <p>Check your n8n connection and try again.</p>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">
                          <h3>No matching products found</h3>
                          <p>
                            Try another search term or clear your filters.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedProducts.map((product, index) => {
                      const productId = getProductCode(product);
                      const productName = getField(
                        product,
                        "product_name",
                        "Model / SKU"
                      );
                      const productBrand = getField(
                        product,
                        "brand",
                        "Brand"
                      );
                      const productCategory = getField(
                        product,
                        "category",
                        "Category"
                      );
                      const modelCode =
                        product?.["Product Code"] || productId;
                      const mrpValue = getField(product, "mrp", "MRP");
                      const dealerPriceValue = getField(
                        product,
                        "dealer_price",
                        "Dealer Price"
                      );
                      const isEditing = editingProductId === productId;

                      return (
                        <Fragment key={productId || index}>
                          <tr>
                            <td>
                              <strong>{productName || "—"}</strong>
                              <div>{productId}</div>
                            </td>

                            <td>{productBrand || "—"}</td>
                            <td>{modelCode || "—"}</td>
                            <td>{productCategory || "—"}</td>
                            <td>{formatINR(mrpValue)}</td>
                            <td>{formatINR(dealerPriceValue)}</td>

                            <td>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={!productId}
                                aria-expanded={isEditing}
                                onClick={() =>
                                  setEditingProductId(
                                    isEditing ? "" : productId
                                  )
                                }
                              >
                                {isEditing ? "Close Editor" : "Edit Price"}
                              </button>
                            </td>
                          </tr>

                          {isEditing && (
                            <tr className="inline-price-editor-row">
                              <td colSpan={7} style={{ padding: 12 }}>
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

            <div className="table-footer catalogue-pagination">
              <div className="pagination-summary">
                {loading
                  ? "Loading products..."
                  : `Showing ${startRecord}–${endRecord} of ${totalProducts} products`}
              </div>

              <div className="pagination-controls">
                <label className="page-size-control">
                  <span>Rows per page</span>
                  <select
                    aria-label="Rows per page"
                    value={pageSize}
                    onChange={(event) => {
                      setCurrentPage(1);
                      setPageSize(Number(event.target.value));
                      setEditingProductId("");
                    }}
                    disabled={loading}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>

                <button
                  type="button"
                  className="pagination-button"
                  disabled={visiblePage === 1 || loading}
                  onClick={() => goToPage(visiblePage - 1)}
                  aria-label="Previous page"
                >
                  Previous
                </button>

                {pageNumbers[0] > 1 && (
                  <>
                    <button
                      type="button"
                      className="pagination-button"
                      disabled={loading}
                      onClick={() => goToPage(1)}
                    >
                      1
                    </button>
                    {pageNumbers[0] > 2 && (
                      <span className="page-ellipsis">…</span>
                    )}
                  </>
                )}

                <div className="pagination-pages">
                  {pageNumbers.map((page) => (
                    <button
                      type="button"
                      key={page}
                      className={`pagination-button ${
                        visiblePage === page ? "active" : ""
                      }`}
                      aria-current={
                        visiblePage === page ? "page" : undefined
                      }
                      disabled={loading}
                      onClick={() => goToPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                {pageNumbers[pageNumbers.length - 1] < totalPages && (
                  <>
                    {pageNumbers[pageNumbers.length - 1] <
                      totalPages - 1 && (
                      <span className="page-ellipsis">…</span>
                    )}
                    <button
                      type="button"
                      className="pagination-button"
                      disabled={loading}
                      onClick={() => goToPage(totalPages)}
                    >
                      {totalPages}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  className="pagination-button"
                  disabled={visiblePage === totalPages || loading}
                  onClick={() => goToPage(visiblePage + 1)}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            </div>
          </section>

          <section className="bottom-grid">
            <article className="info-panel">
              <div className="panel-heading compact">
                <div>
                  <h2>Data Sources</h2>
                  <p>Product catalogue and workbook prices</p>
                </div>
              </div>

              {[
                [
                  "Product Master",
                  "Unified product catalogue and prices",
                  !loading && !error,
                ],
                [
                  "Brand and Category",
                  "Derived from Product Master",
                  !loading && !error,
                ],
              ].map(([name, description, connected]) => (
                <div className="source-row" key={name}>
                  <span className="source-file-icon">▤</span>
                  <div>
                    <strong>{name}</strong>
                    <p>{description}</p>
                  </div>
                  <span className="source-pending">
                    {connected ? "Connected" : "Pending"}
                  </span>
                </div>
              ))}
            </article>

            <article className="info-panel next-panel">
              <div className="panel-heading compact">
                <div>
                  <h2>Next Steps</h2>
                  <p>Phase 1 implementation</p>
                </div>
              </div>

              <div className="next-step">
                <span className="step-number">01</span>
                <div>
                  <strong>Product catalogue</strong>
                  <p>Products load from the unified master workbook.</p>
                </div>
              </div>

              <div className="next-step">
                <span className="step-number">02</span>
                <div>
                  <strong>Price editing</strong>
                  <p>
                    Edit MRP or Dealer Price directly from each product row.
                  </p>
                </div>
              </div>

              <div className="next-step">
                <span className="step-number">03</span>
                <div>
                  <strong>Quotation generation</strong>
                  <p>
                    Confirm customer-specific pricing rules before
                    calculating quotations.
                  </p>
                </div>
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
