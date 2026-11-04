with open("E:/n8n/src/pages/Sales.jsx", "r", encoding="utf-8") as f:
    content = f.read()

emptyline_pos = content.find("const emptyLine")

new_header = (
    'import { useEffect, useMemo, useState } from "react";\n'
    'import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";\n'
    'import { useLocation } from "react-router-dom";\n'
    'import Sidebar from "../components/Sidebar";\n'
    'import Topbar from "../components/Topbar";\n'
    'import { api } from "../lib/api";\n'
    'import { money, today, formatDate, statusClass } from "../lib/formatters";\n'
    'import { useDebounce } from "../hooks/useDebounce";\n'
    'import { useAutoPrint } from "../hooks/useAutoPrint";\n'
    'import ProductPicker from "../components/ProductPicker";\n'
    'import InvoiceDocument from "../components/InvoiceDocument";\n'
    'import "./Sales.css";\n\n'
)

content = new_header + content[emptyline_pos:]

# Remove local ProductPicker function
pp_start = content.find("\n\nfunction ProductPicker({")
odm_start = content.find("\nfunction OrderDetailsModal(")
if pp_start != -1 and odm_start != -1:
    content = content[:pp_start] + "\n" + content[odm_start:]
    print("Removed local ProductPicker function")

NEW_ORDER_MODAL = """
function OrderDetailsModal({ order, onClose, onEdit, autoPrint = false }) {
  useAutoPrint(autoPrint && !!order);

  if (!order) return null;

  const customer = order.customer || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = Number(order.subtotal || 0);
  const discount = Number(order.discountTotal || 0);
  const taxable = Number(order.taxableValue || 0);
  const tax = Number(order.taxTotal || 0);
  const total = Number(order.grandTotal || 0);

  return (
    <div
      className="sales-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="sales-modal sales-order-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-details-title"
      >
        <div className="sales-print-document">
          <InvoiceDocument
            docType="SALES ORDER"
            docNumber={order.orderNumber || `#${order.id}`}
            docDate={order.orderDate || order.createdAt}
            dateLabel="Date"
            status={order.status || "Pending"}
            party={customer}
            items={items}
            subtotal={subtotal}
            discount={discount}
            taxable={taxable}
            tax={tax}
            total={total}
            notes={order.notes}
            footerText="Computer-generated sales order. No physical signature required."
          />
        </div>

        <header style={{ padding: "8px 12px", minHeight: "auto", borderBottom: "none", justifyContent: "flex-end" }}>
          {order.status === "Draft" && onEdit && (
            <button type="button" className="si-action-btn si-action-btn--edit" onClick={() => { onClose(); onEdit(order); }}>
              <svg viewBox="0 0 14 14" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5l2 2-6 6H3.5v-2l6-6z"/><path d="M8 4l2 2"/></svg>
              Edit
            </button>
          )}
          <button type="button" className="sales-secondary" onClick={() => window.print()}>Print</button>
          <button type="button" className="sales-close" onClick={onClose} aria-label="Close order details">x</button>
        </header>
      </section>
    </div>
  );
}

"""

NEW_INVOICE_MODAL = """function InvoiceDetailsModal({ invoice, onClose, onEdit, autoPrint = false }) {
  useAutoPrint(autoPrint && !!invoice);

  if (!invoice) return null;

  const customer = invoice.customer || {};
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const subtotal = Number(invoice.subtotal || 0);
  const discount = Number(invoice.discountTotal || 0);
  const taxable = Number(invoice.taxableValue || 0);
  const tax = Number(invoice.taxTotal || 0);
  const total = Number(invoice.grandTotal || 0);
  const paid = Number(invoice.amountPaid || 0);
  const balance = Math.max(0, total - paid);

  return (
    <div
      className="sales-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <section
        className="sales-modal sales-order-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-details-title"
      >
        <div className="sales-print-document">
          <InvoiceDocument
            docType="TAX INVOICE"
            docNumber={invoice.invoiceNumber || `#${invoice.id}`}
            docDate={invoice.invoiceDate}
            dateLabel="Invoice Date"
            extraDate={invoice.dueDate}
            extraLabel="Due Date"
            status={invoice.status}
            party={customer}
            items={items}
            subtotal={subtotal}
            discount={discount}
            taxable={taxable}
            tax={tax}
            total={total}
            paid={paid}
            balance={balance}
            notes={invoice.notes}
          />
        </div>

        <header style={{ padding: "8px 12px", minHeight: "auto", borderBottom: "none", justifyContent: "flex-end" }}>
          {!["Paid", "Void", "Cancelled"].includes(invoice.status) && onEdit && (
            <button type="button" className="si-action-btn si-action-btn--edit" onClick={() => { onClose(); onEdit(invoice); }}>
              <svg viewBox="0 0 14 14" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5l2 2-6 6H3.5v-2l6-6z"/><path d="M8 4l2 2"/></svg>
              Edit
            </button>
          )}
          <button type="button" className="sales-secondary" onClick={() => window.print()}>Print</button>
          <button type="button" className="sales-close" onClick={onClose} aria-label="Close">x</button>
        </header>
      </section>
    </div>
  );
}

"""

odm_start = content.find("\nfunction OrderDetailsModal(")
idm_start = content.find("\nfunction InvoiceDetailsModal(")
export_start = content.find("\nexport default function Sales(")

if odm_start != -1 and idm_start != -1 and export_start != -1:
    content = content[:odm_start] + NEW_ORDER_MODAL + NEW_INVOICE_MODAL + content[export_start:]
    print("Replaced OrderDetailsModal and InvoiceDetailsModal")
else:
    print("WARNING: boundaries not found", odm_start, idm_start, export_start)

# Replace debounce in main Sales component
old_deb = (
    '  const [debouncedSearch, setDebouncedSearch] = useState("");\n'
    '  useEffect(() => {\n'
    '    const t = setTimeout(() => setDebouncedSearch(search), 200);\n'
    '    return () => clearTimeout(t);\n'
    '  }, [search]);'
)
new_deb = '  const debouncedSearch = useDebounce(search, 200);'
if old_deb in content:
    content = content.replace(old_deb, new_deb, 1)
    print("Replaced debounce pattern")
else:
    print("WARNING: debounce pattern not found, trying alternate...")
    # Try the pattern from the file reading which showed it starts at a specific location
    import re
    pattern = r'  const \[debouncedSearch, setDebouncedSearch\] = useState\(""\);\n  useEffect\(\(\) => \{\n    const t = setTimeout\(\(\) => setDebouncedSearch\(search\), 200\);\n    return \(\) => clearTimeout\(t\);\n  \}, \[search\]\);'
    replacement = '  const debouncedSearch = useDebounce(search, 200);'
    new_content = re.sub(pattern, replacement, content, count=1)
    if new_content != content:
        content = new_content
        print("Replaced debounce pattern (regex)")
    else:
        print("FAIL: debounce not replaced")

with open("E:/n8n/src/pages/Sales.jsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done. File size:", len(content))
