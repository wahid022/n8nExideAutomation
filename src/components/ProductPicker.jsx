import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/formatters";

export default function ProductPicker({ line, onChange, defaultTaxPercent = 18, products = null }) {
  const [query, setQuery] = useState(line.productName || "");
  const [serverResults, setServerResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Client-side filtering when pre-loaded products are provided
  const clientResults = useMemo(() => {
    if (products === null || !open) return [];
    const term = query.trim().toLowerCase();
    if (!term) return products.slice(0, 24);
    return products
      .filter((p) =>
        [p.productCode, p.brand, p.modelSku, p.specsCapacity, p.category]
          .filter(Boolean).join(" ").toLowerCase().includes(term)
      )
      .slice(0, 24);
  }, [products, query, open]);

  const results = products !== null ? clientResults : serverResults;

  // Server-side search — only used when no pre-loaded products prop
  useEffect(() => {
    if (products !== null) return;
    if (!open || query.trim().length < 2) { setServerResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api(`/products?search=${encodeURIComponent(query.trim())}&pageSize=20`);
        setServerResults(result.data || []);
      } catch {
        setServerResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open, products]);

  const selectProduct = (product) => {
    const name = [product.brand, product.modelSku, product.specsCapacity].filter(Boolean).join(" ");
    onChange({
      ...line,
      productId: product.id,
      productName: name || product.productCode,
      productCode: product.productCode || "",
      brand: product.brand || "",
      modelSku: product.modelSku || "",
      mrp: product.mrp ?? null,
      unitPrice: Number(product.dealerPrice ?? 0),
      taxPercent: Number(product.gstRate ?? defaultTaxPercent),
    });
    setQuery(name || product.productCode || "");
    setOpen(false);
  };

  return (
    <div className="sales-product-picker">
      <input
        required
        maxLength={250}
        value={query}
        placeholder="Search product, SKU or code…"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const value = e.target.value;
          setQuery(value);
          setOpen(true);
          onChange({ ...line, productId: null, productName: value, productCode: "", brand: "", modelSku: "", mrp: null });
        }}
      />
      {line.productCode && (
        <small>Code: {line.productCode}{line.mrp != null ? ` | MRP: ${money(line.mrp)}` : ""}</small>
      )}
      {open && (
        <div className="sales-product-results">
          {loading && <div className="sales-product-option">Searching…</div>}

          {/* Pre-loaded mode: no results message */}
          {!loading && products !== null && results.length === 0 && (
            <div className="sales-product-option">
              {query.trim() ? "No products match your search." : "Loading catalogue…"}
            </div>
          )}

          {/* Server-search mode: hints */}
          {!loading && products === null && query.trim().length < 2 && (
            <div className="sales-product-option" style={{ color: "#94a3b8", fontStyle: "italic" }}>
              Type at least 2 characters to search…
            </div>
          )}
          {!loading && products === null && query.trim().length >= 2 && results.length === 0 && (
            <div className="sales-product-option">No products found.</div>
          )}

          {results.map((product) => (
            <button
              type="button"
              className="sales-product-option"
              key={product.id ?? product.productCode}
              onClick={() => selectProduct(product)}
            >
              <strong>{[product.brand, product.modelSku, product.specsCapacity].filter(Boolean).join(" ") || product.productCode}</strong>
              <span>Code: {product.productCode || "—"} | Dealer: {money(product.dealerPrice)} | MRP: {money(product.mrp)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
