import { money, fmtDate } from "../lib/formatters";

export default function InvoiceDocument({
  docType,
  docNumber,
  docDate,
  dateLabel = "Date",
  extraDate,
  extraLabel,
  status,
  party = {},
  partyLabel = "BILL TO",
  items = [],
  subtotal = 0,
  discount = 0,
  taxable = 0,
  tax = 0,
  total = 0,
  paid,
  balance,
  notes,
  footerText = "This is a computer-generated document. Subject to jurisdiction of local courts.",
  sigLabel = "Customer Signature",
}) {
  const partyName = party.businessName || party.name || "—";
  const partyContact = party.contactPerson || party.contactName;
  const partyPhone = party.phone;
  const partyEmail = party.email;
  const partyAddress = party.billingAddress ||
    [party.address, party.city, party.state, party.pincode].filter(Boolean).join(", ");
  const partyState = party.billingAddress ? (party.state || "") : "";
  const partyGstin = party.gstin;

  return (
    <>
      <div className="inv-header">
        <div className="inv-company">
          <div className="inv-company-name">BHARAT BATTERIES</div>
          <div className="inv-company-sub">Your Trusted Partner in Power Solutions</div>
        </div>
        <div className="inv-meta">
          <div className="inv-doc-type">{docType}</div>
          <div className="inv-meta-row"><span>Doc No.</span><strong>{docNumber}</strong></div>
          <div className="inv-meta-row"><span>{dateLabel}</span><strong>{fmtDate(docDate)}</strong></div>
          {extraDate && <div className="inv-meta-row"><span>{extraLabel}</span><strong>{fmtDate(extraDate)}</strong></div>}
          <div className="inv-meta-row"><span>Status</span><strong>{status || "Draft"}</strong></div>
        </div>
      </div>

      <div className="inv-rule" />

      <div className="inv-bill-section">
        <div className="inv-section-label">{partyLabel}</div>
        <div className="inv-cust-name">{partyName}</div>
        {partyContact && <div>{partyContact}</div>}
        {partyPhone && <div>{partyPhone}{partyEmail ? ` · ${partyEmail}` : ""}</div>}
        {partyAddress && <div>{partyAddress}{partyState ? `, ${partyState}` : ""}</div>}
        {partyGstin && <div>GSTIN: {partyGstin}</div>}
      </div>

      <table className="inv-items">
        <thead>
          <tr>
            <th>#</th><th>Product</th><th>Code</th><th>Qty</th>
            <th>Unit Price</th><th>Discount</th><th>GST</th><th>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const q = Number(item.quantity || 0);
            const p = Number(item.unitPrice ?? item.dealerPrice ?? 0);
            const d = Number(item.discountPercent || 0);
            const t = Number(item.taxPercent ?? 18);
            const gross = q * p;
            const da = gross * d / 100;
            const taxableLine = gross - da;
            const ga = taxableLine * t / 100;
            return (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{item.productName || item.name || "—"}</td>
                <td>{item.productCode || "—"}</td>
                <td>{q}</td>
                <td>{money(p)}</td>
                <td>{d > 0 ? `${d}% (${money(da)})` : "—"}</td>
                <td>{t}% ({money(ga)})</td>
                <td><strong>{money(item.lineTotal ?? taxableLine + ga)}</strong></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="inv-totals">
        <div className="inv-total-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
        <div className="inv-total-row"><span>Discount</span><span>− {money(discount)}</span></div>
        <div className="inv-total-row"><span>Taxable Value</span><span>{money(taxable)}</span></div>
        <div className="inv-total-row"><span>GST</span><span>{money(tax)}</span></div>
        <div className="inv-total-row inv-grand"><span>Grand Total</span><span>{money(total)}</span></div>
        {paid > 0 && <div className="inv-total-row"><span>Amount Paid</span><span>− {money(paid)}</span></div>}
        {paid > 0 && <div className="inv-total-row inv-grand"><span>Balance Due</span><span>{money(balance ?? 0)}</span></div>}
      </div>

      {notes && <div className="inv-notes"><strong>Notes:</strong> {notes}</div>}

      <div className="inv-signatures">
        <div className="inv-sig-box"><div className="inv-sig-line" /><div>{sigLabel}</div></div>
        <div className="inv-sig-box"><div className="inv-sig-line" /><div>For BHARAT BATTERIES<br />Authorised Signatory</div></div>
      </div>

      <div className="inv-footer-text">{footerText}</div>
    </>
  );
}
