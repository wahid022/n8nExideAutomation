'use strict';
// Realistic seed data for Bharat Batteries
// Run from E:/n8n/backend/ : node seed-data.js

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  max: 3,
});

const SEED_UID = '00000000-0000-0000-0000-000000000001';

// ── Helpers ──────────────────────────────────────────────────────
function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) { return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length)); }
function r2(v) { return Math.round(v * 100) / 100; }

function randDate(y, m) {
  const days = new Date(y, m, 0).getDate();
  const d = rand(1, days);
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function addDays(ds, n) {
  const d = new Date(ds + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function buildLines(products, count, markupFactor) {
  const selected = pickN(products, count);
  const items = [];
  let subtotal = 0, taxTotal = 0;
  for (const p of selected) {
    const base = Number(p.dealer_price || p.mrp || 500);
    const rate = r2(base * (markupFactor || 1.0));
    const qty = rand(3, 40);
    const lineAmt = r2(rate * qty);
    const gstRate = Number(p.gst_rate || 18);
    const taxAmt = r2(lineAmt * gstRate / 100);
    items.push({
      productId: p.id,
      productCode: p.product_code || '',
      description: p.model_sku || p.product_code || 'Product',
      qty, unit: 'Pcs', rate,
      discountPct: 0, discountAmt: 0,
      taxableValue: lineAmt, gstRate, taxAmt,
      total: r2(lineAmt + taxAmt),
    });
    subtotal += lineAmt;
    taxTotal += taxAmt;
  }
  subtotal = r2(subtotal);
  taxTotal = r2(taxTotal);
  return { items, subtotal, discountTotal: 0, taxableValue: subtotal, taxTotal, roundOff: 0, grandTotal: r2(subtotal + taxTotal) };
}

function cSnap(c) {
  return { id: c.id, businessName: c.business_name, contactName: c.contact_name, phone: c.phone, gstin: c.gstin || null, billingAddress: c.billing_address || null, state: c.state || null };
}
function vSnap(v) {
  return { id: v.id, businessName: v.business_name, contactName: v.contact_name, phone: v.phone, gstin: v.gstin || null, billingAddress: v.billing_address || null, state: v.state || null };
}

function repeat(val, n) { return Array.from({ length: n }, () => val); }

// ── Main ─────────────────────────────────────────────────────────
async function seed() {
  const client = await pool.connect();
  try {
    console.log('Loading reference data...');
    const { rows: products } = await client.query(`
      SELECT p.id, p.product_code, p.model_sku, pp.dealer_price, pp.mrp, pp.gst_rate
      FROM public.products p
      INNER JOIN LATERAL (
        SELECT dealer_price, mrp, gst_rate FROM public.product_prices
        WHERE product_id = p.id AND (effective_from IS NULL OR effective_from <= CURRENT_DATE)
        ORDER BY effective_from DESC NULLS LAST, id DESC LIMIT 1
      ) pp ON TRUE
    `);
    const { rows: customers } = await client.query(`SELECT id, business_name, contact_name, phone, gstin, billing_address, state FROM public.customers`);
    const { rows: vendors }   = await client.query(`SELECT id, business_name, contact_name, phone, gstin, billing_address, state FROM public.vendors`);

    console.log(`Products w/prices: ${products.length} | Customers: ${customers.length} | Vendors: ${vendors.length}`);
    if (!products.length || !customers.length || !vendors.length)
      throw new Error('Need products (with prices), customers, and vendors before seeding.');

    // ── DELETE ───────────────────────────────────────────────────
    console.log('\nClearing transaction data...');
    await client.query('BEGIN');
    await client.query('DELETE FROM public.sales_document_audit').catch(() => {});
    await client.query('DELETE FROM public.credit_notes');
    await client.query('DELETE FROM public.customer_payments');
    await client.query('DELETE FROM public.delivery_challans');
    await client.query('DELETE FROM public.sales_invoices');
    await client.query('DELETE FROM public.sales_orders');
    await client.query('DELETE FROM public.debit_notes');
    await client.query('DELETE FROM public.purchase_invoices');
    await client.query('DELETE FROM public.purchase_orders');
    console.log('Cleared.\n');

    // ── PURCHASE ORDERS (30) ─────────────────────────────────────
    // Status plan: [month, status]
    const poPlan = [
      [4,'Draft'],[4,'Sent'],[4,'Confirmed'],[4,'Received'],
      [5,'Sent'],[5,'Confirmed'],[5,'Received'],[5,'Received'],
      [6,'Confirmed'],[6,'Partially Received'],[6,'Received'],[6,'Received'],
      [7,'Received'],[7,'Received'],[7,'Received'],[7,'Sent'],[7,'Cancelled'],
      [8,'Received'],[8,'Received'],[8,'Received'],[8,'Confirmed'],[8,'Cancelled'],
      [9,'Received'],[9,'Received'],[9,'Received'],[9,'Partially Received'],[9,'Sent'],
      [10,'Received'],[10,'Draft'],[10,'Draft'],
    ];

    const purchaseOrders = [];
    for (let i = 0; i < poPlan.length; i++) {
      const [month, status] = poPlan[i];
      const vendor = pick(vendors);
      const snap = vSnap(vendor);
      const orderDate = randDate(2026, month);
      const expDelivery = addDays(orderDate, rand(7, 30));
      const { items, subtotal, discountTotal, taxableValue, taxTotal, grandTotal } = buildLines(products, rand(2, 5), 1.0);
      const num = `PO-2026-${String(i + 1).padStart(4,'0')}`;
      const { rows } = await client.query(
        `INSERT INTO public.purchase_orders (order_number,vendor_id,vendor_snapshot,items,subtotal,discount_total,taxable_value,tax_total,grand_total,status,order_date,expected_delivery,notes,created_by)
         VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [num, vendor.id, JSON.stringify(snap), JSON.stringify(items), subtotal, discountTotal, taxableValue, taxTotal, grandTotal, status, orderDate, expDelivery, null, SEED_UID]
      );
      purchaseOrders.push({ id: rows[0].id, vendorId: vendor.id, snap, vendor, month, status });
    }
    console.log(`✓ Purchase Orders: ${purchaseOrders.length}`);

    // ── PURCHASE INVOICES (45) ───────────────────────────────────
    // [status, month, isOverdue]
    const piPlan = [
      ...repeat(['Draft', 10, false], 3),
      ...repeat(['Received', 5, false], 2), ...repeat(['Received', 6, false], 2),
      ...repeat(['Received', 7, false], 2), ['Received', 8, false],
      ...repeat(['Partially Paid', 7, false], 2), ...repeat(['Partially Paid', 8, false], 2), ['Partially Paid', 9, false],
      ...repeat(['Paid', 4, false], 4), ...repeat(['Paid', 5, false], 5),
      ...repeat(['Paid', 6, false], 5), ...repeat(['Paid', 7, false], 4), ['Paid', 8, false],
      ...repeat(['Overdue', 7, true], 3), ...repeat(['Overdue', 8, true], 3), ...repeat(['Overdue', 9, true], 2),
      ['Void', 5, false], ['Void', 6, false],
    ];

    const receivedPOs = purchaseOrders.filter(po => ['Received','Partially Received','Confirmed'].includes(po.status));
    const purchaseInvoices = [];
    for (let i = 0; i < piPlan.length; i++) {
      const [status, month, isOverdue] = piPlan[i];
      const vendor = pick(vendors);
      const snap = vSnap(vendor);
      const invoiceDate = randDate(2026, month);
      const dueDate = isOverdue ? addDays(invoiceDate, rand(5, 20)) : addDays(invoiceDate, rand(20, 45));
      const linkedPO = status !== 'Draft' && receivedPOs.length > 0 ? pick(receivedPOs) : null;
      const { items, subtotal, discountTotal, taxableValue, taxTotal, grandTotal } = buildLines(products, rand(2, 5), 1.0);
      const num = `PINV-2026-${String(i + 1).padStart(4,'0')}`;
      const { rows } = await client.query(
        `INSERT INTO public.purchase_invoices (invoice_number,purchase_order_id,vendor_id,vendor_snapshot,items,invoice_date,due_date,subtotal,discount_total,taxable_value,tax_total,round_off,grand_total,status,notes,created_by)
         VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
        [num, linkedPO ? linkedPO.id : null, vendor.id, JSON.stringify(snap), JSON.stringify(items), invoiceDate, dueDate, subtotal, discountTotal, taxableValue, taxTotal, 0, grandTotal, status, null, SEED_UID]
      );
      purchaseInvoices.push({ id: rows[0].id, vendorId: vendor.id, snap, vendor, grandTotal, status });
    }
    console.log(`✓ Purchase Invoices: ${purchaseInvoices.length}`);

    // ── SALES ORDERS (55) ────────────────────────────────────────
    // statuses: Draft, Confirmed, Partially Delivered, Delivered, Cancelled
    const soPlan = [
      ...repeat(['Draft', 11], 5),
      ...repeat(['Confirmed', 10], 5), ...repeat(['Confirmed', 9], 5),
      ...repeat(['Partially Delivered', 8], 3), ...repeat(['Partially Delivered', 7], 2),
      ...repeat(['Delivered', 4], 8), ...repeat(['Delivered', 5], 7),
      ...repeat(['Delivered', 6], 8), ...repeat(['Delivered', 7], 7),
      ...repeat(['Cancelled', 5], 3), ...repeat(['Cancelled', 6], 2),
    ];

    const salesOrders = [];
    for (let i = 0; i < soPlan.length; i++) {
      const [status, month] = soPlan[i];
      const customer = pick(customers);
      const snap = cSnap(customer);
      const orderDate = randDate(2026, month);
      const markup = 1.35 + Math.random() * 0.2;
      const { items, subtotal, discountTotal, taxableValue, taxTotal, grandTotal } = buildLines(products, rand(2, 6), markup);
      const num = `SO-2026-${String(i + 1).padStart(4,'0')}`;
      const { rows } = await client.query(
        `INSERT INTO public.sales_orders (order_number,customer_id,customer_snapshot,items,subtotal,discount_total,taxable_value,tax_total,grand_total,status,order_date,notes,created_by)
         VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [num, customer.id, JSON.stringify(snap), JSON.stringify(items), subtotal, discountTotal, taxableValue, taxTotal, grandTotal, status, orderDate, null, SEED_UID]
      );
      salesOrders.push({ id: rows[0].id, customerId: customer.id, snap, customer, month, status });
    }
    console.log(`✓ Sales Orders: ${salesOrders.length}`);

    // ── DELIVERY CHALLANS (20) ───────────────────────────────────
    const deliverableSOs = salesOrders.filter(so => ['Delivered','Partially Delivered'].includes(so.status));
    const challanSOs = pickN(deliverableSOs, 20);
    for (let i = 0; i < challanSOs.length; i++) {
      const so = challanSOs[i];
      const challanDate = randDate(2026, so.month);
      const { items } = buildLines(products, rand(1, 4), 1.4);
      const challanStatus = so.status === 'Delivered' ? pick(['Delivered','Dispatched']) : 'Dispatched';
      const num = `DC-2026-${String(i + 1).padStart(4,'0')}`;
      await client.query(
        `INSERT INTO public.delivery_challans (challan_number,sales_order_id,customer_id,customer_snapshot,items,challan_date,status,notes,created_by)
         VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9)`,
        [num, so.id, so.customerId, JSON.stringify(so.snap), JSON.stringify(items), challanDate, challanStatus, null, SEED_UID]
      );
    }
    console.log(`✓ Delivery Challans: ${challanSOs.length}`);

    // ── SALES INVOICES (75) ──────────────────────────────────────
    const siPlan = [];
    repeat(['Draft',11], 5).forEach(x => siPlan.push(x));
    repeat(['Issued',10], 5).forEach(x => siPlan.push(x));
    repeat(['Issued',11], 5).forEach(x => siPlan.push(x));
    repeat(['Partially Paid',8], 4).forEach(x => siPlan.push(x));
    repeat(['Partially Paid',9], 4).forEach(x => siPlan.push(x));
    repeat(['Partially Paid',10], 4).forEach(x => siPlan.push(x));
    repeat(['Paid',4], 8).forEach(x => siPlan.push(x));
    repeat(['Paid',5], 9).forEach(x => siPlan.push(x));
    repeat(['Paid',6], 9).forEach(x => siPlan.push(x));
    repeat(['Paid',7], 9).forEach(x => siPlan.push(x));
    repeat(['Overdue',8], 5).forEach(x => siPlan.push(x));
    repeat(['Overdue',9], 5).forEach(x => siPlan.push(x));
    repeat(['Void',6], 2).forEach(x => siPlan.push(x));
    siPlan.push(['Void',7]);

    const deliveredSOs = salesOrders.filter(so => so.status === 'Delivered');
    const salesInvoices = [];
    for (let i = 0; i < siPlan.length; i++) {
      const [status, month] = siPlan[i];
      const customer = pick(customers);
      const snap = cSnap(customer);
      const invoiceDate = randDate(2026, month);
      const dueDate = addDays(invoiceDate, rand(15, 45));
      const linkedSO = status !== 'Draft' && Math.random() > 0.6 && deliveredSOs.length > 0 ? pick(deliveredSOs) : null;
      const markup = 1.35 + Math.random() * 0.2;
      const { items, subtotal, discountTotal, taxableValue, taxTotal, grandTotal } = buildLines(products, rand(2, 6), markup);
      const num = `SINV-2026-${String(i + 1).padStart(4,'0')}`;
      const { rows } = await client.query(
        `INSERT INTO public.sales_invoices (invoice_number,sales_order_id,customer_id,customer_snapshot,supplier_snapshot,items,invoice_date,due_date,subtotal,discount_total,taxable_value,tax_total,round_off,grand_total,status,notes,created_by)
         VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id, grand_total, invoice_date`,
        [num, linkedSO ? linkedSO.id : null, customer.id, JSON.stringify(snap), '{}', JSON.stringify(items), invoiceDate, dueDate, subtotal, discountTotal, taxableValue, taxTotal, 0, grandTotal, status, null, SEED_UID]
      );
      salesInvoices.push({ id: rows[0].id, customerId: customer.id, snap, customer, grandTotal: Number(rows[0].grand_total), status, invoiceDate: rows[0].invoice_date });
    }
    console.log(`✓ Sales Invoices: ${salesInvoices.length}`);

    // ── CUSTOMER PAYMENTS ────────────────────────────────────────
    // Valid methods: 'Cash','UPI','Bank Transfer','Cheque','Card','Other'
    const payMethods = ['UPI','UPI','UPI','UPI','UPI','Cash','Cash','Cash','Bank Transfer','Bank Transfer','Bank Transfer','Cheque','Cheque','Card','Other'];
    let payCount = 0;

    const paidSIs   = salesInvoices.filter(si => si.status === 'Paid');
    const partialSIs = salesInvoices.filter(si => si.status === 'Partially Paid');

    // Full payments for Paid invoices
    for (const inv of paidSIs) {
      const payDate = addDays(inv.invoiceDate, rand(1, 20));
      const method = pick(payMethods);
      const rcpt = `RCPT-${String(++payCount).padStart(6,'0')}`;
      await client.query(
        `INSERT INTO public.customer_payments (receipt_number,customer_id,invoice_id,payment_date,amount,payment_method,reference_number,notes,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Received',$9)`,
        [rcpt, inv.customerId, inv.id, payDate, inv.grandTotal, method, method !== 'Cash' ? `REF${rand(100000,999999)}` : null, null, SEED_UID]
      );
    }

    // Partial payments for Partially Paid invoices
    for (const inv of partialSIs) {
      const payDate = addDays(inv.invoiceDate, rand(1, 15));
      const method = pick(payMethods);
      const rcpt = `RCPT-${String(++payCount).padStart(6,'0')}`;
      const partialAmt = r2(inv.grandTotal * (0.4 + Math.random() * 0.4));
      await client.query(
        `INSERT INTO public.customer_payments (receipt_number,customer_id,invoice_id,payment_date,amount,payment_method,reference_number,notes,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Received',$9)`,
        [rcpt, inv.customerId, inv.id, payDate, partialAmt, method, method !== 'Cash' ? `REF${rand(100000,999999)}` : null, null, SEED_UID]
      );
    }

    // 10 advance/unlinked payments
    for (let i = 0; i < 10; i++) {
      const customer = pick(customers);
      const rcpt = `RCPT-${String(++payCount).padStart(6,'0')}`;
      const method = pick(payMethods);
      const payDate = randDate(2026, rand(4, 10));
      const amount = r2(rand(8000, 150000));
      await client.query(
        `INSERT INTO public.customer_payments (receipt_number,customer_id,invoice_id,payment_date,amount,payment_method,reference_number,notes,status,created_by)
         VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,'Received',$8)`,
        [rcpt, customer.id, payDate, amount, method, method !== 'Cash' ? `REF${rand(100000,999999)}` : null, 'Advance payment', SEED_UID]
      );
    }
    console.log(`✓ Customer Payments: ${payCount}`);

    // ── CREDIT NOTES (12) ────────────────────────────────────────
    const cnPlan = ['Draft','Draft','Issued','Issued','Issued','Issued','Issued','Applied','Applied','Applied','Void','Void'];
    const cnReasons = ['Goods returned by customer','Price adjustment after delivery','Quality defect — partial return','Damaged goods — full return','Billing correction'];
    const issuedSIs = salesInvoices.filter(si => ['Issued','Paid','Partially Paid'].includes(si.status));
    for (let i = 0; i < cnPlan.length; i++) {
      const status = cnPlan[i];
      const customer = pick(customers);
      const snap = cSnap(customer);
      const linkedInv = issuedSIs.length > 0 && Math.random() > 0.4 ? pick(issuedSIs) : null;
      const creditDate = randDate(2026, rand(5, 10));
      const amount = r2(rand(2000, 50000));
      const num = `CN-2026-${String(i + 1).padStart(4,'0')}`;
      await client.query(
        `INSERT INTO public.credit_notes (credit_note_number,invoice_id,customer_id,customer_snapshot,items,credit_date,amount,reason,status,created_by)
         VALUES ($1,$2,$3,$4::jsonb,'[]'::jsonb,$5,$6,$7,$8,$9)`,
        [num, linkedInv ? linkedInv.id : null, customer.id, JSON.stringify(snap), creditDate, amount, pick(cnReasons), status, SEED_UID]
      );
    }
    console.log(`✓ Credit Notes: ${cnPlan.length}`);

    // ── DEBIT NOTES (9) ──────────────────────────────────────────
    const dnPlan = ['Draft','Draft','Issued','Issued','Issued','Issued','Applied','Applied','Void'];
    const dnReasons = ['Goods returned to vendor','Short supply received','Quality rejection on receipt','Price discrepancy corrected','Damaged goods returned'];
    const qualifiedPIs = purchaseInvoices.filter(pi => ['Paid','Received','Partially Paid'].includes(pi.status));
    for (let i = 0; i < dnPlan.length; i++) {
      const status = dnPlan[i];
      const vendor = pick(vendors);
      const snap = vSnap(vendor);
      const linkedPI = qualifiedPIs.length > 0 && Math.random() > 0.4 ? pick(qualifiedPIs) : null;
      const debitDate = randDate(2026, rand(5, 10));
      const amount = r2(rand(1500, 30000));
      const num = `DN-2026-${String(i + 1).padStart(4,'0')}`;
      await client.query(
        `INSERT INTO public.debit_notes (debit_note_number,purchase_invoice_id,vendor_id,vendor_snapshot,debit_date,amount,reason,status,created_by)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)`,
        [num, linkedPI ? linkedPI.id : null, vendor.id, JSON.stringify(snap), debitDate, amount, pick(dnReasons), status, SEED_UID]
      );
    }
    console.log(`✓ Debit Notes: ${dnPlan.length}`);

    await client.query('COMMIT');
    console.log('\n✅ Seed complete!\n');

    // ── VERIFY ───────────────────────────────────────────────────
    const { rows: v } = await client.query(`
      SELECT 'sales_invoices'    AS tbl, COUNT(*)::int cnt, COALESCE(SUM(grand_total),0)::numeric(16,2) total FROM public.sales_invoices
      UNION ALL
      SELECT 'purchase_invoices',         COUNT(*), COALESCE(SUM(grand_total),0) FROM public.purchase_invoices
      UNION ALL
      SELECT 'customer_payments',         COUNT(*), COALESCE(SUM(amount),0)      FROM public.customer_payments
      UNION ALL
      SELECT 'credit_notes',              COUNT(*), COALESCE(SUM(amount),0)      FROM public.credit_notes
      UNION ALL
      SELECT 'debit_notes',               COUNT(*), COALESCE(SUM(amount),0)      FROM public.debit_notes
      UNION ALL
      SELECT 'sales_orders',              COUNT(*), COALESCE(SUM(grand_total),0) FROM public.sales_orders
      UNION ALL
      SELECT 'purchase_orders',           COUNT(*), COALESCE(SUM(grand_total),0) FROM public.purchase_orders
      UNION ALL
      SELECT 'delivery_challans',         COUNT(*), 0                            FROM public.delivery_challans
    `);
    console.log('─────────────────────────────────────────────────────');
    console.log('Table                   Count        Total (₹)');
    console.log('─────────────────────────────────────────────────────');
    for (const r of v) {
      const totalFmt = Number(r.total) > 0 ? `₹${Number(r.total).toLocaleString('en-IN')}` : '—';
      console.log(`${r.tbl.padEnd(24)}${String(r.cnt).padStart(5)}  ${totalFmt}`);
    }
    console.log('─────────────────────────────────────────────────────');

  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Seed failed:', e.message || e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
