-- Additive Sales workflow migration. Safe to apply after 005_sales_documents.
CREATE TABLE IF NOT EXISTS public.recurring_invoices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  template_number TEXT NOT NULL UNIQUE,
  customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_snapshot JSONB NOT NULL,
  supplier_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  items JSONB NOT NULL CHECK (jsonb_typeof(items)='array' AND jsonb_array_length(items)>0),
  frequency TEXT NOT NULL CHECK (frequency IN ('Weekly','Monthly','Quarterly','Yearly')),
  next_run_date DATE NOT NULL,
  end_date DATE,
  due_days INTEGER NOT NULL DEFAULT 30 CHECK (due_days BETWEEN 0 AND 365),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date IS NULL OR end_date >= next_run_date)
);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_due ON public.recurring_invoices(active,next_run_date);

CREATE TABLE IF NOT EXISTS public.sales_document_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_type TEXT NOT NULL CHECK (document_type IN ('Order','Invoice','Payment','Delivery Challan','Credit Note','Recurring Invoice')),
  document_id BIGINT NOT NULL,
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  actor_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sales_document_audit_lookup ON public.sales_document_audit(document_type,document_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_id BIGINT NOT NULL REFERENCES public.customer_payments(id) ON DELETE RESTRICT,
  invoice_id BIGINT NOT NULL REFERENCES public.sales_invoices(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(payment_id,invoice_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice ON public.payment_allocations(invoice_id);

-- Backfill legacy single-invoice payment links into allocation rows.
INSERT INTO public.payment_allocations(payment_id,invoice_id,amount)
SELECT cp.id, cp.invoice_id, cp.amount
FROM public.customer_payments cp
WHERE cp.invoice_id IS NOT NULL AND cp.status='Received'
ON CONFLICT(payment_id,invoice_id) DO NOTHING;
