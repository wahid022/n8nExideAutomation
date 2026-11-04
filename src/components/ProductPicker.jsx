import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/formatters";

export default function ProductPicker({ line, onChange, defaultTaxPercent = 18 }) {
  const [query, setQuery] = useState(line.productName || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || query.trim().length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api(`/products?search=${encodeURIComponent(query.trim())}&pageSize=20`);
        setResults(result.data || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open]);

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
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="sales-product-option">No products found.</div>
          )}
          {results.map((product) => (
            <button type="button" className="sales-product-option" key={product.id} onClick={() => selectProduct(product)}>
              <strong>{[product.brand, product.modelSku, product.specsCapacity].filter(Boolean).join(" ") || product.productCode}</strong>
              <span>Code: {product.productCode || "—"} | Dealer: {money(product.dealerPrice)} | MRP: {money(product.mrp)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
