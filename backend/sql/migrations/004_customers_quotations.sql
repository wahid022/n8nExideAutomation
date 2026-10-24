CREATE TABLE IF NOT EXISTS public.customers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  gstin TEXT,
  billing_address TEXT,
  state TEXT,
  customer_type TEXT NOT NULL DEFAULT 'Retailer' CHECK (customer_type IN ('Retailer', 'Wholesaler', 'Other')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_search ON public.customers (lower(business_name), phone);
CREATE INDEX IF NOT EXISTS idx_customers_gstin ON public.customers (gstin) WHERE gstin IS NOT NULL AND gstin <> '';

CREATE TABLE IF NOT EXISTS public.quotations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quotation_number TEXT NOT NULL UNIQUE,
  customer_id BIGINT REFERENCES public.customers(id),
  customer_snapshot JSONB NOT NULL,
  supplier_snapshot JSONB NOT NULL,
  items JSONB NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  taxable_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  round_off NUMERIC(12,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Generated', 'Accepted', 'Rejected', 'Expired', 'Converted')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quotations_customer_created ON public.quotations (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotations_creator_created ON public.quotations (created_by, created_at DESC);
