-- Expenses module: user-defined categories + expense entries

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  type        TEXT NOT NULL DEFAULT 'Indirect' CHECK (type IN ('Direct', 'Indirect')),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  created_by  UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expense_categories_user ON public.expense_categories(created_by, name);

CREATE TABLE IF NOT EXISTS public.expense_entries (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id  BIGINT NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
  amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_mode IN ('Cash','Bank','UPI','Card','Cheque','Other')),
  reference_no TEXT CHECK (reference_no IS NULL OR char_length(reference_no) <= 100),
  notes        TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_by   UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expense_entries_date     ON public.expense_entries(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_entries_category ON public.expense_entries(category_id);
CREATE INDEX IF NOT EXISTS idx_expense_entries_user     ON public.expense_entries(created_by, expense_date DESC);
