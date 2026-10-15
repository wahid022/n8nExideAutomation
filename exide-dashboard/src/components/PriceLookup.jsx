
import { useState } from "react";
import { getProductPrices } from "../services/priceService";

const formatINR = (value) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return String(value);
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
};

export default function PriceLookup() {
  const [productId, setProductId] = useState("PRD000001");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await getProductPrices(productId);
      setResult(response);
    } catch (err) {
      setError(err.message || "Unable to load pricing records.");
    } finally {
      setLoading(false);
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
      padding: "10px 16px",
      border: 0,
      borderRadius: 8,
      background: "#2563eb",
      color: "#ffffff",
      cursor: loading ? "wait" : "pointer",
      fontWeight: 600,
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      marginTop: 16,
      fontSize: 13,
      minWidth: 900,
    },
    cell: {
      textAlign: "left",
      padding: "12px 10px",
      borderBottom: "1px solid #e5e7eb",
      verticalAlign: "top",
    },
  };

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
          style={styles.button}
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

      {result && (
        <div style={{ marginTop: 18 }}>
          <p>
            <strong>Product ID:</strong>{" "}
            {result.filters?.productId || productId}
            {" · "}
            <strong>Records:</strong> {result.count}
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
            Source pricing is unverified. Confirm price basis, effective
            dates, and approval before using these values for quotations.
          </p>

          {result.data.length === 0 ? (
            <p>No pricing records found for this product ID.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  {[
                    "Price Type",
                    "Source Label",
                    "Source Value",
                    "Basic Price",
                    "GST Rate",
                    "GST Amount",
                    "Effective From",
                    "Verification",
                    "Current",
                  ].map((heading) => (
                    <th key={heading} style={styles.cell}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {result.data.map((price) => (
                  <tr key={price.product_price_id}>
                    <td style={styles.cell}>
                      {price.price_type || "—"}
                    </td>
                    <td style={styles.cell}>
                      {price.source_price_label || "—"}
                    </td>
                    <td style={styles.cell}>
                      {formatINR(price.source_price_value)}
                    </td>
                    <td style={styles.cell}>
                      {formatINR(price.basic_price)}
                    </td>
                    <td style={styles.cell}>
                      {price.gst_rate_percent == null
                        ? "—"
                        : `${price.gst_rate_percent}%`}
                    </td>
                    <td style={styles.cell}>
                      {formatINR(price.gst_amount)}
                    </td>
                    <td style={styles.cell}>
                      {price.effective_from || "—"}
                    </td>
                    <td style={styles.cell}>
                      {price.verification_status || "Not specified"}
                    </td>
                    <td style={styles.cell}>
                      {price.is_current ? "Yes" : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {result.data.length > 0 && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer" }}>
                View source references and notes
              </summary>

              <div style={{ marginTop: 12 }}>
                {result.data.map((price) => (
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
                      <strong>Source:</strong>{" "}
                      {price.source_row_reference || "Not provided"}
                    </p>
                    <p>
                      <strong>Notes:</strong>{" "}
                      {price.notes || "No notes"}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
