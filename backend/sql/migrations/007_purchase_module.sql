-- Purchase module: vendors, purchase orders, purchase invoices, debit notes

CREATE TABLE IF NOT EXISTS public.vendors (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_name TEXT NOT NULL CHECK (char_length(business_name) BETWEEN 1 AND 200),
  contact_name TEXT NOT NULL CHECK (char_length(contact_name) BETWEEN 1 AND 200),
  phone TEXT NOT NULL CHECK (char_length(phone) BETWEEN 1 AND 40),
  gstin TEXT CHECK (gstin IS NULL OR gstin ~ '^[0-9A-Z]{15}$'),
  billing_address TEXT CHECK (billing_address IS NULL OR char_length(billing_address) <= 1000),
  state TEXT CHECK (state IS NULL OR char_length(state) <= 100),
  vendor_type TEXT NOT NULL DEFAULT 'Supplier' CHECK (vendor_type IN ('Manufacturer','Distributor','Supplier','Other')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vendors_name ON public.vendors(business_name);
CREATE INDEX IF NOT EXISTS idx_vendors_phone ON public.vendors(phone);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  vendor_id BIGINT REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_snapshot JSONB NOT NULL,
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  taxable_value NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (taxable_value >= 0),
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  grand_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Sent','Confirmed','Partially Received','Received','Cancelled')),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_date ON public.purchase_orders(vendor_id, order_date DESC);

CREATE TABLE IF NOT EXISTS public.purchase_invoices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  purchase_order_id BIGINT REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  vendor_id BIGINT REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_snapshot JSONB NOT NULL,
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0),
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  taxable_value NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (taxable_value >= 0),
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  round_off NUMERIC(12,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Received','Partially Paid','Paid','Overdue','Void')),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_vendor_date ON public.purchase_invoices(vendor_id, invoice_date DESC);

CREATE TABLE IF NOT EXISTS public.debit_notes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  debit_note_number TEXT NOT NULL UNIQUE,
  purchase_invoice_id BIGINT REFERENCES public.purchase_invoices(id) ON DELETE SET NULL,
  vendor_id BIGINT REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_snapshot JSONB NOT NULL,
  debit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 2000),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Issued','Applied','Void')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_debit_notes_vendor_date ON public.debit_notes(vendor_id, debit_date DESC);
