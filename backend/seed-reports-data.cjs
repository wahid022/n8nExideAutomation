'use strict';
// Minimal, scenario-complete seed for P&L + Balance Sheet reports
// Products table is NOT touched (all 610 products preserved)
//
// Run from E:/n8n/backend/  →  node seed-reports-data.cjs
//
// What you get after running:
//   3 customers · 3 vendors
//   6 sales invoices  (Paid, Paid, Unpaid, Paid, Overdue, Partial)
//   5 purchase invoices (Paid, Paid, Unpaid, Paid, Unpaid)
//   3 sales orders · 2 purchase orders
//   4 customer payments · 1 credit note · 1 debit note
//
// Expected P&L:  Revenue ₹1,70,000  |  COGS ₹85,000  |  Gross Profit ₹85,000 (50%)
// Expected AR:   ₹1,08,900           |  AP: ₹55,600

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  max: 3,
});

function makeItems(lines) {
  return JSON.stringify(
    lines.map((l) => {
      const taxable = l.qty * l.rate;
      const taxAmt  = Math.round(taxable * l.gst) / 100;
      return {
        productId:    l.prod.id,
        productCode:  l.prod.product_code || '',
        description:  l.prod.model_sku    || l.prod.product_code || 'Product',
        qty:          l.qty,
        unit:         'Pcs',
        rate:         l.rate,
        discountPct:  0,
        discountAmt:  0,
        taxableValue: taxable,
        gstRate:      l.gst,
        taxAmt,
        total:        taxable + taxAmt,
      };
    })
  );
}

async function run() {
  const client = await pool.connect();
  try {
    // ── 0. Resolve user UUID ──────────────────────────────────────
    // Try existing customers first, then vendors, then fall back to constant
    const { rows: uRows } = await client.query(
      `SELECT created_by FROM public.customers ORDER BY created_at LIMIT 1`
    );
    const uid = uRows[0]?.created_by || '00000000-0000-0000-0000-000000000001';
    console.log(`Using seed user: ${uid}`);

    // ── 1. Load products (need real IDs) ─────────────────────────
    console.log('\nLoading products from catalogue...');
    const { rows: batteryProds } = await client.query(`
      SELECT p.id, p.product_code, p.model_sku, pp.dealer_price, pp.gst_rate
      FROM   public.products p
      INNER JOIN LATERAL (
        SELECT dealer_price, gst_rate FROM public.product_prices
        WHERE  product_id = p.id
        ORDER  BY effective_from DESC NULLS LAST, id DESC LIMIT 1
      ) pp ON TRUE
      WHERE  p.model_sku ILIKE '%AH%' OR p.model_sku ILIKE '%battery%'
      LIMIT  3
    `);
    const { rows: inverterProds } = await client.query(`
      SELECT p.id, p.product_code, p.model_sku, pp.dealer_price, pp.gst_rate
      FROM   public.products p
      INNER JOIN LATERAL (
        SELECT dealer_price, gst_rate FROM public.product_prices
        WHERE  product_id = p.id
        ORDER  BY effective_from DESC NULLS LAST, id DESC LIMIT 1
      ) pp ON TRUE
      WHERE  p.model_sku ILIKE '%KVA%' OR p.model_sku ILIKE '%VA%'
        OR   p.model_sku ILIKE '%inverter%'
      LIMIT  3
    `);
    const { rows: anyProds } = await client.query(`
      SELECT p.id, p.product_code, p.model_sku, pp.dealer_price, pp.gst_rate
      FROM   public.products p
      INNER JOIN LATERAL (
        SELECT dealer_price, gst_rate FROM public.product_prices
        WHERE  product_id = p.id
        ORDER  BY effective_from DESC NULLS LAST, id DESC LIMIT 1
      ) pp ON TRUE
      LIMIT  5
    `);

    if (!anyProds.length) throw new Error('No products found. Import products first.');

    // Pick representative products with fallbacks
    const batA    = batteryProds[0]  || anyProds[0];
    const batB    = batteryProds[1]  || anyProds[1] || batA;
    const invA    = inverterProds[0] || anyProds[2] || batA;
    const invB    = inverterProds[1] || anyProds[3] || invA;
    const generic = anyProds[4]      || batA;

    console.log(`  Battery A : ${batA.product_code}  ${batA.model_sku}`);
    console.log(`  Battery B : ${batB.product_code}  ${batB.model_sku}`);
    console.log(`  Inverter A: ${invA.product_code}  ${invA.model_sku}`);
    console.log(`  Inverter B: ${invB.product_code}  ${invB.model_sku}`);
    console.log(`  Generic   : ${generic.product_code}  ${generic.model_sku}`);

    // ── 2. Clear all transaction + party tables ───────────────────
    console.log('\nClearing old data (products table untouched)...');
    await client.query('BEGIN');
    // Delete in FK-safe order (children before parents)
    await client.query('DELETE FROM public.sales_document_audit').catch(() => {});
    await client.query('DELETE FROM public.payment_allocations').catch(() => {});
    await client.query('DELETE FROM public.customer_payments');
    await client.query('DELETE FROM public.credit_notes');
    await client.query('DELETE FROM public.delivery_challans');
    await client.query('DELETE FROM public.recurring_invoices').catch(() => {});
    await client.query('DELETE FROM public.quotations').catch(() => {});
    await client.query('DELETE FROM public.sales_invoices');
    await client.query('DELETE FROM public.sales_orders');
    await client.query('DELETE FROM public.debit_notes');
    await client.query('DELETE FROM public.purchase_invoices');
    await client.query('DELETE FROM public.purchase_orders');
    await client.query('DELETE FROM public.customers');
    await client.query('DELETE FROM public.vendors');
    console.log('Cleared.\n');

    // ── 3. CUSTOMERS (3) ─────────────────────────────────────────
    //   C1: Sunrise Electronics  — Jharkhand  — Intra-state
    //   C2: Bharat Traders       — Delhi      — Inter-state
    //   C3: TechVision Pvt Ltd   — Maharashtra— Inter-state
    await client.query(`
      INSERT INTO public.customers
        (business_name, contact_name, phone, gstin, billing_address, state, customer_type, created_by)
      VALUES
        ('Sunrise Electronics',  'Ramesh Kumar',  '9431100001', '20SRSEL0001F1Z5',
         'Shop 15, Station Road, Jamshedpur',   'Jharkhand',    'Retailer',   $1),
        ('Bharat Traders',       'Suresh Verma',  '9810200002', '07BHRTD0001D1Z3',
         'B-42, Nehru Place, New Delhi',         'Delhi',        'Wholesaler', $1),
        ('TechVision Pvt Ltd',   'Priya Nair',    '9820300003', '27TCHVP0001M1Z1',
         'Office 5B, Andheri East, Mumbai',      'Maharashtra',  'Wholesaler', $1)
    `, [uid]);

    const { rows: customers } = await client.query(
      `SELECT id, business_name, contact_name, phone, gstin, billing_address, state
       FROM public.customers ORDER BY id`
    );
    const [c1, c2, c3] = customers;
    console.log(`✓ Customers: ${customers.map((c) => c.business_name).join(' · ')}`);

    // ── 4. VENDORS (3) ───────────────────────────────────────────
    //   V1: Exide Industries Ltd  — Gujarat  (Inter-state, 28% batteries)
    //   V2: Luminous Power Tech   — Haryana  (Inter-state, 18% inverters)
    //   V3: Ram & Sons Hardware   — Jharkhand (No GSTIN, Non-GST local)
    await client.query(`
      INSERT INTO public.vendors
        (business_name, contact_name, phone, gstin, billing_address, state, vendor_type, created_by)
      VALUES
        ('Exide Industries Ltd', 'Amit Shah',    '9000400004', '24EXIDI0001G1Z7',
         'Plot 10, GIDC Estate, Ahmedabad',  'Gujarat',    'Manufacturer', $1),
        ('Luminous Power Tech',  'Rohit Kapoor', '9000500005', '06LUMPT0001H1Z2',
         'Sector 58, Gurugram, Haryana',     'Haryana',    'Manufacturer', $1),
        ('Ram & Sons Hardware',  'Ram Prasad',   '9431600006', NULL,
         'Near Clock Tower, Jamshedpur',     'Jharkhand',  'Supplier',     $1)
    `, [uid]);

    const { rows: vendors } = await client.query(
      `SELECT id, business_name, contact_name, phone, gstin, billing_address, state
       FROM public.vendors ORDER BY id`
    );
    const [v1, v2, v3] = vendors;
    console.log(`✓ Vendors:   ${vendors.map((v) => v.business_name).join(' · ')}`);

    // Snapshot builders (camelCase JSON for frontend)
    const cs = (c) => JSON.stringify({
      id: c.id, businessName: c.business_name, contactName: c.contact_name,
      phone: c.phone, gstin: c.gstin || null,
      billingAddress: c.billing_address || null, state: c.state || null,
    });
    const vs = (v) => JSON.stringify({
      id: v.id, businessName: v.business_name, contactName: v.contact_name,
      phone: v.phone, gstin: v.gstin || null,
      billingAddress: v.billing_address || null, state: v.state || null,
    });

    // ── 5. SALES ORDERS (3) ───────────────────────────────────────
    console.log('\nInserting Sales Orders...');

    // SO-001  Sunrise · Sep 5 · Delivered (linked to SINV-001)
    const { rows: [so1] } = await client.query(`
      INSERT INTO public.sales_orders
        (order_number, customer_id, customer_snapshot, items,
         subtotal, discount_total, taxable_value, tax_total, grand_total,
         status, order_date, notes, created_by)
      VALUES ('SO-2026-001', $1, $2::jsonb, $3::jsonb,
              40000, 0, 40000, 7200, 47200,
              'Delivered', '2026-09-05', null, $4) RETURNING id
    `, [c1.id, cs(c1), makeItems([{ prod: batA, qty: 5, rate: 8000, gst: 18 }]), uid]);

    // SO-002  TechVision · Sep 28 · Delivered (linked to SINV-003)
    const { rows: [so2] } = await client.query(`
      INSERT INTO public.sales_orders
        (order_number, customer_id, customer_snapshot, items,
         subtotal, discount_total, taxable_value, tax_total, grand_total,
         status, order_date, notes, created_by)
      VALUES ('SO-2026-002', $1, $2::jsonb, $3::jsonb,
              30000, 0, 30000, 5400, 35400,
              'Delivered', '2026-09-28', null, $4) RETURNING id
    `, [c3.id, cs(c3), makeItems([{ prod: batB, qty: 3, rate: 10000, gst: 18 }]), uid]);

    // SO-003  Bharat Traders · Nov 3 · Confirmed (pending, not yet invoiced)
    const { rows: [so3] } = await client.query(`
      INSERT INTO public.sales_orders
        (order_number, customer_id, customer_snapshot, items,
         subtotal, discount_total, taxable_value, tax_total, grand_total,
         status, order_date, notes, created_by)
      VALUES ('SO-2026-003', $1, $2::jsonb, $3::jsonb,
              35000, 0, 35000, 6300, 41300,
              'Confirmed', '2026-11-03', 'Awaiting dispatch', $4) RETURNING id
    `, [c2.id, cs(c2),
        makeItems([{ prod: batA, qty: 2, rate: 10000, gst: 18 }, { prod: invA, qty: 1, rate: 15000, gst: 18 }]),
        uid]);

    console.log('✓ Sales Orders: 3  (SO-2026-001 · SO-2026-002 · SO-2026-003)');

    // ── 6. SALES INVOICES (6) ─────────────────────────────────────
    console.log('Inserting Sales Invoices...');

    //  SINV-001 · Sep 10 · C1 Sunrise · Intra-state 18% · PAID ✓
    //  Taxable ₹40,000  GST ₹7,200  Total ₹47,200
    const { rows: [si1] } = await client.query(`
      INSERT INTO public.sales_invoices
        (invoice_number, sales_order_id, customer_id, customer_snapshot, supplier_snapshot,
         items, invoice_date, due_date,
         subtotal, discount_total, taxable_value, tax_total, round_off, grand_total,
         status, notes, created_by)
      VALUES ('SINV-2026-001', $1, $2, $3::jsonb, '{}'::jsonb,
              $4::jsonb, '2026-09-10', '2026-10-10',
              40000, 0, 40000, 7200, 0, 47200,
              'Paid', 'Intra-state CGST+SGST 18%', $5) RETURNING id
    `, [so1.id, c1.id, cs(c1), makeItems([{ prod: batA, qty: 5, rate: 8000, gst: 18 }]), uid]);

    //  SINV-002 · Sep 20 · C2 Bharat Traders · Inter-state 12% · PAID ✓
    //  Taxable ₹20,000  GST ₹2,400  Total ₹22,400
    const { rows: [si2] } = await client.query(`
      INSERT INTO public.sales_invoices
        (invoice_number, sales_order_id, customer_id, customer_snapshot, supplier_snapshot,
         items, invoice_date, due_date,
         subtotal, discount_total, taxable_value, tax_total, round_off, grand_total,
         status, notes, created_by)
      VALUES ('SINV-2026-002', null, $1, $2::jsonb, '{}'::jsonb,
              $3::jsonb, '2026-09-20', '2026-10-20',
              20000, 0, 20000, 2400, 0, 22400,
              'Paid', 'Inter-state IGST 12%', $4) RETURNING id
    `, [c2.id, cs(c2), makeItems([{ prod: invA, qty: 2, rate: 10000, gst: 12 }]), uid]);

    //  SINV-003 · Oct 05 · C3 TechVision · Inter-state 18% · UNPAID (AR)
    //  Taxable ₹30,000  GST ₹5,400  Total ₹35,400  Due: Nov 05 (today!)
    const { rows: [si3] } = await client.query(`
      INSERT INTO public.sales_invoices
        (invoice_number, sales_order_id, customer_id, customer_snapshot, supplier_snapshot,
         items, invoice_date, due_date,
         subtotal, discount_total, taxable_value, tax_total, round_off, grand_total,
         status, notes, created_by)
      VALUES ('SINV-2026-003', $1, $2, $3::jsonb, '{}'::jsonb,
              $4::jsonb, '2026-10-05', '2026-11-05',
              30000, 0, 30000, 5400, 0, 35400,
              'Issued', 'Inter-state IGST 18% — due today, unpaid (AR ₹35,400)', $5) RETURNING id
    `, [so2.id, c3.id, cs(c3), makeItems([{ prod: batB, qty: 3, rate: 10000, gst: 18 }]), uid]);

    //  SINV-004 · Oct 15 · C1 Sunrise · Non-GST · PAID ✓
    //  Taxable ₹10,000  GST ₹0  Total ₹10,000
    const { rows: [si4] } = await client.query(`
      INSERT INTO public.sales_invoices
        (invoice_number, sales_order_id, customer_id, customer_snapshot, supplier_snapshot,
         items, invoice_date, due_date,
         subtotal, discount_total, taxable_value, tax_total, round_off, grand_total,
         status, notes, created_by)
      VALUES ('SINV-2026-004', null, $1, $2::jsonb, '{}'::jsonb,
              $3::jsonb, '2026-10-15', '2026-11-15',
              10000, 0, 10000, 0, 0, 10000,
              'Paid', 'Non-GST sale — accessories/misc', $4) RETURNING id
    `, [c1.id, cs(c1), makeItems([{ prod: generic, qty: 10, rate: 1000, gst: 0 }]), uid]);

    //  SINV-005 · Oct 25 · C2 Bharat Traders · Inter-state 18% · OVERDUE (AR)
    //  Taxable ₹50,000  GST ₹9,000  Total ₹59,000  Due: Oct 31 (overdue)
    const { rows: [si5] } = await client.query(`
      INSERT INTO public.sales_invoices
        (invoice_number, sales_order_id, customer_id, customer_snapshot, supplier_snapshot,
         items, invoice_date, due_date,
         subtotal, discount_total, taxable_value, tax_total, round_off, grand_total,
         status, notes, created_by)
      VALUES ('SINV-2026-005', null, $1, $2::jsonb, '{}'::jsonb,
              $3::jsonb, '2026-10-25', '2026-10-31',
              50000, 0, 50000, 9000, 0, 59000,
              'Overdue', 'Inter-state IGST 18% — overdue since Oct 31 (AR ₹59,000)', $4) RETURNING id
    `, [c2.id, cs(c2), makeItems([{ prod: batA, qty: 5, rate: 10000, gst: 18 }]), uid]);

    //  SINV-006 · Nov 01 · C3 TechVision · Intra-state 18% · PARTIALLY PAID
    //  Taxable ₹25,000  GST ₹4,500  Total ₹29,500  Paid ₹15,000  Outstanding ₹14,500
    const { rows: [si6] } = await client.query(`
      INSERT INTO public.sales_invoices
        (invoice_number, sales_order_id, customer_id, customer_snapshot, supplier_snapshot,
         items, invoice_date, due_date,
         subtotal, discount_total, taxable_value, tax_total, round_off, grand_total,
         status, notes, created_by)
      VALUES ('SINV-2026-006', null, $1, $2::jsonb, '{}'::jsonb,
              $3::jsonb, '2026-11-01', '2026-12-01',
              25000, 0, 25000, 4500, 0, 29500,
              'Partially Paid', 'Intra-state CGST+SGST 18% — ₹15,000 paid, ₹14,500 outstanding', $4) RETURNING id
    `, [c3.id, cs(c3), makeItems([{ prod: invB, qty: 5, rate: 5000, gst: 18 }]), uid]);

    console.log('✓ Sales Invoices: 6');
    console.log('  SINV-001 Paid ₹47,200  · SINV-002 Paid ₹22,400  · SINV-003 Unpaid ₹35,400');
    console.log('  SINV-004 Paid ₹10,000  · SINV-005 Overdue ₹59,000 · SINV-006 Partial ₹29,500');

    // ── 7. CUSTOMER PAYMENTS (4) ──────────────────────────────────
    console.log('Inserting Customer Payments...');

    // SINV-001: full ₹47,200 on Sep 15
    await client.query(`
      INSERT INTO public.customer_payments
        (receipt_number, customer_id, invoice_id, payment_date, amount,
         payment_method, reference_number, notes, status, created_by)
      VALUES ('RCPT-2026-001', $1, $2, '2026-09-15', 47200,
              'Bank Transfer', 'NEFT-091501', 'Full payment SINV-2026-001', 'Received', $3)
    `, [c1.id, si1.id, uid]);

    // SINV-002: full ₹22,400 on Sep 25
    await client.query(`
      INSERT INTO public.customer_payments
        (receipt_number, customer_id, invoice_id, payment_date, amount,
         payment_method, reference_number, notes, status, created_by)
      VALUES ('RCPT-2026-002', $1, $2, '2026-09-25', 22400,
              'UPI', 'UPI-092501', 'Full payment SINV-2026-002', 'Received', $3)
    `, [c2.id, si2.id, uid]);

    // SINV-004: full ₹10,000 on Oct 18 (Cash, no-GST invoice)
    await client.query(`
      INSERT INTO public.customer_payments
        (receipt_number, customer_id, invoice_id, payment_date, amount,
         payment_method, reference_number, notes, status, created_by)
      VALUES ('RCPT-2026-003', $1, $2, '2026-10-18', 10000,
              'Cash', null, 'Full payment SINV-2026-004 (Non-GST)', 'Received', $3)
    `, [c1.id, si4.id, uid]);

    // SINV-006: partial ₹15,000 on Nov 3 (₹14,500 outstanding)
    await client.query(`
      INSERT INTO public.customer_payments
        (receipt_number, customer_id, invoice_id, payment_date, amount,
         payment_method, reference_number, notes, status, created_by)
      VALUES ('RCPT-2026-004', $1, $2, '2026-11-03', 15000,
              'UPI', 'UPI-110301', 'Part payment SINV-2026-006 — ₹14,500 still outstanding', 'Received', $3)
    `, [c3.id, si6.id, uid]);

    console.log('✓ Customer Payments: 4  (RCPT-001 to RCPT-004)');

    // ── 8. PURCHASE ORDERS (2) ───────────────────────────────────
    console.log('Inserting Purchase Orders...');

    // PO-001  Exide · Sep 1 · Received (fulfilled, linked to PINV-001)
    const { rows: [po1] } = await client.query(`
      INSERT INTO public.purchase_orders
        (order_number, vendor_id, vendor_snapshot, items,
         subtotal, discount_total, taxable_value, tax_total, grand_total,
         status, order_date, expected_delivery, notes, created_by)
      VALUES ('PO-2026-001', $1, $2::jsonb, $3::jsonb,
              20000, 0, 20000, 5600, 25600,
              'Received', '2026-09-01', '2026-09-05', null, $4) RETURNING id
    `, [v1.id, vs(v1), makeItems([{ prod: batA, qty: 10, rate: 2000, gst: 28 }]), uid]);

    // PO-002  Luminous · Nov 2 · Draft (pending, not sent yet)
    const { rows: [po2] } = await client.query(`
      INSERT INTO public.purchase_orders
        (order_number, vendor_id, vendor_snapshot, items,
         subtotal, discount_total, taxable_value, tax_total, grand_total,
         status, order_date, expected_delivery, notes, created_by)
      VALUES ('PO-2026-002', $1, $2::jsonb, $3::jsonb,
              20000, 0, 20000, 3600, 23600,
              'Draft', '2026-11-02', '2026-11-20', 'Awaiting confirmation', $4) RETURNING id
    `, [v2.id, vs(v2), makeItems([{ prod: invA, qty: 5, rate: 4000, gst: 18 }]), uid]);

    console.log('✓ Purchase Orders: 2  (PO-2026-001 Received · PO-2026-002 Draft)');

    // ── 9. PURCHASE INVOICES (5) ─────────────────────────────────
    console.log('Inserting Purchase Invoices...');

    //  PINV-001 · Sep 05 · V1 Exide · Inter-state 28% · PAID ✓
    //  Taxable ₹20,000  GST ₹5,600  Total ₹25,600
    const { rows: [pi1] } = await client.query(`
      INSERT INTO public.purchase_invoices
        (invoice_number, purchase_order_id, vendor_id, vendor_snapshot,
         items, invoice_date, due_date,
         subtotal, discount_total, taxable_value, tax_total, round_off, grand_total,
         status, notes, created_by)
      VALUES ('PINV-2026-001', $1, $2, $3::jsonb,
              $4::jsonb, '2026-09-05', '2026-10-05',
              20000, 0, 20000, 5600, 0, 25600,
              'Paid', 'Inter-state IGST 28% — batteries from Exide', $5) RETURNING id
    `, [po1.id, v1.id, vs(v1), makeItems([{ prod: batA, qty: 10, rate: 2000, gst: 28 }]), uid]);

    //  PINV-002 · Sep 15 · V2 Luminous · Inter-state 18% · PAID ✓
    //  Taxable ₹15,000  GST ₹2,700  Total ₹17,700
    const { rows: [pi2] } = await client.query(`
      INSERT INTO public.purchase_invoices
        (invoice_number, purchase_order_id, vendor_id, vendor_snapshot,
         items, invoice_date, due_date,
         subtotal, discount_total, taxable_value, tax_total, round_off, grand_total,
         status, notes, created_by)
      VALUES ('PINV-2026-002', null, $1, $2::jsonb,
              $3::jsonb, '2026-09-15', '2026-10-15',
              15000, 0, 15000, 2700, 0, 17700,
              'Paid', 'Inter-state IGST 18% — inverters from Luminous', $4) RETURNING id
    `, [v2.id, vs(v2), makeItems([{ prod: invA, qty: 5, rate: 3000, gst: 18 }]), uid]);

    //  PINV-003 · Oct 08 · V1 Exide · Inter-state 28% · UNPAID (AP)
    //  Taxable ₹25,000  GST ₹7,000  Total ₹32,000  Due: Nov 08
    const { rows: [pi3] } = await client.query(`
      INSERT INTO public.purchase_invoices
        (invoice_number, purchase_order_id, vendor_id, vendor_snapshot,
         items, invoice_date, due_date,
         subtotal, discount_total, taxable_value, tax_total, round_off, grand_total,
         status, notes, created_by)
      VALUES ('PINV-2026-003', null, $1, $2::jsonb,
              $3::jsonb, '2026-10-08', '2026-11-08',
              25000, 0, 25000, 7000, 0, 32000,
              'Received', 'Inter-state IGST 28% — unpaid, AP ₹32,000', $4) RETURNING id
    `, [v1.id, vs(v1), makeItems([{ prod: batB, qty: 10, rate: 2500, gst: 28 }]), uid]);

    //  PINV-004 · Oct 18 · V3 Ram & Sons · Non-GST · PAID ✓
    //  Taxable ₹8,000  GST ₹0  Total ₹8,000
    const { rows: [pi4] } = await client.query(`
      INSERT INTO public.purchase_invoices
        (invoice_number, purchase_order_id, vendor_id, vendor_snapshot,
         items, invoice_date, due_date,
         subtotal, discount_total, taxable_value, tax_total, round_off, grand_total,
         status, notes, created_by)
      VALUES ('PINV-2026-004', null, $1, $2::jsonb,
              $3::jsonb, '2026-10-18', '2026-11-18',
              8000, 0, 8000, 0, 0, 8000,
              'Paid', 'Non-GST local purchase from Ram & Sons', $4) RETURNING id
    `, [v3.id, vs(v3), makeItems([{ prod: generic, qty: 1, rate: 8000, gst: 0 }]), uid]);

    //  PINV-005 · Nov 02 · V2 Luminous · Inter-state 18% · UNPAID (AP)
    //  Taxable ₹20,000  GST ₹3,600  Total ₹23,600  Due: Dec 02
    const { rows: [pi5] } = await client.query(`
      INSERT INTO public.purchase_invoices
        (invoice_number, purchase_order_id, vendor_id, vendor_snapshot,
         items, invoice_date, due_date,
         subtotal, discount_total, taxable_value, tax_total, round_off, grand_total,
         status, notes, created_by)
      VALUES ('PINV-2026-005', null, $1, $2::jsonb,
              $3::jsonb, '2026-11-02', '2026-12-02',
              20000, 0, 20000, 3600, 0, 23600,
              'Received', 'Inter-state IGST 18% — unpaid, AP ₹23,600', $4) RETURNING id
    `, [v2.id, vs(v2), makeItems([{ prod: invB, qty: 5, rate: 4000, gst: 18 }]), uid]);

    console.log('✓ Purchase Invoices: 5');
    console.log('  PINV-001 Paid ₹25,600 · PINV-002 Paid ₹17,700 · PINV-003 Unpaid ₹32,000');
    console.log('  PINV-004 Paid ₹8,000  · PINV-005 Unpaid ₹23,600');

    // ── 10. CREDIT NOTE (1) ──────────────────────────────────────
    //  CN-001: Against SINV-001 (Sunrise) · Nov 01 · ₹5,000
    //  Reduces net revenue: ₹1,75,000 − ₹5,000 = ₹1,70,000
    await client.query(`
      INSERT INTO public.credit_notes
        (credit_note_number, invoice_id, customer_id, customer_snapshot,
         items, credit_date, amount, reason, status, created_by)
      VALUES ('CN-2026-001', $1, $2, $3::jsonb,
              '[]'::jsonb, '2026-11-01', 5000,
              'Product return — 1 Exide 150AH battery returned by Sunrise Electronics',
              'Issued', $4)
    `, [si1.id, c1.id, cs(c1), uid]);

    // ── 11. DEBIT NOTE (1) ───────────────────────────────────────
    //  DN-001: Against PINV-001 (Exide) · Nov 01 · ₹3,000
    //  Reduces net COGS: ₹88,000 − ₹3,000 = ₹85,000
    await client.query(`
      INSERT INTO public.debit_notes
        (debit_note_number, purchase_invoice_id, vendor_id, vendor_snapshot,
         debit_date, amount, reason, status, created_by)
      VALUES ('DN-2026-001', $1, $2, $3::jsonb,
              '2026-11-01', 3000,
              'Defective battery units returned to Exide Industries — 1 unit rejected on inspection',
              'Issued', $4)
    `, [pi1.id, v1.id, vs(v1), uid]);

    console.log('✓ Credit Note:  CN-2026-001  ₹5,000  (against SINV-2026-001)');
    console.log('✓ Debit Note:   DN-2026-001  ₹3,000  (against PINV-2026-001)');

    await client.query('COMMIT');

    // ── 12. VERIFY ───────────────────────────────────────────────
    console.log('\n' + '─'.repeat(60));
    console.log('VERIFICATION');
    console.log('─'.repeat(60));

    const { rows: counts } = await client.query(`
      SELECT 'customers'          entity, COUNT(*)::int cnt FROM public.customers
      UNION ALL SELECT 'vendors',           COUNT(*) FROM public.vendors
      UNION ALL SELECT 'sales_orders',      COUNT(*) FROM public.sales_orders
      UNION ALL SELECT 'sales_invoices',    COUNT(*) FROM public.sales_invoices
      UNION ALL SELECT 'customer_payments', COUNT(*) FROM public.customer_payments
      UNION ALL SELECT 'purchase_orders',   COUNT(*) FROM public.purchase_orders
      UNION ALL SELECT 'purchase_invoices', COUNT(*) FROM public.purchase_invoices
      UNION ALL SELECT 'credit_notes',      COUNT(*) FROM public.credit_notes
      UNION ALL SELECT 'debit_notes',       COUNT(*) FROM public.debit_notes
      ORDER BY entity
    `);
    counts.forEach((r) => console.log(`  ${r.entity.padEnd(22)} ${String(r.cnt).padStart(3)}`));

    const { rows: [inv] } = await client.query(`
      SELECT
        SUM(taxable_value)::int              AS revenue,
        SUM(grand_total)::int                AS gross_revenue,
        SUM(CASE WHEN status IN ('Paid','Issued','Overdue','Partially Paid') THEN 1 ELSE 0 END) issued_count,
        SUM(CASE WHEN status IN ('Issued','Overdue','Partially Paid') THEN grand_total ELSE 0 END)::int ar
      FROM public.sales_invoices
    `);
    const { rows: [pur] } = await client.query(`
      SELECT
        SUM(taxable_value)::int              AS cogs,
        SUM(CASE WHEN status IN ('Received','Overdue') THEN grand_total ELSE 0 END)::int ap
      FROM public.purchase_invoices
    `);
    const { rows: [cn] } = await client.query(`SELECT COALESCE(SUM(amount),0)::int total FROM public.credit_notes`);
    const { rows: [dn] } = await client.query(`SELECT COALESCE(SUM(amount),0)::int total FROM public.debit_notes`);

    console.log('\n' + '─'.repeat(60));
    console.log('EXPECTED REPORTS');
    console.log('─'.repeat(60));
    console.log('  PROFIT & LOSS');
    console.log(`    Gross Revenue (taxable) ₹${inv.revenue.toLocaleString('en-IN').padStart(10)}`);
    console.log(`    Less Credit Notes       ₹${cn.total.toLocaleString('en-IN').padStart(10)}`);
    console.log(`    Net Revenue             ₹${(inv.revenue - cn.total).toLocaleString('en-IN').padStart(10)}`);
    console.log(`    Gross COGS (taxable)    ₹${pur.cogs.toLocaleString('en-IN').padStart(10)}`);
    console.log(`    Less Debit Notes        ₹${dn.total.toLocaleString('en-IN').padStart(10)}`);
    console.log(`    Net COGS                ₹${(pur.cogs - dn.total).toLocaleString('en-IN').padStart(10)}`);
    const gp = (inv.revenue - cn.total) - (pur.cogs - dn.total);
    const gpPct = Math.round(gp / (inv.revenue - cn.total) * 100);
    console.log(`    Gross Profit            ₹${gp.toLocaleString('en-IN').padStart(10)}  (${gpPct}% margin)`);
    console.log('');
    console.log('  BALANCE SHEET');
    console.log(`    Accounts Receivable     ₹${inv.ar.toLocaleString('en-IN').padStart(10)}`);
    console.log(`      SINV-003 Unpaid           ₹35,400`);
    console.log(`      SINV-005 Overdue          ₹59,000`);
    console.log(`      SINV-006 Outstanding      ₹14,500  (₹29,500 − ₹15,000 paid)`);
    console.log(`    Accounts Payable         ₹${pur.ap.toLocaleString('en-IN').padStart(10)}`);
    console.log(`      PINV-003 Unpaid           ₹32,000`);
    console.log(`      PINV-005 Unpaid           ₹23,600`);
    console.log('─'.repeat(60));
    console.log('\n✅ Seed complete! Products table was not modified.\n');

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Seed failed — rolled back.');
    console.error(err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
