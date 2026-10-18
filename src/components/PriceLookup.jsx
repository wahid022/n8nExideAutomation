
import { useState } from "react";
import {
  getProductPrices,
  getPriceStatus,
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
    return "Not available";
  }

  // Handle Excel serial dates.
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

  // Handle ISO dates and date-times.
  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // Handle DD/MM/YYYY and DD-MM-YYYY.
  const dmyMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return text;
};

const displayValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  return String(value);
};

const isAppendedHistoryEntry = (price) =>
  String(price.notes || "")
    .toLowerCase()
    .includes("price history entry appended from");

function StatusBadge({ status }) {
  const stylesByStatus = {
    review: {
      background: "#fff7ed",
      color: "#9a3412",
      label: "Needs verification",
    },
    "verified-current": {
      background: "#dcfce7",
      color: "#166534",
      label: "Verified current",
    },
    unverified: {
      background: "#f1f5f9",
      color: "#475569",
      label: "Unverified",
    },
  };

  const style = stylesByStatus[status] || stylesByStatus.unverified;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 8px",
        borderRadius: 6,
        background: style.background,
        color: style.color,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.5,
        whiteSpace: "normal",
      }}
    >
      {style.label}
    </span>
  );
}

function EditPriceForm({ price, onCancel, onSaved }) {
  const [newPrice, setNewPrice] = useState(
    String(price.source_price_value ?? "")
  );

  const formattedDate = formatDate(price.effective_from);

  const [effectiveFrom, setEffectiveFrom] = useState(
    formattedDate === "Not available" ? "" : formattedDate
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
      await updateProductPrice({
        product_price_id: price.product_price_id,
        source_price_value: amount,
        effective_from: effectiveFrom,
      });

      await onSaved();
    } catch (err) {
      setError(
        err.message ||
          "Unable to confirm the update. Check price history before retrying."
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
      <strong>Add Price Revision</strong>

      <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
        This creates a new price-history record. The original record remains
        unchanged, and the new entry requires verification.
      </p>

      <label style={{ fontSize: 13, fontWeight: 600 }}>
        Existing Price ID
        <input
          style={fieldStyle}
          value={price.product_price_id || ""}
          readOnly
        />
      </label>

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
        New Source Price (INR)
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
          {saving ? "Saving..." : "Save Price Revision"}
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

async function handlePriceSaved() {
  try {
    await loadPrices(productId);
    setEditingPrice(null);

    setNotice(
      "Price revision saved. The new record requires verification."
    );

    // Refresh the main dashboard after the history refresh succeeds.
    onPriceUpdated?.();
  } catch {
    // The write may have succeeded even if refreshing failed.
    // Do not automatically submit the write a second time.
    setEditingPrice(null);

    setNotice(
      "The update may have succeeded, but the table could not refresh. Search this product again and check its history before retrying."
    );

    // Refresh the dashboard too, because the write may have succeeded.
    onPriceUpdated?.();
  }
}

  const styles = {
    card: {
      background: "var(--card-bg, #ffffff)",
      color: "var(--text-color, #172033)",
      border: "1px solid var(--border-color, #e5e7eb)",
      borderRadius: 12,
      padding: 20,
      marginTop: 20,
      overflowX: "auto",
    },
    input: {
      padding: "10px 12px",
      border: "1px solid #cbd5e1",
      borderRadius: 8,
      minWidth: 220,
      fontSize: 14,
    },
    button: {
      padding: "8px 11px",
      border: 0,
      borderRadius: 7,
      background: "#2563eb",
      color: "#ffffff",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 12,
      whiteSpace: "nowrap",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      marginTop: 16,
      fontSize: 13,
      minWidth: 1550,
    },
    cell: {
      textAlign: "left",
      padding: "12px 10px",
      borderBottom: "1px solid #e5e7eb",
      verticalAlign: "top",
    },
  };

  const prices = result?.data ?? [];

  const reviewCount = prices.filter(
    (price) => getPriceStatus(price) !== "verified-current"
  ).length;

  return (
    <section style={styles.card}>
      <h2 style={{ marginTop: 0 }}>Product Pricing Lookup</h2>

      <p style={{ color: "#64748b", marginTop: 4 }}>
        Search source price records by product ID.
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
          style={styles.input}
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          placeholder="e.g. PRD000001"
          required
        />

        <button
          type="submit"
          style={{
            ...styles.button,
            padding: "10px 16px",
            fontSize: 14,
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
          disabled={loading}
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
            <strong>Records:</strong> {result.count ?? prices.length}
            {" · "}
            <strong>Needs verification:</strong> {reviewCount}
          </p>

          <p
            style={{
              padding: 12,
              borderRadius: 8,
              background: "#fff7ed",
              color: "#9a3412",
              fontSize: 13,
            }}
          >
            These are source price records, not automatically approved selling
            prices. Only records explicitly verified as current should be used
            as approved pricing for quotations.
          </p>

          {prices.length === 0 ? (
            <p>No pricing records found for this product ID.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  {[
                    "Price ID",
                    "Record Type",
                    "Price Type",
                    "Source Label",
                    "Source Value",
                    "Basic Price",
                    "GST Rate",
                    "GST Amount",
                    "Price Excl. GST",
                    "Price Incl. GST",
                    "Effective From",
                    "Verification",
                    "Review Status",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        ...styles.cell,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {prices.map((price) => {
                  const status = getPriceStatus(price);
                  const appended = isAppendedHistoryEntry(price);

                  const isEditing =
                    editingPrice?.product_price_id ===
                    price.product_price_id;

                  return (
                    <tr key={price.product_price_id}>
                      <td style={styles.cell}>
                        {displayValue(price.product_price_id)}
                      </td>

                      <td style={styles.cell}>
                        {appended ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 7px",
                              borderRadius: 6,
                              background: "#eff6ff",
                              color: "#1d4ed8",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            Appended history
                          </span>
                        ) : (
                          "Source record"
                        )}
                      </td>

                      <td style={styles.cell}>
                        {displayValue(price.price_type)}
                      </td>

                      <td style={styles.cell}>
                        {displayValue(price.source_price_label)}
                      </td>

                      <td style={styles.cell}>
                        {formatINR(price.source_price_value)}
                      </td>

                      <td style={styles.cell}>
                        {formatINR(price.basic_price)}
                      </td>

                      <td style={styles.cell}>
                        {price.gst_rate_percent === null ||
                        price.gst_rate_percent === undefined ||
                        price.gst_rate_percent === ""
                          ? "Not available"
                          : `${price.gst_rate_percent}%`}
                      </td>

                      <td style={styles.cell}>
                        {formatINR(price.gst_amount)}
                      </td>

                      <td style={styles.cell}>
                        {formatINR(price.price_excluding_gst)}
                      </td>

                      <td style={styles.cell}>
                        {formatINR(price.price_including_gst)}
                      </td>

                      <td style={styles.cell}>
                        {formatDate(price.effective_from)}
                      </td>

                      <td style={styles.cell}>
                        {displayValue(price.verification_status)}
                      </td>

                      <td style={styles.cell}>
                        <StatusBadge status={status} />
                        <div
                          style={{
                            marginTop: 5,
                            fontSize: 11,
                            color: "#64748b",
                          }}
                        >
                          Source status: {displayValue(price.is_current)}
                        </div>
                      </td>

                      <td style={{ ...styles.cell, minWidth: 240 }}>
                        <button
                          type="button"
                          title="Create a new price-history record. The existing record remains unchanged."
                          style={{
                            ...styles.button,
                            background: isEditing ? "#475569" : "#2563eb",
                          }}
                          onClick={() => {
                            setNotice("");
                            setError("");
                            setEditingPrice(isEditing ? null : price);
                          }}
                          disabled={Boolean(editingPrice) && !isEditing}
                        >
                          {isEditing
                            ? "Close Editor"
                            : "Add Price Revision"}
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

          {prices.length > 0 && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer" }}>
                View source references and notes
              </summary>

              <div style={{ marginTop: 12 }}>
                {prices.map((price) => {
                  const appended = isAppendedHistoryEntry(price);

                  return (
                    <div
                      key={price.product_price_id}
                      style={{
                        padding: "12px 0",
                        borderBottom: "1px solid #e5e7eb",
                        overflowWrap: "anywhere",
                      }}
                    >
                      <strong>{price.product_price_id}</strong>

                      <p>
                        <strong>Record type:</strong>{" "}
                        {appended
                          ? "Appended price-history entry"
                          : "Original source record"}
                      </p>

                      <p>
                        <strong>Original source reference:</strong>{" "}
                        {displayValue(price.source_row_reference)}
                      </p>

                      {appended && (
                        <p style={{ color: "#64748b", fontSize: 12 }}>
                          This entry inherits the source reference from the
                          record it was copied from. It does not confirm that
                          the new price came from a new official price list.
                        </p>
                      )}

                      <p>
                        <strong>Effective to:</strong>{" "}
                        {formatDate(price.effective_to)}
                      </p>

                      <p>
                        <strong>Notes:</strong>{" "}
                        {displayValue(price.notes)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
