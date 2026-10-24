-- Sales module foundation. Existing quotation/customer tables remain unchanged.
-- Monetary values are NUMERIC; document snapshots preserve historical customer/item details.

CREATE TABLE IF NOT EXISTS public.sales_orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  quotation_id BIGINT REFERENCES public.quotations(id) ON DELETE SET NULL,
  customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_snapshot JSONB NOT NULL,
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  taxable_value NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (taxable_value >= 0),
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  grand_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Confirmed','Partially Delivered','Delivered','Cancelled')),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_date ON public.sales_orders(customer_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_orders_creator_date ON public.sales_orders(created_by, created_at DESC);

CREATE TABLE IF NOT EXISTS public.delivery_challans (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  challan_number TEXT NOT NULL UNIQUE,
  sales_order_id BIGINT REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_snapshot JSONB NOT NULL,
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0),
  challan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Dispatched','Delivered','Cancelled')),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_customer_date ON public.delivery_challans(customer_id, challan_date DESC);

CREATE TABLE IF NOT EXISTS public.sales_invoices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  sales_order_id BIGINT REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_snapshot JSONB NOT NULL,
  supplier_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0),
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  taxable_value NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (taxable_value >= 0),
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  round_off NUMERIC(12,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Issued','Partially Paid','Paid','Overdue','Void')),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (due_date IS NULL OR due_date >= invoice_date)
);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer_date ON public.sales_invoices(customer_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_status_due ON public.sales_invoices(status, due_date);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_creator_date ON public.sales_invoices(created_by, created_at DESC);

CREATE TABLE IF NOT EXISTS public.customer_payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id),
  invoice_id BIGINT REFERENCES public.sales_invoices(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash','UPI','Bank Transfer','Cheque','Card','Other')),
  reference_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Received' CHECK (status IN ('Received','Reversed')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_date ON public.customer_payments(customer_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_customer_payments_invoice ON public.customer_payments(invoice_id);

CREATE TABLE IF NOT EXISTS public.credit_notes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  credit_note_number TEXT NOT NULL UNIQUE,
  invoice_id BIGINT REFERENCES public.sales_invoices(id) ON DELETE SET NULL,
  customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_snapshot JSONB NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  credit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Issued','Applied','Void')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_credit_notes_customer_date ON public.credit_notes(customer_id, credit_date DESC);
