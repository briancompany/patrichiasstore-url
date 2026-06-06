
-- 1) Public-safe reviews view (no email column)
CREATE OR REPLACE VIEW public.public_product_reviews
WITH (security_invoker = true) AS
SELECT id, product_id, reviewer_name, rating, review_text, created_at, is_approved
FROM public.product_reviews
WHERE is_approved = true;

GRANT SELECT ON public.public_product_reviews TO anon, authenticated;

-- Remove broad public select on product_reviews; keep admin select.
DROP POLICY IF EXISTS "Anyone can view approved reviews" ON public.product_reviews;

-- 2) warmup_logs: drop anon write policies (edge function uses service role)
DROP POLICY IF EXISTS "Anon insert warmup logs" ON public.warmup_logs;
DROP POLICY IF EXISTS "Anon update warmup logs" ON public.warmup_logs;

-- 3) Strengthen INSERT policies to require existing order
DROP POLICY IF EXISTS "Anyone can add order items" ON public.order_items;
CREATE POLICY "Anyone can add order items" ON public.order_items
FOR INSERT TO anon, authenticated
WITH CHECK (
  order_id IS NOT NULL
  AND product_name IS NOT NULL AND length(btrim(product_name)) > 0
  AND size IS NOT NULL AND length(btrim(size)) > 0
  AND quantity IS NOT NULL AND quantity > 0
  AND price_at_purchase IS NOT NULL AND price_at_purchase >= 0
  AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id)
);

DROP POLICY IF EXISTS "Anyone can insert payments" ON public.payments;
CREATE POLICY "Anyone can insert payments" ON public.payments
FOR INSERT TO anon, authenticated
WITH CHECK (
  order_id IS NOT NULL
  AND amount IS NOT NULL AND amount > 0
  AND mpesa_code IS NOT NULL
  AND length(btrim(mpesa_code)) BETWEEN 8 AND 12
  AND customer_name IS NOT NULL AND length(btrim(customer_name)) > 0
  AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id)
);

DROP POLICY IF EXISTS "Anyone can insert order tracking" ON public.order_tracking;
CREATE POLICY "Anyone can insert order tracking" ON public.order_tracking
FOR INSERT TO anon, authenticated
WITH CHECK (
  order_id IS NOT NULL
  AND tracking_code IS NOT NULL
  AND tracking_code ~ '^PS-[A-Z0-9]{6,10}$'
  AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id)
);

-- 4) Storage: prevent bucket listing via storage.objects (public URLs still work via CDN)
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view school logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view store content images" ON storage.objects;

-- 5) Restrict SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.get_order_contact_email(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_delivered_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
