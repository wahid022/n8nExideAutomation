
import { useEffect, useState } from "react";

const UPDATE_URL =
  import.meta.env.VITE_PRODUCT_MASTER_UPDATE_URL ||
  "http://localhost:8001/update-product-price";

const PRICE_FIELDS = ["MRP", "Dealer Price"];

function getCode(product) {
  return String(
    product?.["Product Code"] ?? product?.product_id ?? ""
  ).trim();
}

function getPrice(product, field) {
  const value =
    field === "MRP"
      ? product?.["MRP"] ?? product?.mrp
      : product?.["Dealer Price"] ?? product?.dealer_price;

  return value === null || value === undefined ? "" : String(value);
}

export default function PriceLookup({
  product,
  onPriceUpdated,
  onCancel,
}) {
  const productCode = getCode(product);

  const [editingField, setEditingField] = useState("Dealer Price");
  const [newValue, setNewValue] = useState(
    getPrice(product, "Dealer Price")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setEditingField("Dealer Price");
    setNewValue(getPrice(product, "Dealer Price"));
    setSaving(false);
    setError("");
    setNotice("");
  }, [productCode]);

  function changeField(field) {
    setEditingField(field);
    setNewValue(getPrice(product, field));
    setError("");
    setNotice("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!product || !productCode) {
      setError("The selected product code is missing.");
      return;
    }

    const trimmed = newValue.trim();
    let value = null;

    if (trimmed !== "") {
      value = Number(trimmed);

      if (!Number.isFinite(value) || value < 0) {
        setError(
          "Enter a valid price greater than or equal to zero, or leave it blank to clear it."
        );
        return;
      }
    }

    const currentValue = getPrice(product, editingField).trim();
    const currentNormalized =
      currentValue === "" ? null : Number(currentValue);

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
          product_code: productCode,
          field: editingField,
          value,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success === false) {
        throw new Error(
          result.detail ||
            result.message ||
            `Price update failed with HTTP ${response.status}.`
        );
      }

      const updatedValue =
        result.updated_value !== undefined
          ? result.updated_value
          : value;

      await onPriceUpdated?.({
        product_code: productCode,
        field: editingField,
        value: updatedValue,
      });

      setNewValue(
        updatedValue === null || updatedValue === undefined
          ? ""
          : String(updatedValue)
      );

      setNotice(`${editingField} saved for ${productCode}.`);
    } catch (err) {
      setError(err.message || "Unable to update the Product Master.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 11px",
    border: "1px solid #cbd5e1",
    borderRadius: 7,
    background: "#ffffff",
    color: "#172033",
    fontSize: 13,
  };

  const buttonStyle = {
    padding: "9px 14px",
    border: "none",
    borderRadius: 7,
    background: "#2457e6",
    color: "#ffffff",
    fontWeight: 600,
    cursor: saving ? "wait" : "pointer",
    opacity: saving ? 0.7 : 1,
  };

  return (
    <div
      style={{
        padding: 16,
        border: "1px solid #dbe5f3",
        borderRadius: 10,
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 5px", fontSize: 15 }}>
            Edit Price — {productCode}
          </h3>
          <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>
            {product?.["Model / SKU"] ??
              product?.product_name ??
              "Selected product"}
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(160px, 1fr) minmax(180px, 2fr)",
            gap: 12,
          }}
        >
          <label style={{ fontSize: 12, fontWeight: 600 }}>
            Price field
            <select
              style={{ ...inputStyle, marginTop: 6 }}
              value={editingField}
              onChange={(event) => changeField(event.target.value)}
              disabled={saving}
            >
              {PRICE_FIELDS.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 12, fontWeight: 600 }}>
            New {editingField}
            <input
              style={{ ...inputStyle, marginTop: 6 }}
              type="number"
              min="0"
              step="0.01"
              value={newValue}
              onChange={(event) => setNewValue(event.target.value)}
              placeholder="Enter price"
              disabled={saving}
            />
          </label>
        </div>

        <p style={{ fontSize: 12, color: "#64748b", margin: "8px 0 12px" }}>
          Leave the price blank only if you intend to clear it. No GST or
          discount is calculated automatically.
        </p>

        {error && (
          <p
            role="alert"
            style={{
              color: "#b91c1c",
              background: "#fef2f2",
              padding: 9,
              borderRadius: 7,
              fontSize: 12,
              overflowWrap: "anywhere",
            }}
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            style={{
              color: "#166534",
              background: "#f0fdf4",
              padding: 9,
              borderRadius: 7,
              fontSize: 12,
            }}
          >
            {notice}
          </p>
        )}

        <button type="submit" disabled={saving} style={buttonStyle}>
          {saving ? "Saving..." : `Save ${editingField}`}
        </button>
      </form>
    </div>
  );
}
