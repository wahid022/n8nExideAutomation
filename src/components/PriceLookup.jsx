
import { useState } from "react";
import {
  getProductPrices,
  updateProductPrice,
} from "../services/priceService";

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

const formatDate = (value) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (
    typeof value === "number" ||
    (typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim()))
  ) {
    const serial = Number(value);

    if (serial > 0 && serial < 2958466) {
      return new Date(
        Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000
      )
        .toISOString()
        .slice(0, 10);
    }
  }

  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);

  if (isoMatch) return isoMatch[1];

  const dmyMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return "";
};

function EditPriceForm({ price, onCancel, onSaved }) {
  const [newPrice, setNewPrice] = useState(
    String(price.source_price_value ?? "")
  );

  const [effectiveFrom, setEffectiveFrom] = useState(
    formatDate(price.effective_from) ||
      new Date().toISOString().slice(0, 10)
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) return;

    const amount = Number(newPrice);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid price greater than zero.");
      return;
    }

    if (!effectiveFrom) {
      setError("Please select an effective date.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const updateResult = await updateProductPrice({
        product_price_id: price.product_price_id,
        source_price_value: amount,
        effective_from: effectiveFrom,
      });

      await onSaved(updateResult);
    } catch (err) {
      setError(
        err.message ||
          "Unable to save the price. Check the current price before retrying."
      );
    } finally {
      setSaving(false);
    }
  }

  const fieldStyle = {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    marginTop: 5,
    padding: "9px 10px",
    border: "1px solid #cbd5e1",
    borderRadius: 7,
    fontSize: 13,
    background: "#ffffff",
    color: "#172033",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gap: 12,
        padding: 16,
        marginTop: 12,
        border: "1px solid #cbd5e1",
        borderRadius: 10,
        background: "var(--card-bg, #ffffff)",
        minWidth: 220,
      }}
    >
      <strong>Edit Product Price</strong>

      <label style={{ fontSize: 13, fontWeight: 600 }}>
        Product ID
        <input
          style={fieldStyle}
          value={price.product_id || ""}
          readOnly
        />
      </label>

      <label style={{ fontSize: 13, fontWeight: 600 }}>
        Price Type
        <input
          style={fieldStyle}
          value={price.price_type || "Not available"}
          readOnly
        />
      </label>

      <label style={{ fontSize: 13, fontWeight: 600 }}>
        Price (INR)
        <input
          style={fieldStyle}
          type="number"
          min="0.01"
          step="0.01"
          required
          value={newPrice}
          onChange={(event) => setNewPrice(event.target.value)}
          disabled={saving}
        />
      </label>

      <label style={{ fontSize: 13, fontWeight: 600 }}>
        Effective From
        <input
          style={fieldStyle}
          type="date"
          required
          value={effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
          disabled={saving}
        />
      </label>

      {error && (
        <p
          role="alert"
          style={{
            color: "#b91c1c",
            background: "#fef2f2",
            padding: 10,
            borderRadius: 7,
            margin: 0,
            fontSize: 13,
            overflowWrap: "anywhere",
          }}
        >
          {error}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "9px 14px",
            border: 0,
            borderRadius: 7,
            background: saving ? "#94a3b8" : "#2563eb",
            color: "#ffffff",
            fontWeight: 600,
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Price"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: "9px 14px",
            border: "1px solid #cbd5e1",
            borderRadius: 7,
            background: "#ffffff",
            color: "#172033",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function PriceLookup({ onPriceUpdated }) {
  const [productId, setProductId] = useState("PRD000001");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingPrice, setEditingPrice] = useState(null);

  async function loadPrices(id = productId) {
    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("Please enter a product ID.");
    }

    const response = await getProductPrices(normalizedId);
    setResult(response);
    return response;
  }

  async function handleSearch(event) {
    event.preventDefault();

    if (loading || !productId.trim()) return;

    setLoading(true);
    setError("");
    setNotice("");
    setEditingPrice(null);

    try {
      await loadPrices(productId);
    } catch (err) {
      setError(err.message || "Unable to load pricing records.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePriceSaved(updateResult) {
    setEditingPrice(null);

    try {
      await loadPrices(productId);
      setNotice("Price updated successfully.");
    } catch (err) {
      setNotice(
        err.message ||
          "Price saved, but pricing details could not be refreshed."
      );
    } finally {
      // Notify Dashboard so the catalogue reloads immediately.
      onPriceUpdated?.(updateResult?.updated_record);
    }
  }

  const cellStyle = {
    textAlign: "left",
    padding: "12px 10px",
    borderBottom: "1px solid #e5e7eb",
    verticalAlign: "top",
  };

  const buttonStyle = {
    padding: "8px 12px",
    border: 0,
    borderRadius: 7,
    background: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 12,
    whiteSpace: "nowrap",
  };

  const prices = result?.data ?? [];

  return (
    <section
      style={{
        background: "var(--card-bg, #ffffff)",
        color: "var(--text-color, #172033)",
        border: "1px solid var(--border-color, #e5e7eb)",
        borderRadius: 12,
        padding: 20,
        marginTop: 20,
        overflowX: "auto",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Product Pricing</h2>

      <p style={{ color: "#64748b", marginTop: 4 }}>
        Search and edit existing product prices.
      </p>

      <form
        onSubmit={handleSearch}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
        }}
      >
        <input
          aria-label="Product ID"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          placeholder="e.g. PRD000001"
          required
          style={{
            padding: "10px 12px",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            minWidth: 220,
            fontSize: 14,
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={buttonStyle}
        >
          {loading ? "Searching..." : "Find Prices"}
        </button>
      </form>

      {error && (
        <p role="alert" style={{ color: "#b91c1c", marginTop: 16 }}>
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background: "#eff6ff",
            color: "#1d4ed8",
            fontSize: 13,
          }}
        >
          {notice}
        </p>
      )}

      {result && (
        <div style={{ marginTop: 18 }}>
          <p>
            <strong>Product ID:</strong>{" "}
            {result.filters?.productId || productId}
            {" · "}
            <strong>Price records:</strong> {prices.length}
          </p>

          {prices.length === 0 ? (
            <p>No pricing records found for this product ID.</p>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: 16,
                fontSize: 13,
                minWidth: 900,
              }}
            >
              <thead>
                <tr>
                  {[
                    "Price Type",
                    "Source Label",
                    "Price",
                    "Basic Price",
                    "GST Rate",
                    "GST Amount",
                    "Price Excl. GST",
                    "Price Incl. GST",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{ ...cellStyle, whiteSpace: "nowrap" }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {prices.map((price) => {
                  const isEditing =
                    editingPrice?.product_price_id ===
                    price.product_price_id;

                  return (
                    <tr key={price.product_price_id}>
                      <td style={cellStyle}>
                        {price.price_type || "—"}
                      </td>

                      <td style={cellStyle}>
                        {price.source_price_label || "—"}
                      </td>

                      <td style={cellStyle}>
                        {formatINR(price.source_price_value)}
                      </td>

                      <td style={cellStyle}>
                        {formatINR(price.basic_price)}
                      </td>

                      <td style={cellStyle}>
                        {price.gst_rate_percent == null
                          ? "—"
                          : `${price.gst_rate_percent}%`}
                      </td>

                      <td style={cellStyle}>
                        {formatINR(price.gst_amount)}
                      </td>

                      <td style={cellStyle}>
                        {formatINR(price.price_excluding_gst)}
                      </td>

                      <td style={cellStyle}>
                        {formatINR(price.price_including_gst)}
                      </td>

                      <td style={cellStyle}>
                        <button
                          type="button"
                          style={{
                            ...buttonStyle,
                            background: isEditing ? "#475569" : "#2563eb",
                          }}
                          onClick={() => {
                            setNotice("");
                            setError("");
                            setEditingPrice(isEditing ? null : price);
                          }}
                          disabled={Boolean(editingPrice) && !isEditing}
                        >
                          {isEditing ? "Close Editor" : "Edit Price"}
                        </button>

                        {isEditing && (
                          <EditPriceForm
                            key={price.product_price_id}
                            price={price}
                            onCancel={() => setEditingPrice(null)}
                            onSaved={handlePriceSaved}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
