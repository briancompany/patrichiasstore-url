
-- Fix: Replace SECURITY DEFINER view with SECURITY INVOKER (default)
DROP VIEW IF EXISTS public.product_rating_summary;
CREATE VIEW public.product_rating_summary
WITH (security_invoker = true)
AS
SELECT
  product_id,
  COUNT(*)::int AS review_count,
  ROUND(AVG(rating)::numeric, 1)::float AS avg_rating
FROM public.product_reviews
WHERE is_approved = true
GROUP BY product_id;
