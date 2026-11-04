import { useAutoPrint } from "../hooks/useAutoPrint";

export default function PrintModal({ onClose, autoPrint = false, children }) {
  useAutoPrint(autoPrint);

  return (
    <div
      className="sales-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <section className="sales-modal sales-order-details-modal" role="dialog" aria-modal="true">
        <header style={{ padding: "8px 12px", minHeight: "auto", borderBottom: "none", justifyContent: "flex-end" }}>
          <button className="sales-secondary" onClick={() => window.print()}>Print</button>
          <button type="button" className="sales-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="sales-print-document">
          {children}
        </div>
      </section>
    </div>
  );
}
