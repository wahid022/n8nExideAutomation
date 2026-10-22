CREATE TABLE IF NOT EXISTS import_batches (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_file TEXT NOT NULL,
    source_sheet TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'validated', 'imported', 'failed')),
    total_rows INTEGER NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
    inserted_rows INTEGER NOT NULL DEFAULT 0 CHECK (inserted_rows >= 0),
    rejected_rows INTEGER NOT NULL DEFAULT 0 CHECK (rejected_rows >= 0),
    error_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_code TEXT NOT NULL UNIQUE,
    brand TEXT NOT NULL,
    category TEXT NOT NULL,
    sub_category TEXT,
    model_sku TEXT NOT NULL,
    specs_capacity TEXT,
    warranty TEXT,
    hsn TEXT,
    source_batch_id BIGINT REFERENCES import_batches(id),
    source_sheet TEXT,
    source_row INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_brand
    ON products (brand);

CREATE INDEX IF NOT EXISTS idx_products_category
    ON products (category);

CREATE INDEX IF NOT EXISTS idx_products_model_sku
    ON products (model_sku);

CREATE TABLE IF NOT EXISTS product_prices (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    dealer_price NUMERIC(12, 2) CHECK (dealer_price >= 0),
    mrp NUMERIC(12, 2) CHECK (mrp >= 0),
    gst_rate NUMERIC(5, 2) CHECK (gst_rate >= 0 AND gst_rate <= 100),
    effective_from DATE,
    source_batch_id BIGINT REFERENCES import_batches(id),
    source_sheet TEXT,
    source_row INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        dealer_price IS NOT NULL
        OR mrp IS NOT NULL
        OR gst_rate IS NOT NULL
        OR effective_from IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_product_prices_product_date
    ON product_prices (product_id, effective_from DESC);

CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
