CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_mpesa_code ON public.payments(mpesa_code);
CREATE INDEX IF NOT EXISTS idx_products_school_stock ON public.products(school_id, in_stock);
SELECT pg_notify('pgrst', 'reload schema');