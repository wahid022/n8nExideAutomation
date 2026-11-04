with open("E:/n8n/src/pages/Purchase.jsx", "r", encoding="utf-8") as f:
    content = f.read()

blankitem_pos = content.find("const blankItem")

new_header = (
    'import { useState } from "react";\n'
    'import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";\n'
    'import Sidebar from "../components/Sidebar";\n'
    'import Topbar from "../components/Topbar";\n'
    'import { api } from "../lib/api";\n'
    'import { money, today, fmtDate, avatarColor } from "../lib/formatters";\n'
    'import { useDebounce } from "../hooks/useDebounce";\n'
    'import { useAutoPrint } from "../hooks/useAutoPrint";\n'
    'import ProductPicker from "../components/ProductPicker";\n'
    'import InvoiceDocument from "../components/InvoiceDocument";\n'
    'import "./Purchase.css";\n'
    'import "./Sales.css";\n\n'
)

# Replace import block (everything before blankItem)
content = new_header + content[blankitem_pos:]

# Remove local ProductPicker function (between blankItem and AVATAR_COLORS)
# After removing import block, positions shift. Find them again.
pp_start = content.find("\nfunction ProductPicker({")
avatar_pos = content.find("\nconst AVATAR_COLORS")
badgeclass_pos = content.find("\nfunction badgeClass(status)")
fmtdate_pos = content.find("\nconst fmtDate")
pdm_start = content.find("\nfunction PurchaseDocModal(")

# Remove ProductPicker + AVATAR_COLORS + badgeClass line + fmtDate line
# Keep only: blankItem, then PurchaseDocModal
if pp_start != -1 and pdm_start != -1:
    content = content[:pp_start] + "\n" + content[pdm_start:]
    print("Removed ProductPicker, AVATAR_COLORS, badgeClass, fmtDate blocks")
else:
    print("WARNING: boundaries not found", pp_start, pdm_start)

# badgeClass and fmtDate are still used in the main component (table rows)
# Check if badgeClass is still referenced in the remaining content
if "badgeClass(" in content:
    # Need to add badgeClass back as a small inline function
    # Find where PurchaseDocModal starts, insert badgeClass before it
    pdm_start2 = content.find("\nfunction PurchaseDocModal(")
    badgeclass_def = '\nfunction badgeClass(status) {\n  const s = String(status || "").toLowerCase().replace(/ /g, "-");\n  return `pur-badge pur-badge--${s}`;\n}\n'
    content = content[:pdm_start2] + badgeclass_def + content[pdm_start2:]
    print("Re-added badgeClass function (still referenced in JSX)")

# Replace PurchaseDocModal with simplified version using InvoiceDocument
NEW_PURCHASE_DOC_MODAL = """
function PurchaseDocModal({ doc, isInvoice, onClose, autoPrint = false }) {
  useAutoPrint(autoPrint && !!doc);

  if (!doc) return null;

  const vendor = doc.vendor || {};
  const items = Array.isArray(doc.items) ? doc.items : [];
  const subtotal = Number(doc.subtotal || 0);
  const discount = Number(doc.discountTotal || 0);
  const taxable = Number(doc.taxableValue || 0);
  const tax = Number(doc.taxTotal || 0);
  const total = Number(doc.grandTotal || 0);
  const docNum = doc.invoiceNumber || doc.orderNumber || `#${doc.id}`;
  const docDate = doc.invoiceDate || doc.orderDate;
  const docType = isInvoice ? "PURCHASE INVOICE" : "PURCHASE ORDER";
  const dateLabel = isInvoice ? "Invoice Date" : "Order Date";
  const extraLabel = isInvoice ? "Due Date" : "Expected Delivery";
  const extraDate = isInvoice ? doc.dueDate : doc.expectedDelivery;

  return (
    <div className="sales-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="sales-modal sales-order-details-modal" role="dialog" aria-modal="true" aria-labelledby="pur-doc-title">
        <div className="sales-print-document">
          <InvoiceDocument
            docType={docType}
            docNumber={docNum}
            docDate={docDate}
            dateLabel={dateLabel}
            extraDate={extraDate}
            extraLabel={extraLabel}
            status={doc.status}
            party={vendor}
            partyLabel="PURCHASE FROM"
            items={items}
            subtotal={subtotal}
            discount={discount}
            taxable={taxable}
            tax={tax}
            total={total}
            notes={doc.notes}
            sigLabel="Vendor Signature"
          />
        </div>

        <header style={{ padding: "8px 12px", minHeight: "auto", borderBottom: "none", justifyContent: "flex-end" }}>
          <button type="button" className="sales-secondary" onClick={() => window.print()}>Print</button>
          <button type="button" className="sales-close" onClick={onClose} aria-label="Close">x</button>
        </header>
      </section>
    </div>
  );
}

"""

pdm_start3 = content.find("\nfunction PurchaseDocModal(")
export_start = content.find("\nexport default function Purchase(")

if pdm_start3 != -1 and export_start != -1:
    content = content[:pdm_start3] + NEW_PURCHASE_DOC_MODAL + content[export_start:]
    print("Replaced PurchaseDocModal")
else:
    print("WARNING: PurchaseDocModal or export boundaries not found", pdm_start3, export_start)

# Replace debounce in main Purchase component
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
    print("WARNING: debounce pattern not found")
    # Check if useEffect is still used elsewhere
    import re
    m = re.search(r'  const \[debouncedSearch.*?\}, \[search\]\);', content, re.DOTALL)
    if m:
        print("Found debounce at:", m.start(), m.group()[:100])
    else:
        print("No debounce found at all")

# Remove useEffect from imports if no longer needed
# Check if useEffect is still used
if "useEffect" not in content.replace("useEffect", "", 1):
    # Only one use was the debounce; it was removed
    content = content.replace('import { useEffect, useState } from "react";', 'import { useState } from "react";', 1)
    print("Removed useEffect from imports")
else:
    print("useEffect still used elsewhere, keeping in imports")

with open("E:/n8n/src/pages/Purchase.jsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done. File size:", len(content))
