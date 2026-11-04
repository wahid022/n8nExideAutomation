-- =============================================================
-- Bharat Batteries — Sample Data Seed Script
-- Run once in your Supabase SQL editor to populate realistic
-- test data across all sales modules.
--
-- Uses the same created_by UUID as your existing customer
-- records so all data appears under your account.
-- =============================================================

DO $$
DECLARE
  v_user UUID;

  -- customer IDs
  c_shri  BIGINT; c_apex  BIGINT; c_metro BIGINT; c_power BIGINT;
  c_city  BIGINT; c_elite BIGINT; c_jsr   BIGINT; c_dhan  BIGINT;

  -- order IDs
  o1 BIGINT; o2 BIGINT; o3 BIGINT; o4 BIGINT; o7 BIGINT;

  -- invoice IDs
  i1 BIGINT; i2 BIGINT; i3 BIGINT; i4 BIGINT;
  i6 BIGINT;

BEGIN

  -- ── Resolve the logged-in user's UUID ──────────────────────
  SELECT created_by INTO v_user
  FROM   public.customers
  ORDER  BY created_at
  LIMIT  1;

  IF v_user IS NULL THEN
    RAISE EXCEPTION
      'No customers found. Sign in and create at least one customer first, then re-run this script.';
  END IF;

  RAISE NOTICE 'Seeding data for user %', v_user;

  -- ============================================================
  -- 1. CUSTOMERS  (8 realistic Jharkhand battery businesses)
  -- ============================================================
  INSERT INTO public.customers
        (business_name, contact_name, phone, gstin, billing_address, state, customer_type, created_by)
  VALUES
    ('Shri Ganesh Battery Centre', 'Ravi Kumar',    '9431100001', '20ABCPG1234F1Z5',
     'Shop 12, Station Road, Jamshedpur',               'Jharkhand', 'Retailer',   v_user),
    ('Apex Power Solutions',       'Suresh Mehta',  '9431100002', '20ABCPA5678F1Z3',
     'Plot 45, Adityapur Industrial Area, Jamshedpur',  'Jharkhand', 'Wholesaler', v_user),
    ('Metro Electricals',          'Pooja Sharma',  '9431100003', '20ABCPM9012F1Z1',
     '14 Main Market, Dhanbad',                         'Jharkhand', 'Retailer',   v_user),
    ('Power Plus Traders',         'Ajay Singh',    '9431100004', NULL,
     'Near Bus Stand, Bokaro Steel City',               'Jharkhand', 'Retailer',   v_user),
    ('City Auto Parts',            'Deepak Verma',  '9431100005', '20ABCPC3456F1Z9',
     'Telco Road, Jamshedpur',                          'Jharkhand', 'Wholesaler', v_user),
    ('Elite Battery Store',        'Suman Devi',    '9431100006', NULL,
     'Bistupur Market, Jamshedpur',                     'Jharkhand', 'Retailer',   v_user),
    ('JSR Electric Co.',           'Ramesh Prasad', '9431100007', '20ABCPJ7890F1Z7',
     'Main Road, Chaibasa',                             'Jharkhand', 'Retailer',   v_user),
    ('Dhanbad Battery Hub',        'Kavita Gupta',  '9431100008', '20ABCPD2345F1Z6',
     'Coal Traders Lane, Dhanbad',                      'Jharkhand', 'Wholesaler', v_user)
  ON CONFLICT DO NOTHING;

  -- Fetch IDs (safe even if rows already existed)
  SELECT id INTO c_shri  FROM public.customers WHERE business_name = 'Shri Ganesh Battery Centre' AND created_by = v_user LIMIT 1;
  SELECT id INTO c_apex  FROM public.customers WHERE business_name = 'Apex Power Solutions'       AND created_by = v_user LIMIT 1;
  SELECT id INTO c_metro FROM public.customers WHERE business_name = 'Metro Electricals'           AND created_by = v_user LIMIT 1;
  SELECT id INTO c_power FROM public.customers WHERE business_name = 'Power Plus Traders'          AND created_by = v_user LIMIT 1;
  SELECT id INTO c_city  FROM public.customers WHERE business_name = 'City Auto Parts'             AND created_by = v_user LIMIT 1;
  SELECT id INTO c_elite FROM public.customers WHERE business_name = 'Elite Battery Store'         AND created_by = v_user LIMIT 1;
  SELECT id INTO c_jsr   FROM public.customers WHERE business_name = 'JSR Electric Co.'            AND created_by = v_user LIMIT 1;
  SELECT id INTO c_dhan  FROM public.customers WHERE business_name = 'Dhanbad Battery Hub'         AND created_by = v_user LIMIT 1;

  -- ============================================================
  -- 2. SALES ORDERS  (7 orders across all statuses)
  -- ============================================================
  INSERT INTO public.sales_orders
        (order_number, customer_id, customer_snapshot, items,
         subtotal, discount_total, taxable_value, tax_total, grand_total,
         status, order_date, notes, created_by)
  VALUES

  -- SO-01 · Apex · Confirmed (invoiced later)
  ('SO-BB-2026-001', c_apex,
   jsonb_build_object('id', c_apex, 'name', 'Suresh Mehta', 'company', 'Apex Power Solutions',
     'phone', '9431100002', 'gstin', '20ABCPA5678F1Z3',
     'address', 'Plot 45, Adityapur Industrial Area, Jamshedpur', 'state', 'Jharkhand'),
   '[{"productCode":"EXI-TUB-150","productName":"Exide 12V 150AH Tubular Battery","brand":"Exide","category":"Tubular",
      "quantity":10,"unit":"PCS","rate":10500,"discountPercent":5,"discountAmount":5250,
      "gstRate":28,"taxableValue":99750,"taxAmount":27930,"lineTotal":127680,"hsn":"8507"},
     {"productCode":"AMR-TUB-200","productName":"Amaron 12V 200AH Tall Tubular","brand":"Amaron","category":"Tubular",
      "quantity":5,"unit":"PCS","rate":16800,"discountPercent":4,"discountAmount":3360,
      "gstRate":28,"taxableValue":80640,"taxAmount":22579,"lineTotal":103219,"hsn":"8507"}]',
   189000, 8610, 180390, 50509, 230899, 'Confirmed', '2026-10-15',
   'Large wholesale order. Deliver in 2 batches.', v_user),

  -- SO-02 · Shri Ganesh · Draft
  ('SO-BB-2026-002', c_shri,
   jsonb_build_object('id', c_shri, 'name', 'Ravi Kumar', 'company', 'Shri Ganesh Battery Centre',
     'phone', '9431100001', 'gstin', '20ABCPG1234F1Z5',
     'address', 'Shop 12, Station Road, Jamshedpur', 'state', 'Jharkhand'),
   '[{"productCode":"EXI-VRLA-7","productName":"Exide 12V 7AH VRLA Battery","brand":"Exide","category":"VRLA",
      "quantity":20,"unit":"PCS","rate":1650,"discountPercent":3,"discountAmount":990,
      "gstRate":28,"taxableValue":32010,"taxAmount":8963,"lineTotal":40973,"hsn":"8507"},
     {"productCode":"LUM-FP-100","productName":"Luminous 12V 100AH Flat Plate","brand":"Luminous","category":"Flat Plate",
      "quantity":8,"unit":"PCS","rate":7200,"discountPercent":2,"discountAmount":1152,
      "gstRate":28,"taxableValue":56448,"taxAmount":15805,"lineTotal":72253,"hsn":"8507"}]',
   90600, 2142, 88458, 24768, 113226, 'Draft', '2026-11-01', NULL, v_user),

  -- SO-03 · Metro · Confirmed
  ('SO-BB-2026-003', c_metro,
   jsonb_build_object('id', c_metro, 'name', 'Pooja Sharma', 'company', 'Metro Electricals',
     'phone', '9431100003', 'gstin', '20ABCPM9012F1Z1',
     'address', '14 Main Market, Dhanbad', 'state', 'Jharkhand'),
   '[{"productCode":"AMR-AUTO-35","productName":"Amaron Go 35AH Car Battery","brand":"Amaron","category":"Automotive",
      "quantity":15,"unit":"PCS","rate":3800,"discountPercent":0,"discountAmount":0,
      "gstRate":28,"taxableValue":57000,"taxAmount":15960,"lineTotal":72960,"hsn":"8507"}]',
   57000, 0, 57000, 15960, 72960, 'Confirmed', '2026-10-28',
   'Dhanbad auto parts market order.', v_user),

  -- SO-04 · City Auto Parts · Delivered (invoiced + paid partially)
  ('SO-BB-2026-004', c_city,
   jsonb_build_object('id', c_city, 'name', 'Deepak Verma', 'company', 'City Auto Parts',
     'phone', '9431100005', 'gstin', '20ABCPC3456F1Z9',
     'address', 'Telco Road, Jamshedpur', 'state', 'Jharkhand'),
   '[{"productCode":"EXI-AUTO-35","productName":"Exide 12V 35AH Car Battery","brand":"Exide","category":"Automotive",
      "quantity":25,"unit":"PCS","rate":3200,"discountPercent":5,"discountAmount":4000,
      "gstRate":28,"taxableValue":76000,"taxAmount":21280,"lineTotal":97280,"hsn":"8507"}]',
   80000, 4000, 76000, 21280, 97280, 'Delivered', '2026-10-05', NULL, v_user),

  -- SO-05 · Elite · Cancelled
  ('SO-BB-2026-005', c_elite,
   jsonb_build_object('id', c_elite, 'name', 'Suman Devi', 'company', 'Elite Battery Store',
     'phone', '9431100006',
     'address', 'Bistupur Market, Jamshedpur', 'state', 'Jharkhand'),
   '[{"productCode":"LUM-TUB-150","productName":"Luminous 12V 150AH Tubular Battery","brand":"Luminous","category":"Tubular",
      "quantity":5,"unit":"PCS","rate":11500,"discountPercent":0,"discountAmount":0,
      "gstRate":28,"taxableValue":57500,"taxAmount":16100,"lineTotal":73600,"hsn":"8507"}]',
   57500, 0, 57500, 16100, 73600, 'Cancelled', '2026-09-20',
   'Customer cancelled — budget constraint.', v_user),

  -- SO-06 · JSR · Draft
  ('SO-BB-2026-006', c_jsr,
   jsonb_build_object('id', c_jsr, 'name', 'Ramesh Prasad', 'company', 'JSR Electric Co.',
     'phone', '9431100007', 'gstin', '20ABCPJ7890F1Z7',
     'address', 'Main Road, Chaibasa', 'state', 'Jharkhand'),
   '[{"productCode":"EXI-TUB-150","productName":"Exide 12V 150AH Tubular Battery","brand":"Exide","category":"Tubular",
      "quantity":6,"unit":"PCS","rate":10500,"discountPercent":3,"discountAmount":1890,
      "gstRate":28,"taxableValue":61110,"taxAmount":17111,"lineTotal":78221,"hsn":"8507"}]',
   63000, 1890, 61110, 17111, 78221, 'Draft', '2026-11-03', NULL, v_user),

  -- SO-07 · Dhanbad Battery Hub · Confirmed (large wholesale)
  ('SO-BB-2026-007', c_dhan,
   jsonb_build_object('id', c_dhan, 'name', 'Kavita Gupta', 'company', 'Dhanbad Battery Hub',
     'phone', '9431100008', 'gstin', '20ABCPD2345F1Z6',
     'address', 'Coal Traders Lane, Dhanbad', 'state', 'Jharkhand'),
   '[{"productCode":"AMR-TUB-150","productName":"Amaron 12V 150AH Tubular","brand":"Amaron","category":"Tubular",
      "quantity":12,"unit":"PCS","rate":12200,"discountPercent":4,"discountAmount":5856,
      "gstRate":28,"taxableValue":140544,"taxAmount":39352,"lineTotal":179896,"hsn":"8507"},
     {"productCode":"EXI-VRLA-7","productName":"Exide 12V 7AH VRLA Battery","brand":"Exide","category":"VRLA",
      "quantity":30,"unit":"PCS","rate":1650,"discountPercent":3,"discountAmount":1485,
      "gstRate":28,"taxableValue":47715,"taxAmount":13360,"lineTotal":61075,"hsn":"8507"}]',
   201960, 7341, 194619, 52712, 247331, 'Confirmed', '2026-10-25',
   'Wholesale order. COD terms agreed.', v_user)

  ON CONFLICT DO NOTHING;

  SELECT id INTO o1 FROM public.sales_orders WHERE order_number = 'SO-BB-2026-001';
  SELECT id INTO o2 FROM public.sales_orders WHERE order_number = 'SO-BB-2026-002';
  SELECT id INTO o3 FROM public.sales_orders WHERE order_number = 'SO-BB-2026-003';
  SELECT id INTO o4 FROM public.sales_orders WHERE order_number = 'SO-BB-2026-004';
  SELECT id INTO o7 FROM public.sales_orders WHERE order_number = 'SO-BB-2026-007';

  -- ============================================================
  -- 3. SALES INVOICES  (7 invoices across all statuses)
  -- ============================================================
  INSERT INTO public.sales_invoices
        (invoice_number, sales_order_id, customer_id, customer_snapshot, supplier_snapshot,
         items, invoice_date, due_date,
         subtotal, discount_total, taxable_value, tax_total, round_off, grand_total,
         status, notes, created_by)
  VALUES

  -- INV-01 · Apex · Paid in full
  ('INV-BB-2026-001', o1, c_apex,
   jsonb_build_object('id', c_apex, 'name', 'Suresh Mehta', 'company', 'Apex Power Solutions',
     'phone', '9431100002', 'gstin', '20ABCPA5678F1Z3',
     'address', 'Plot 45, Adityapur Industrial Area, Jamshedpur', 'state', 'Jharkhand'),
   '{}',
   '[{"productCode":"EXI-TUB-150","productName":"Exide 12V 150AH Tubular Battery","brand":"Exide","category":"Tubular",
      "quantity":10,"unit":"PCS","rate":10500,"discountPercent":5,"discountAmount":5250,
      "gstRate":28,"taxableValue":99750,"taxAmount":27930,"lineTotal":127680,"hsn":"8507"}]',
   '2026-10-16', '2026-11-15',
   105000, 5250, 99750, 27930, 0, 127680,
   'Paid', 'First batch — Exide tubular batteries.', v_user),

  -- INV-02 · Metro · Issued (payment due end of month)
  ('INV-BB-2026-002', o3, c_metro,
   jsonb_build_object('id', c_metro, 'name', 'Pooja Sharma', 'company', 'Metro Electricals',
     'phone', '9431100003', 'gstin', '20ABCPM9012F1Z1',
     'address', '14 Main Market, Dhanbad', 'state', 'Jharkhand'),
   '{}',
   '[{"productCode":"AMR-AUTO-35","productName":"Amaron Go 35AH Car Battery","brand":"Amaron","category":"Automotive",
      "quantity":15,"unit":"PCS","rate":3800,"discountPercent":0,"discountAmount":0,
      "gstRate":28,"taxableValue":57000,"taxAmount":15960,"lineTotal":72960,"hsn":"8507"}]',
   '2026-10-29', '2026-11-28',
   57000, 0, 57000, 15960, 0, 72960,
   'Issued', NULL, v_user),

  -- INV-03 · Power Plus Traders · OVERDUE (due date past today)
  ('INV-BB-2026-003', NULL, c_power,
   jsonb_build_object('id', c_power, 'name', 'Ajay Singh', 'company', 'Power Plus Traders',
     'phone', '9431100004',
     'address', 'Near Bus Stand, Bokaro Steel City', 'state', 'Jharkhand'),
   '{}',
   '[{"productCode":"EXI-VRLA-7","productName":"Exide 12V 7AH VRLA Battery","brand":"Exide","category":"VRLA",
      "quantity":20,"unit":"PCS","rate":1650,"discountPercent":3,"discountAmount":990,
      "gstRate":28,"taxableValue":32010,"taxAmount":8963,"lineTotal":40973,"hsn":"8507"}]',
   '2026-09-10', '2026-10-10',
   33000, 990, 32010, 8963, 0, 40973,
   'Overdue', 'Payment pending — follow up urgently.', v_user),

  -- INV-04 · City Auto Parts · Partially Paid
  ('INV-BB-2026-004', o4, c_city,
   jsonb_build_object('id', c_city, 'name', 'Deepak Verma', 'company', 'City Auto Parts',
     'phone', '9431100005', 'gstin', '20ABCPC3456F1Z9',
     'address', 'Telco Road, Jamshedpur', 'state', 'Jharkhand'),
   '{}',
   '[{"productCode":"EXI-AUTO-35","productName":"Exide 12V 35AH Car Battery","brand":"Exide","category":"Automotive",
      "quantity":25,"unit":"PCS","rate":3200,"discountPercent":5,"discountAmount":4000,
      "gstRate":28,"taxableValue":76000,"taxAmount":21280,"lineTotal":97280,"hsn":"8507"}]',
   '2026-10-06', '2026-11-05',
   80000, 4000, 76000, 21280, 0, 97280,
   'Partially Paid', NULL, v_user),

  -- INV-05 · Shri Ganesh · Draft
  ('INV-BB-2026-005', NULL, c_shri,
   jsonb_build_object('id', c_shri, 'name', 'Ravi Kumar', 'company', 'Shri Ganesh Battery Centre',
     'phone', '9431100001', 'gstin', '20ABCPG1234F1Z5',
     'address', 'Shop 12, Station Road, Jamshedpur', 'state', 'Jharkhand'),
   '{}',
   '[{"productCode":"LUM-FP-100","productName":"Luminous 12V 100AH Flat Plate","brand":"Luminous","category":"Flat Plate",
      "quantity":8,"unit":"PCS","rate":7200,"discountPercent":2,"discountAmount":1152,
      "gstRate":28,"taxableValue":56448,"taxAmount":15805,"lineTotal":72253,"hsn":"8507"}]',
   '2026-11-01', '2026-11-30',
   57600, 1152, 56448, 15805, 0, 72253,
   'Draft', NULL, v_user),

  -- INV-06 · JSR Electric · Paid (small order)
  ('INV-BB-2026-006', NULL, c_jsr,
   jsonb_build_object('id', c_jsr, 'name', 'Ramesh Prasad', 'company', 'JSR Electric Co.',
     'phone', '9431100007', 'gstin', '20ABCPJ7890F1Z7',
     'address', 'Main Road, Chaibasa', 'state', 'Jharkhand'),
   '{}',
   '[{"productCode":"AMR-AUTO-35","productName":"Amaron Go 35AH Car Battery","brand":"Amaron","category":"Automotive",
      "quantity":8,"unit":"PCS","rate":3800,"discountPercent":0,"discountAmount":0,
      "gstRate":28,"taxableValue":30400,"taxAmount":8512,"lineTotal":38912,"hsn":"8507"}]',
   '2026-10-20', '2026-11-19',
   30400, 0, 30400, 8512, 0, 38912,
   'Paid', NULL, v_user),

  -- INV-07 · Dhanbad Battery Hub · Issued (large; net-30)
  ('INV-BB-2026-007', o7, c_dhan,
   jsonb_build_object('id', c_dhan, 'name', 'Kavita Gupta', 'company', 'Dhanbad Battery Hub',
     'phone', '9431100008', 'gstin', '20ABCPD2345F1Z6',
     'address', 'Coal Traders Lane, Dhanbad', 'state', 'Jharkhand'),
   '{}',
   '[{"productCode":"AMR-TUB-150","productName":"Amaron 12V 150AH Tubular","brand":"Amaron","category":"Tubular",
      "quantity":12,"unit":"PCS","rate":12200,"discountPercent":4,"discountAmount":5856,
      "gstRate":28,"taxableValue":140544,"taxAmount":39352,"lineTotal":179896,"hsn":"8507"}]',
   '2026-10-26', '2026-11-25',
   146400, 5856, 140544, 39352, 0, 179896,
   'Issued', 'Net-30 terms. 50% advance agreed verbally.', v_user)

  ON CONFLICT DO NOTHING;

  SELECT id INTO i1 FROM public.sales_invoices WHERE invoice_number = 'INV-BB-2026-001';
  SELECT id INTO i2 FROM public.sales_invoices WHERE invoice_number = 'INV-BB-2026-002';
  SELECT id INTO i3 FROM public.sales_invoices WHERE invoice_number = 'INV-BB-2026-003';
  SELECT id INTO i4 FROM public.sales_invoices WHERE invoice_number = 'INV-BB-2026-004';
  SELECT id INTO i6 FROM public.sales_invoices WHERE invoice_number = 'INV-BB-2026-006';

  -- ============================================================
  -- 4. CUSTOMER PAYMENTS  (4 receipts)
  -- ============================================================
  INSERT INTO public.customer_payments
        (receipt_number, customer_id, invoice_id, payment_date,
         amount, payment_method, reference_number, notes, status, created_by)
  VALUES
    -- Full payment for Apex INV-01
    ('RCP-BB-2026-001', c_apex, i1, '2026-10-30',
     127680, 'Bank Transfer', 'NEFT-20261030-APX',
     'Full payment received for Exide tubular batch.', 'Received', v_user),

    -- Partial advance for City Auto Parts INV-04
    ('RCP-BB-2026-002', c_city, i4, '2026-10-15',
     50000, 'Cheque', 'CHQ-CITY-00245',
     'Advance cheque — balance ₹47,280 pending.', 'Received', v_user),

    -- Full payment for JSR INV-06 via UPI
    ('RCP-BB-2026-003', c_jsr, i6, '2026-10-25',
     38912, 'UPI', 'UPI-JSR-20261025-01',
     NULL, 'Received', v_user),

    -- Small advance cash from Metro toward INV-02
    ('RCP-BB-2026-004', c_metro, i2, '2026-11-02',
     20000, 'Cash', NULL,
     'Cash advance against Dhanbad car battery order.', 'Received', v_user)

  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 5. DELIVERY CHALLANS  (4 challans)
  -- ============================================================
  INSERT INTO public.delivery_challans
        (challan_number, sales_order_id, customer_id, customer_snapshot,
         items, challan_date, status, notes, created_by)
  VALUES

  -- DC-01 · Apex · Delivered (batch 1)
  ('DC-BB-2026-001', o1, c_apex,
   jsonb_build_object('id', c_apex, 'name', 'Suresh Mehta', 'company', 'Apex Power Solutions',
     'phone', '9431100002', 'address', 'Plot 45, Adityapur Industrial Area, Jamshedpur', 'state', 'Jharkhand'),
   '[{"productCode":"EXI-TUB-150","productName":"Exide 12V 150AH Tubular Battery","quantity":10,"unit":"PCS"}]',
   '2026-10-16', 'Delivered', 'Batch 1 of 2. Received by warehouse manager.', v_user),

  -- DC-02 · Metro · Dispatched
  ('DC-BB-2026-002', o3, c_metro,
   jsonb_build_object('id', c_metro, 'name', 'Pooja Sharma', 'company', 'Metro Electricals',
     'phone', '9431100003', 'address', '14 Main Market, Dhanbad', 'state', 'Jharkhand'),
   '[{"productCode":"AMR-AUTO-35","productName":"Amaron Go 35AH Car Battery","quantity":15,"unit":"PCS"}]',
   '2026-10-29', 'Dispatched', 'Dispatched via Delhivery. AWB: DLV-29OCT-00812.', v_user),

  -- DC-03 · City Auto Parts · Delivered
  ('DC-BB-2026-003', o4, c_city,
   jsonb_build_object('id', c_city, 'name', 'Deepak Verma', 'company', 'City Auto Parts',
     'phone', '9431100005', 'address', 'Telco Road, Jamshedpur', 'state', 'Jharkhand'),
   '[{"productCode":"EXI-AUTO-35","productName":"Exide 12V 35AH Car Battery","quantity":25,"unit":"PCS"}]',
   '2026-10-07', 'Delivered', 'Hand delivered to Telco Road shop. Signed by owner.', v_user),

  -- DC-04 · Shri Ganesh · Draft (pending invoice approval)
  ('DC-BB-2026-004', NULL, c_shri,
   jsonb_build_object('id', c_shri, 'name', 'Ravi Kumar', 'company', 'Shri Ganesh Battery Centre',
     'phone', '9431100001', 'address', 'Shop 12, Station Road, Jamshedpur', 'state', 'Jharkhand'),
   '[{"productCode":"EXI-VRLA-7","productName":"Exide 12V 7AH VRLA Battery","quantity":20,"unit":"PCS"}]',
   '2026-11-01', 'Draft', 'Scheduled for dispatch after invoice sign-off.', v_user)

  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 6. CREDIT NOTES  (3 credits)
  -- ============================================================
  INSERT INTO public.credit_notes
        (credit_note_number, invoice_id, customer_id, customer_snapshot,
         items, credit_date, amount, reason, status, created_by)
  VALUES

  -- CN-01 · Apex · Issued — 1 defective battery returned
  ('CN-BB-2026-001', i1, c_apex,
   jsonb_build_object('id', c_apex, 'name', 'Suresh Mehta', 'company', 'Apex Power Solutions',
     'phone', '9431100002', 'gstin', '20ABCPA5678F1Z3',
     'address', 'Plot 45, Adityapur Industrial Area, Jamshedpur', 'state', 'Jharkhand'),
   '[{"productCode":"EXI-TUB-150","productName":"Exide 12V 150AH Tubular Battery","quantity":1,"unit":"PCS","rate":10500}]',
   '2026-10-31', 10500,
   '1 battery returned — manufacturing defect discovered on installation.',
   'Issued', v_user),

  -- CN-02 · City Auto Parts · Draft — price correction
  ('CN-BB-2026-002', i4, c_city,
   jsonb_build_object('id', c_city, 'name', 'Deepak Verma', 'company', 'City Auto Parts',
     'phone', '9431100005', 'gstin', '20ABCPC3456F1Z9',
     'address', 'Telco Road, Jamshedpur', 'state', 'Jharkhand'),
   '[]',
   '2026-10-20', 3200,
   'Price correction — 1 unit overcharged at ₹3,200 above agreed rate.',
   'Draft', v_user),

  -- CN-03 · Metro · Issued — transit damage
  ('CN-BB-2026-003', i2, c_metro,
   jsonb_build_object('id', c_metro, 'name', 'Pooja Sharma', 'company', 'Metro Electricals',
     'phone', '9431100003', 'gstin', '20ABCPM9012F1Z1',
     'address', '14 Main Market, Dhanbad', 'state', 'Jharkhand'),
   '[{"productCode":"AMR-AUTO-35","productName":"Amaron Go 35AH Car Battery","quantity":2,"unit":"PCS","rate":3800}]',
   '2026-11-03', 7600,
   '2 batteries damaged in transit. Claim approved after inspection.',
   'Issued', v_user)

  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✓ Seed complete — 8 customers, 7 orders, 7 invoices, 4 payments, 4 challans, 3 credit notes.';
END $$;
