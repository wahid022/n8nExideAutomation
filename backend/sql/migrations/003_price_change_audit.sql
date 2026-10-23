CREATE TABLE IF NOT EXISTS public.price_change_audit (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES public.products(id),
    product_price_id BIGINT NOT NULL REFERENCES public.product_prices(id),
    product_code TEXT NOT NULL,
    price_field TEXT NOT NULL
        CHECK (price_field IN ('mrp', 'dealer_price')),
    old_value NUMERIC(12, 2),
    new_value NUMERIC(12, 2),
    actor_user_id UUID NOT NULL,
    actor_email TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_change_audit_product_changed
    ON public.price_change_audit (product_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_change_audit_actor_changed
    ON public.price_change_audit (actor_user_id, changed_at DESC);