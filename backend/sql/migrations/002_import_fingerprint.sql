ALTER TABLE public.import_batches
ADD COLUMN IF NOT EXISTS source_sha256 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_import_batches_source_sha256
ON public.import_batches (source_sha256)
WHERE source_sha256 IS NOT NULL;
