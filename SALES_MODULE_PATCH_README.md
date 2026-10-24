# Bharat Batteries Sales Module Patch

This is an incremental patch for the existing `n8n` project, based on the uploaded project and the already-applied `005_sales_documents` migration. It contains only files that are new or need replacement.

## Included

- Existing Sales page and authenticated endpoints for sales order/invoice/payment listing and creation.
- Sales Operations screen for delivery challans, credit notes, recurring invoice templates, and quotation conversion.
- Authenticated endpoints for challan creation/status changes, credit-note creation/status changes, recurring template management, due recurring invoice generation, customer ledger lookup, invoice issue/void transitions, and quotation-to-order conversion.
- Migration `006_sales_workflows.sql` adds recurring invoice templates, payment allocation foundation, and a document audit table.
- Migration runner registration for 006. It also registers 005; the 005 SQL file is intentionally not included because it is already in the user's project and applied.

## Apply

1. Back up the project and database. Create a Git branch.
2. Extract this ZIP at the root of the existing project so paths merge into `backend/` and `src/`.
3. Confirm `backend/sql/migrations/005_sales_documents.sql` exists locally (it should, because migration 005 was applied).
4. From `backend/`, run `npm.cmd run migrate` to apply migration 006, then run `npm.cmd run build` and `npm.cmd run dev`.
5. From the project root, run `npm.cmd run build` and `npm.cmd run dev`.
6. Sign in and open `/sales` and `/sales-operations`.

## Important limitations / production checklist

This patch expands Sales workflows but is not a fully audited, production-ready ERP. GST treatment and invoice format must be confirmed with your accountant. Product-catalogue selection and inventory deductions are not connected to an inventory ledger yet. Payment allocation table is a foundation; the existing payment form still supports one invoice per receipt, not multi-invoice allocation. Recurring invoices are generated only when an authenticated user explicitly clicks **Generate due invoices**; no scheduler is configured. Credit-note issue/status handling does not yet automatically post accounting entries or reduce receivables. Sales order editing, delivery quantity reconciliation/partial-delivery accounting, invoice PDF generation, refunds/reversals, role-specific permissions, and automated integration tests still need implementation and verification. Quotation conversion requires a quotation whose item JSON uses the supported Sales line structure; otherwise the API returns a validation error and the quotation remains unchanged.

Do not use for live invoicing until the remaining business rules, database behavior, GST requirements, and end-to-end tests are reviewed.
