-- =============================================================
-- Bharat Batteries — Purchase Module Seed Script
-- Run in Supabase SQL Editor to populate vendors, purchase
-- orders, purchase invoices, and debit notes.
-- =============================================================

DO $$
DECLARE
  v_user UUID;

  -- vendor IDs
  vn_exide  BIGINT; vn_amaron BIGINT; vn_lum    BIGINT;
  vn_sukam  BIGINT; vn_okaya  BIGINT;

  -- purchase order IDs
  po1 BIGINT; po2 BIGINT; po3 BIGINT; po4 BIGINT;

  -- purchase invoice IDs
  pi1 BIGINT; pi2 BIGINT; pi3 BIGINT;

BEGIN

  -- ── Resolve logged-in user UUID ────────────────────────────
  SELECT created_by INTO v_user
  FROM   public.customers
  ORDER  BY created_at
  LIMIT  1;

  IF v_user IS NULL THEN
    -- Fallback: try from vendors table
    SELECT created_by INTO v_user
    FROM   public.vendors
    ORDER  BY created_at
    LIMIT  1;
  END IF;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Could not detect user UUID. Make sure you have run the sales seed first or added at least one customer.';
  END IF;

  RAISE NOTICE 'Seeding purchase data for user %', v_user;

  -- ============================================================
  -- 1. VENDORS  (5 battery manufacturers / distributors)
  -- ============================================================
  INSERT INTO public.vendors
        (business_name, contact_name, phone, gstin, billing_address, state, vendor_type, created_by)
  VALUES
    ('Exide Industries Ltd',         'Prakash Jain',   '9811200001', '19AAACE4347H1Z5',
     'Exide House, 59E Chowringhee Road, Kolkata',    'West Bengal',     'Manufacturer',  v_user),
    ('Amaron (Amara Raja Batteries)',  'Srikanth Reddy', '9811200002', '37AAAAA0000A1Z3',
     'Amara Raja Industrial Park, Tirupati',          'Andhra Pradesh',  'Manufacturer',  v_user),
    ('Luminous Power Technologies',   'Ajay Khanna',   '9811200003', '06AACCL6540G1ZL',
     'D-156, Phase III, Noida Industrial Area',       'Uttar Pradesh',   'Manufacturer',  v_user),
    ('Su-Kam Power Systems',          'Deepak Vohra',  '9811200004', '06AACCS7261K1Z9',
     'Plot 34, Sector 37, Gurugram',                  'Haryana',         'Distributor',   v_user),
    ('Okaya Power Pvt Ltd',           'Ramesh Gupta',  '9811200005', '07AAACO1234P1ZK',
     'Okaya House, Mayur Vihar Phase I, Delhi',       'Delhi',           'Distributor',   v_user)
  ON CONFLICT DO NOTHING;

  SELECT id INTO vn_exide  FROM public.vendors WHERE business_name = 'Exide Industries Ltd'          AND created_by = v_user LIMIT 1;
  SELECT id INTO vn_amaron FROM public.vendors WHERE business_name = 'Amaron (Amara Raja Batteries)' AND created_by = v_user LIMIT 1;
  SELECT id INTO vn_lum    FROM public.vendors WHERE business_name = 'Luminous Power Technologies'   AND created_by = v_user LIMIT 1;
  SELECT id INTO vn_sukam  FROM public.vendors WHERE business_name = 'Su-Kam Power Systems'          AND created_by = v_user LIMIT 1;
  SELECT id INTO vn_okaya  FROM public.vendors WHERE business_name = 'Okaya Power Pvt Ltd'           AND created_by = v_user LIMIT 1;

  -- ============================================================
  -- 2. PURCHASE ORDERS  (4 orders across all statuses)
  -- ============================================================
  INSERT INTO public.purchase_orders
        (order_number, vendor_id, vendor_snapshot, items,
         subtotal, discount_total, taxable_value, tax_total, grand_total,
         status, order_date, expected_delivery, notes, created_by)
  VALUES

  -- PO-01 · Exide · Received (stock replenishment)
  ('PO-BB-2026-001', vn_exide,
   jsonb_build_object('id', vn_exide, 'businessName', 'Exide Industries Ltd',
     'contactName', 'Prakash Jain', 'phone', '9811200001', 'gstin', '19AAACE4347H1Z5',
     'billingAddress', 'Exide House, 59E Chowringhee Road, Kolkata', 'state', 'West Bengal'),
   '[{"productCode":"EXI-TUB-150","productName":"Exide 12V 150AH Tubular Battery","quantity":20,"unit":"PCS","unitPrice":8200,"discountPercent":8,"taxPercent":28,"lineTotal":151040},
     {"productCode":"EXI-VRLA-7","productName":"Exide 12V 7AH VRLA Battery","quantity":50,"unit":"PCS","unitPrice":1180,"discountPercent":5,"taxPercent":28,"lineTotal":71060}]',
   222800, 17760, 205040, 57411, 262451,
   'Received', '2026-10-01', '2026-10-10',
   'Monthly stock replenishment from Exide. 2% extra discount negotiated.', v_user),

  -- PO-02 · Amaron · Confirmed (awaiting delivery)
  ('PO-BB-2026-002', vn_amaron,
   jsonb_build_object('id', vn_amaron, 'businessName', 'Amaron (Amara Raja Batteries)',
     'contactName', 'Srikanth Reddy', 'phone', '9811200002', 'gstin', '37AAAAA0000A1Z3',
     'billingAddress', 'Amara Raja Industrial Park, Tirupati', 'state', 'Andhra Pradesh'),
   '[{"productCode":"AMR-TUB-150","productName":"Amaron 12V 150AH Tubular","quantity":15,"unit":"PCS","unitPrice":9500,"discountPercent":5,"taxPercent":28,"lineTotal":136800},
     {"productCode":"AMR-AUTO-35","productName":"Amaron Go 35AH Car Battery","quantity":30,"unit":"PCS","unitPrice":2900,"discountPercent":4,"taxPercent":28,"lineTotal":106560}]',
   216500, 10725, 205775, 57617, 263392,
   'Confirmed', '2026-10-20', '2026-11-10',
   'Advance payment sent. Confirm delivery schedule.', v_user),

  -- PO-03 · Luminous · Sent (waiting confirmation)
  ('PO-BB-2026-003', vn_lum,
   jsonb_build_object('id', vn_lum, 'businessName', 'Luminous Power Technologies',
     'contactName', 'Ajay Khanna', 'phone', '9811200003', 'gstin', '06AACCL6540G1ZL',
     'billingAddress', 'D-156, Phase III, Noida Industrial Area', 'state', 'Uttar Pradesh'),
   '[{"productCode":"LUM-TUB-150","productName":"Luminous 12V 150AH Tubular Battery","quantity":10,"unit":"PCS","unitPrice":8900,"discountPercent":5,"taxPercent":28,"lineTotal":108136},
     {"productCode":"LUM-FP-100","productName":"Luminous 12V 100AH Flat Plate","quantity":15,"unit":"PCS","unitPrice":5300,"discountPercent":3,"taxPercent":28,"lineTotal":98496}]',
   168500, 8425, 160075, 44821, 204896,
   'Sent', '2026-11-01', '2026-11-20',
   'Waiting for Luminous to confirm price list for FY2026-27.', v_user),

  -- PO-04 · Okaya · Draft
  ('PO-BB-2026-004', vn_okaya,
   jsonb_build_object('id', vn_okaya, 'businessName', 'Okaya Power Pvt Ltd',
     'contactName', 'Ramesh Gupta', 'phone', '9811200005', 'gstin', '07AAACO1234P1ZK',
     'billingAddress', 'Okaya House, Mayur Vihar Phase I, Delhi', 'state', 'Delhi'),
   '[{"productCode":"OKY-TUB-200","productName":"Okaya 12V 200AH Tubular Battery","quantity":8,"unit":"PCS","unitPrice":12500,"discountPercent":6,"taxPercent":28,"lineTotal":119168}]',
   100000, 6000, 94000, 26320, 120320,
   'Draft', '2026-11-03', NULL,
   'Exploring Okaya as an alternate supplier. Draft for review.', v_user)

  ON CONFLICT DO NOTHING;

  SELECT id INTO po1 FROM public.purchase_orders WHERE order_number = 'PO-BB-2026-001';
  SELECT id INTO po2 FROM public.purchase_orders WHERE order_number = 'PO-BB-2026-002';
  SELECT id INTO po3 FROM public.purchase_orders WHERE order_number = 'PO-BB-2026-003';
  SELECT id INTO po4 FROM public.purchase_orders WHERE order_number = 'PO-BB-2026-004';

  -- ============================================================
  -- 3. PURCHASE INVOICES  (3 invoices)
  -- ============================================================
  INSERT INTO public.purchase_invoices
        (invoice_number, purchase_order_id, vendor_id, vendor_snapshot, items,
         invoice_date, due_date,
         subtotal, discount_total, taxable_value, tax_total, round_off, grand_total,
         status, notes, created_by)
  VALUES

  -- PINV-01 · Exide · Paid (matches PO-01)
  ('PINV-BB-2026-001', po1, vn_exide,
   jsonb_build_object('id', vn_exide, 'businessName', 'Exide Industries Ltd',
     'contactName', 'Prakash Jain', 'phone', '9811200001', 'gstin', '19AAACE4347H1Z5',
     'billingAddress', 'Exide House, 59E Chowringhee Road, Kolkata', 'state', 'West Bengal'),
   '[{"productCode":"EXI-TUB-150","productName":"Exide 12V 150AH Tubular Battery","quantity":20,"unit":"PCS","unitPrice":8200,"discountPercent":8,"taxPercent":28,"lineTotal":151040},
     {"productCode":"EXI-VRLA-7","productName":"Exide 12V 7AH VRLA Battery","quantity":50,"unit":"PCS","unitPrice":1180,"discountPercent":5,"taxPercent":28,"lineTotal":71060}]',
   '2026-10-11', '2026-11-10',
   222800, 17760, 205040, 57411, 0, 262451,
   'Paid', 'Paid via NEFT on 2026-10-28. TXN: NEFT-EXI-20261028.', v_user),

  -- PINV-02 · Amaron · Overdue
  ('PINV-BB-2026-002', NULL, vn_amaron,
   jsonb_build_object('id', vn_amaron, 'businessName', 'Amaron (Amara Raja Batteries)',
     'contactName', 'Srikanth Reddy', 'phone', '9811200002', 'gstin', '37AAAAA0000A1Z3',
     'billingAddress', 'Amara Raja Industrial Park, Tirupati', 'state', 'Andhra Pradesh'),
   '[{"productCode":"AMR-AUTO-35","productName":"Amaron Go 35AH Car Battery","quantity":20,"unit":"PCS","unitPrice":2900,"discountPercent":4,"taxPercent":28,"lineTotal":71040}]',
   '2026-09-15', '2026-10-15',
   58000, 2320, 55680, 15590, 0, 71270,
   'Overdue', 'Payment due crossed — follow up with accounts team.', v_user),

  -- PINV-03 · Luminous · Draft
  ('PINV-BB-2026-003', po3, vn_lum,
   jsonb_build_object('id', vn_lum, 'businessName', 'Luminous Power Technologies',
     'contactName', 'Ajay Khanna', 'phone', '9811200003', 'gstin', '06AACCL6540G1ZL',
     'billingAddress', 'D-156, Phase III, Noida Industrial Area', 'state', 'Uttar Pradesh'),
   '[{"productCode":"LUM-TUB-150","productName":"Luminous 12V 150AH Tubular Battery","quantity":10,"unit":"PCS","unitPrice":8900,"discountPercent":5,"taxPercent":28,"lineTotal":108136}]',
   '2026-11-02', '2026-12-02',
   89000, 4450, 84550, 23674, 0, 108224,
   'Draft', 'Draft pending GRN confirmation.', v_user)

  ON CONFLICT DO NOTHING;

  SELECT id INTO pi1 FROM public.purchase_invoices WHERE invoice_number = 'PINV-BB-2026-001';
  SELECT id INTO pi2 FROM public.purchase_invoices WHERE invoice_number = 'PINV-BB-2026-002';
  SELECT id INTO pi3 FROM public.purchase_invoices WHERE invoice_number = 'PINV-BB-2026-003';

  -- ============================================================
  -- 4. DEBIT NOTES  (3 debit notes)
  -- ============================================================
  INSERT INTO public.debit_notes
        (debit_note_number, purchase_invoice_id, vendor_id, vendor_snapshot,
         debit_date, amount, reason, status, created_by)
  VALUES

  -- DN-01 · Exide · Issued — short delivery
  ('DN-BB-2026-001', pi1, vn_exide,
   jsonb_build_object('id', vn_exide, 'businessName', 'Exide Industries Ltd',
     'contactName', 'Prakash Jain', 'phone', '9811200001', 'gstin', '19AAACE4347H1Z5',
     'billingAddress', 'Exide House, 59E Chowringhee Road, Kolkata', 'state', 'West Bengal'),
   '2026-10-14', 8200,
   '1 unit of Exide 150AH Tubular Battery short-delivered against PO-BB-2026-001. Debit raised for ₹8,200.',
   'Issued', v_user),

  -- DN-02 · Amaron · Draft — quality rejection
  ('DN-BB-2026-002', pi2, vn_amaron,
   jsonb_build_object('id', vn_amaron, 'businessName', 'Amaron (Amara Raja Batteries)',
     'contactName', 'Srikanth Reddy', 'phone', '9811200002', 'gstin', '37AAAAA0000A1Z3',
     'billingAddress', 'Amara Raja Industrial Park, Tirupati', 'state', 'Andhra Pradesh'),
   '2026-10-20', 5800,
   '2 Amaron Go 35AH batteries rejected on inspection (swollen plates). Return in progress.',
   'Draft', v_user),

  -- DN-03 · Luminous · Issued — price difference
  ('DN-BB-2026-003', NULL, vn_lum,
   jsonb_build_object('id', vn_lum, 'businessName', 'Luminous Power Technologies',
     'contactName', 'Ajay Khanna', 'phone', '9811200003', 'gstin', '06AACCL6540G1ZL',
     'billingAddress', 'D-156, Phase III, Noida Industrial Area', 'state', 'Uttar Pradesh'),
   '2026-10-30', 4450,
   'Invoice price (₹8,900/unit) exceeded agreed PO rate (₹8,455/unit) for LUM-TUB-150. Debit for excess billed.',
   'Issued', v_user)

  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✓ Purchase seed complete — 5 vendors, 4 purchase orders, 3 purchase invoices, 3 debit notes.';
END $$;
