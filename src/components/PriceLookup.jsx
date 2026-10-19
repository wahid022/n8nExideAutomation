
import { useEffect, useMemo, useState } from "react";
import { getProducts } from "../services/productService";

const UPDATE_URL =
  import.meta.env.VITE_PRODUCT_MASTER_UPDATE_URL ||
  "http://localhost:8001/update-product-price";

const PRICE_FIELDS = ["Dealer Price", "MRP"];

const formatINR = (value) => {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
};

function getCode(product) {
  return String(product["Product Code"] ?? product.product_id ?? "").trim();
}

function getPrice(product, field) {
  const value =
    field === "MRP"
      ? product["MRP"] ?? product.mrp
      : product["Dealer Price"] ?? product.dealer_price;

  return value === null || value === undefined ? "" : String(value);
}

export default function PriceLookup({ onPriceUpdated }) {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [editingField, setEditingField] = useState("Dealer Price");
  const [newValue, setNewValue] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadProducts() {
    setLoadingProducts(true);
    setLoadError("");

    try {
      const data = await getProducts();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(err.message || "Unable to load the product master.");
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const matchingProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return products;

    return products.filter((product) => {
      const values = [
        getCode(product),
        product["Model / SKU"],
        product.product_name,
        product["Brand"],
        product["Category"],
      ];

      return values.some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      );
    });
  }, [products, search]);

  const selectedProduct = products.find(
    (product) => getCode(product) === selectedCode
  );

  function selectProduct(product) {
    const code = getCode(product);

    setSelectedCode(code);
    setSearch(`${code} — ${product["Model / SKU"] ?? product.product_name ?? ""}`);
    setEditingField("Dealer Price");
    setNewValue(getPrice(product, "Dealer Price"));
    setError("");
    setNotice("");
  }

  function changeField(field) {
    setEditingField(field);
    setNewValue(selectedProduct ? getPrice(selectedProduct, field) : "");
    setError("");
    setNotice("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!selectedProduct || !selectedCode) {
      setError("Select a product before editing its price.");
      return;
    }

    const trimmed = newValue.trim();
    let value = null;

    if (trimmed !== "") {
      value = Number(trimmed);

      if (!Number.isFinite(value) || value < 0) {
        setError("Enter a valid price greater than or equal to zero, or leave it blank.");
        return;
      }
    }

    const currentValue = getPrice(selectedProduct, editingField);
    const currentNormalized =
      currentValue.trim() === "" ? null : Number(currentValue);

    if (currentNormalized === value) {
      setNotice("No changes to save.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(UPDATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_code: selectedCode,
          field: editingField,
          value,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.detail || result.message || `Update failed (${response.status}).`
        );
      }

      // Update the local product immediately after backend confirmation.
      const updatedProduct = {
        ...selectedProduct,
        [editingField]: result.updated_value ?? value,
      };

      setProducts((previous) =>
        previous.map((product) =>
          getCode(product) === selectedCode ? updatedProduct : product
        )
      );

      setNewValue(
        result.updated_value === null || result.updated_value === undefined
          ? ""
          : String(result.updated_value)
      );

      setNotice(
        `${editingField} saved for ${selectedCode}. Workbook backup created.`
      );

      if (onPriceUpdated) {
        await onPriceUpdated({
          product_code: selectedCode,
          field: editingField,
          value: result.updated_value ?? value,
          product: updatedProduct,
        });
      }
    } catch (err) {
      setError(err.message || "Unable to update the Product Master.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#ffffff",
    color: "#172033",
    fontSize: 14,
  };

  const buttonStyle = {
    padding: "10px 16px",
    border: "none",
    borderRadius: 8,
    background: "#2457e6",
    color: "#ffffff",
    fontWeight: 600,
    cursor: saving ? "wait" : "pointer",
    opacity: saving ? 0.7 : 1,
  };

  return (
    <section
      style={{
        marginTop: 20,
        padding: 20,
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#ffffff",
      }}
    >
      <h2 style={{ margin: 0 }}>Edit Product Prices</h2>

      <p style={{ color: "#64748b", marginTop: 6 }}>
        Update only MRP or Dealer Price in the Product Master workbook.
      </p>

      {loadingProducts ? (
        <p>Loading products...</p>
      ) : loadError ? (
        <div role="alert" style={{ color: "#b91c1c" }}>
          {loadError}
          <button
            type="button"
            onClick={loadProducts}
            style={{ ...buttonStyle, marginLeft: 10 }}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Search product by code, model, brand or category
          </label>

          <input
            style={inputStyle}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelectedCode("");
              setError("");
              setNotice("");
            }}
            placeholder="e.g. P00001 or FDM0-DMWATER-5L"
          />

          {search.trim() && !selectedProduct && (
            <div
              style={{
                marginTop: 6,
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {matchingProducts.slice(0, 10).map((product) => (
                <button
                  key={getCode(product)}
                  type="button"
                  onClick={() => selectProduct(product)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: 10,
                    border: "none",
                    borderBottom: "1px solid #f1f5f9",
                    background: "#ffffff",
                    cursor: "pointer",
                    color: "#172033",
                  }}
                >
                  <strong>{getCode(product)}</strong>
                  {" — "}
                  {product["Model / SKU"] ?? product.product_name ?? "Unnamed product"}
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {product["Brand"] ?? product.brand ?? "—"} ·{" "}
                    {product["Category"] ?? product.category ?? "—"}
                  </div>
                </button>
              ))}

              {matchingProducts.length === 0 && (
                <p style={{ padding: 10, margin: 0 }}>
                  No matching products found.
                </p>
              )}
            </div>
          )}

          {selectedProduct && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
              }}
            >
              <h3 style={{ margin: "0 0 6px" }}>
                {selectedProduct["Model / SKU"] ??
                  selectedProduct.product_name ??
                  selectedCode}
              </h3>

              <p style={{ margin: "0 0 12px", color: "#64748b" }}>
                Product Code: <strong>{selectedCode}</strong>
                {" · "}
                {selectedProduct["Brand"] ?? selectedProduct.brand ?? "—"}
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Current MRP</div>
                  <strong>{formatINR(getPrice(selectedProduct, "MRP"))}</strong>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Current Dealer Price
                  </div>
                  <strong>
                    {formatINR(getPrice(selectedProduct, "Dealer Price"))}
                  </strong>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Price field to edit
                </label>

                <select
                  style={{ ...inputStyle, marginBottom: 12 }}
                  value={editingField}
                  onChange={(event) => changeField(event.target.value)}
                >
                  {PRICE_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>

                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  New {editingField}
                </label>

                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  value={newValue}
                  onChange={(event) => setNewValue(event.target.value)}
                  placeholder="Enter price, or leave blank to clear it"
                />

                <p style={{ fontSize: 12, color: "#64748b" }}>
                  Leave blank only if you intend to clear this price. No GST,
                  discount or other price is calculated automatically.
                </p>

                {error && (
                  <p role="alert" style={{ color: "#b91c1c" }}>
                    {error}
                  </p>
                )}

                {notice && (
                  <p role="status" style={{ color: "#166534" }}>
                    {notice}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  style={buttonStyle}
                >
                  {saving ? "Saving..." : `Save ${editingField}`}
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </section>
  );
}
