import { getAllPrices } from "../services/priceService";
// import { matchesPriceType } from "../utils/priceHelpers";
import useProductFilters from "../hooks/useProductFilters";
import { useEffect, useMemo, useState } from "react";
import useProductSorting from "../hooks/useProductSorting";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import StatCard from "../components/StatCard";
import PriceLookup from "../components/PriceLookup";


import { getProducts } from "../services/productService";
import { getProductPrices } from "../services/priceService";

const DEFAULT_BRAND = "All Brands";
const DEFAULT_CATEGORY = "All Categories";
const DEFAULT_PRICE_TYPE = "All Price Types";
const DEFAULT_PAGE_SIZE = 25;

const formatINR = (value) => {
    if (value === null || value === undefined || value === "") {
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
};




function getSourcePrice(prices, labels) {
    const matches = prices.filter((price) => {
        const label = String(price.source_price_label ?? "")
            .trim()
            .toLowerCase();
        const type = String(price.price_type ?? "")
            .trim()
            .toLowerCase();

        return labels.some(
            (candidate) =>
                label === candidate.toLowerCase() ||
                type === candidate.toLowerCase()
        );
    });

    const statusOf = (price) =>
        String(price.is_current ?? "").trim().toUpperCase();

    const active = matches.filter((price) =>
        statusOf(price).startsWith("ACTIVE")
    );

    const eligible = active.length
        ? active
        : matches.filter((price) =>
            statusOf(price) === "LIKELY CURRENT - VERIFY"
        );

    if (!eligible.length) return null;

    return [...eligible].sort((a, b) => {
        const dateA = new Date(a.effective_from ?? 0).getTime() || 0;
        const dateB = new Date(b.effective_from ?? 0).getTime() || 0;
        return dateB - dateA;
    })[0];
}





export default function Dashboard() {
    const [sortBy, setSortBy] = useState("default");
    const [activePage, setActivePage] = useState("Dashboard");
    const [search, setSearch] = useState("");
    const [brand, setBrand] = useState(DEFAULT_BRAND);
    const [category, setCategory] = useState(DEFAULT_CATEGORY);
    const [priceType, setPriceType] = useState(DEFAULT_PRICE_TYPE);
    const [allPrices, setAllPrices] = useState([]);
    const [allPricesLoading, setAllPricesLoading] = useState(false);
    const [allPricesError, setAllPricesError] = useState("");
    const [priceRefreshKey, setPriceRefreshKey] = useState(0);

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    const [pagePrices, setPagePrices] = useState({});
    const [pricesLoading, setPricesLoading] = useState(false);
    const [pricesError, setPricesError] = useState("");

    const [selectedProductId, setSelectedProductId] = useState("");
    const [selectedPrices, setSelectedPrices] = useState([]);
    const [selectedPricesLoading, setSelectedPricesLoading] = useState(false);
    const [selectedPricesError, setSelectedPricesError] = useState("");

    // Load the product catalogue.
    useEffect(() => {
        let cancelled = false;

        async function loadProducts() {
            try {
                setLoading(true);
                setError("");

                const data = await getProducts();

                if (!cancelled) {
                    setProducts(data);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err.message || "Failed to load products.");
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
        () => [
            ...new Set(
                products.map((product) => product.brand_id).filter(Boolean)
            ),
        ],
        [products]
    );

    const categories = useMemo(
        () => [
            ...new Set(
                products.map((product) => product.category_id).filter(Boolean)
            ),
        ],
        [products]
    );

    // Preserve existing product search and catalogue filters.
    const filteredProducts = useProductFilters({
        products,
        search,
        brand,
        category,
        priceType,
        allPrices,
    });

    const sortedProducts = useProductSorting({
        products: filteredProducts,
        sortBy,
        allPrices,
        priceType,
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

    // Fetch pricing only for the products shown on the current page.
    useEffect(() => {
        let cancelled = false;

        async function loadPagePrices() {
            const productIds = [
                ...new Set(
                    paginatedProducts
                        .map((product) => product.product_id)
                        .filter(Boolean)
                ),
            ];

            if (productIds.length === 0) {
                setPagePrices({});
                setPricesError("");
                setPricesLoading(false);
                return;
            }

            setPricesLoading(true);
            setPricesError("");

            const results = await Promise.allSettled(
                productIds.map(async (productId) => {
                    const response = await getProductPrices(productId);
                    return [productId, response.data ?? []];
                })
            );

            if (cancelled) return;

            const nextPrices = {};
            let failedCount = 0;

            for (const result of results) {
                if (result.status === "fulfilled") {
                    const [productId, prices] = result.value;
                    nextPrices[productId] = prices;
                } else {
                    failedCount += 1;
                }
            }

            setPagePrices(nextPrices);

            if (failedCount > 0) {
                setPricesError(
                    `Pricing could not be loaded for ${failedCount} product(s).`
                );
            }

            setPricesLoading(false);
        }

        loadPagePrices();

        return () => {
            cancelled = true;
        };
    }, [paginatedProducts, priceRefreshKey]);

    useEffect(() => {
        let cancelled = false;

        async function loadPrices() {
            try {
                setAllPricesLoading(true);
                setAllPricesError("");

                const result = await getAllPrices();

                if (!cancelled) {
                    setAllPrices(result.data);
                }
            } catch (err) {
                if (!cancelled) {
                    setAllPricesError(err.message || "Unable to load price records.");
                }
            } finally {
                if (!cancelled) {
                    setAllPricesLoading(false);
                }
            }
        }

        loadPrices();

        return () => {
            cancelled = true;
        };
    }, [priceRefreshKey]);

    // Fetch selected-product prices independently of the current page.
    useEffect(() => {
        if (!selectedProductId) {
            return;
        }

        let cancelled = false;

        async function loadSelectedPrices() {
            setSelectedPricesLoading(true);
            setSelectedPricesError("");
            setSelectedPrices([]);

            try {
                const response = await getProductPrices(selectedProductId);

                if (!cancelled) {
                    setSelectedPrices(response.data ?? []);
                }
            } catch (err) {
                if (!cancelled) {
                    setSelectedPricesError(
                        err.message || "Unable to load this product's prices."
                    );
                }
            } finally {
                if (!cancelled) {
                    setSelectedPricesLoading(false);
                }
            }
        }

        loadSelectedPrices();

        return () => {
            cancelled = true;
        };
    }, [selectedProductId, priceRefreshKey]);

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
        setPriceType(DEFAULT_PRICE_TYPE);
        setCurrentPage(1);
    }

    // Price type options are retained, but filtering by pricing data is not
    // applied until all matching product prices have been evaluated.
    const displayedPriceRecordCount = Object.values(pagePrices).reduce(
        (total, records) => total + records.length,
        0
    );

    return (
        <div className="app-layout">
            <Sidebar activePage={activePage} onNavigate={setActivePage} />

            <div className="main-area">
                <Topbar search={search} onSearch={handleSearch} />

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
                                className={`status-dot ${loading || error ? "pending" : ""}`}
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
                            note="From Products sheet"
                            color="blue"
                        />

                        <StatCard
                            icon="◆"
                            label="Brands"
                            value={loading ? "…" : brands.length}
                            note="Distinct brand identifiers"
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
                            label="Price Records"
                            value={pricesLoading ? "…" : displayedPriceRecordCount}
                            note="For products on this page"
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
                                <span>Price Type</span>
                                <select
                                    value={priceType}
                                    onChange={(event) => {
                                        setCurrentPage(1);
                                        setPriceType(event.target.value);
                                    }}
                                >
                                    <option value={DEFAULT_PRICE_TYPE}>All Price Types</option>
                                    <option value="MRP">MRP</option>
                                    <option value="MRCP">MRCP</option>
                                    <option value="Dealer Price">Dealer Price</option>
                                    <option value="Distributor Price">Distributor Price</option>
                                </select>
                            </label>

                            <label className="filter-field">
                                <span>Sort By</span>
                                <select
                                    value={sortBy}
                                    onChange={(event) => {
                                        setCurrentPage(1);
                                        setSortBy(event.target.value);
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

                        {pricesError && (
                            <div
                                role="alert"
                                style={{ color: "#b91c1c", padding: "8px 12px" }}
                            >
                                {pricesError}
                            </div>
                        )}

                        {allPricesLoading && (
                            <p>Loading price records for filtering...</p>
                        )}

                        {allPricesError && (
                            <p role="alert" style={{ color: "#b91c1c" }}>
                                Price filtering unavailable: {allPricesError}
                            </p>
                        )}

                        <div className="table-wrapper">
                            <table className="product-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Brand</th>
                                        <th>Model / Code</th>
                                        <th>Category</th>
                                        <th>MRP Source Value</th>
                                        <th>DP Source Value</th>
                                        <th>Price Details</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={8}>
                                                <div className="empty-state">
                                                    <h3>Loading products...</h3>
                                                    <p>Please wait while we fetch your catalogue.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : error ? (
                                        <tr>
                                            <td colSpan={8}>
                                                <div className="empty-state">
                                                    <h3>Unable to load products</h3>
                                                    <p>Check your n8n connection and try again.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : paginatedProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={8}>
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
                                            const prices = pagePrices[product.product_id] ?? [];
                                            const mrp = getSourcePrice(prices, ["MRP"]);
                                            const dp = getSourcePrice(prices, ["DP"]);

                                            return (
                                                <tr key={product.product_id || index}>
                                                    <td>
                                                        <strong>{product.product_name || "—"}</strong>
                                                        <div>{product.product_id || ""}</div>
                                                    </td>

                                                    <td>{product.brand_id || "—"}</td>
                                                    <td>{product.model || "—"}</td>
                                                    <td>{product.category_id || "—"}</td>

                                                    <td>
                                                        {pricesLoading && !pagePrices[product.product_id]
                                                            ? "Loading…"
                                                            : mrp
                                                                ? formatINR(mrp.source_price_value)
                                                                : "—"}
                                                    </td>

                                                    <td>
                                                        {pricesLoading && !pagePrices[product.product_id]
                                                            ? "Loading…"
                                                            : dp
                                                                ? formatINR(dp.source_price_value)
                                                                : "—"}
                                                    </td>

                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="secondary-button"
                                                            onClick={() =>
                                                                setSelectedProductId(product.product_id)
                                                            }
                                                        >
                                                            View Prices
                                                        </button>
                                                    </td>

                                                    <td>{product.notes || "—"}</td>
                                                </tr>
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
                                            className={`pagination-button ${visiblePage === page ? "active" : ""
                                                }`}
                                            aria-current={visiblePage === page ? "page" : undefined}
                                            disabled={loading}
                                            onClick={() => goToPage(page)}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                </div>

                                {pageNumbers[pageNumbers.length - 1] < totalPages && (
                                    <>
                                        {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
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

                    {selectedProductId && (
                        <section
                            style={{
                                position: "relative",
                                marginTop: 20,
                                padding: 16,
                                border: "1px solid var(--border-color, #e5e7eb)",
                                borderRadius: 12,
                                background: "var(--card-bg, #fff)",
                            }}
                        >
                            <button
                                type="button"
                                className="secondary-button"
                                style={{ float: "right" }}
                                onClick={() => setSelectedProductId("")}
                            >
                                Close
                            </button>

                            <h2>Prices for {selectedProductId}</h2>

                            <p>
                                Source values are retained as provided and are not necessarily
                                approved selling or quotation prices.
                            </p>

                            {selectedPricesLoading ? (
                                <p>Loading prices for {selectedProductId}...</p>
                            ) : selectedPricesError ? (
                                <p role="alert" style={{ color: "#b91c1c" }}>
                                    {selectedPricesError}
                                </p>
                            ) : selectedPrices.length === 0 ? (
                                <p>No pricing records were returned for {selectedProductId}.</p>
                            ) : (
                                <div className="table-wrapper">
                                    <table className="product-table">
                                        <thead>
                                            <tr>
                                                <th>Type</th>
                                                <th>Source Label</th>
                                                <th>Source Value</th>
                                                <th>Effective From</th>
                                                <th>Verification</th>
                                                <th>Current</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {selectedPrices.map((price) => (
                                                <tr key={price.product_price_id}>
                                                    <td>{price.price_type || "—"}</td>
                                                    <td>{price.source_price_label || "—"}</td>
                                                    <td>{formatINR(price.source_price_value)}</td>
                                                    <td>{price.effective_from || "—"}</td>
                                                    <td>
                                                        {price.verification_status || "Not specified"}
                                                    </td>
                                                    <td>{price.is_current ? "Yes" : "No"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {selectedPrices.map((price) => (
                                        <details
                                            key={`${price.product_price_id}-source`}
                                            style={{ marginTop: 12 }}
                                        >
                                            <summary>
                                                Source details — {price.product_price_id}
                                            </summary>

                                            <p>
                                                <strong>Reference:</strong>{" "}
                                                {price.source_row_reference || "Not provided"}
                                            </p>

                                            <p>
                                                <strong>Notes:</strong> {price.notes || "No notes"}
                                            </p>
                                        </details>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    <PriceLookup
                        onPriceUpdated={() => {
                            setPriceRefreshKey((current) => current + 1);
                        }}
                    />

                    <section className="bottom-grid">
                        <article className="info-panel">
                            <div className="panel-heading compact">
                                <div>
                                    <h2>Data Sources</h2>
                                    <p>Workbook sheets used in Phase 1</p>
                                </div>
                            </div>

                            {[
                                ["Products", "Product catalogue", !loading && !error],
                                ["Product_Identifiers", "Model and product codes", false],
                                [
                                    "Category_Master",
                                    "Brand and category filters",
                                    !loading && !error,
                                ],
                                ["Price_List_Register", "Source price lists", true],
                                ["Product_Prices", "Pricing API records", !pricesError],
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
                                    <strong>Load the product catalogue</strong>
                                    <p>React receives records through n8n.</p>
                                </div>
                            </div>

                            <div className="next-step">
                                <span className="step-number">02</span>
                                <div>
                                    <strong>Connect product pricing</strong>
                                    <p>Pricing is fetched by product ID for the visible page.</p>
                                </div>
                            </div>

                            <div className="next-step">
                                <span className="step-number">03</span>
                                <div>
                                    <strong>Validate catalogue data</strong>
                                    <p>
                                        Review source values, model matching, and approval before
                                        quotations.
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
