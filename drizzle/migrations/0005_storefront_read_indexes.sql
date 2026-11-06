CREATE INDEX IF NOT EXISTS idx_warmup_logs_started_at_desc ON public.warmup_logs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_available_school_type ON public.products (school_id, type) WHERE in_stock = true;
CREATE INDEX IF NOT EXISTS idx_products_general_name ON public.products (name) WHERE school_id IS NULL;