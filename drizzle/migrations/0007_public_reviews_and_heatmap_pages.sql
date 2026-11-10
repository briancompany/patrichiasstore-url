-- Make the approved-reviews view readable to anonymous storefront visitors.
-- The view exposes only approved reviews and deliberately omits reviewer_email.
CREATE OR REPLACE VIEW public.public_product_reviews
WITH (security_invoker = false, security_barrier = true) AS
SELECT id, product_id, reviewer_name, rating, review_text, created_at
FROM public.product_reviews
WHERE is_approved = true;

GRANT SELECT ON public.public_product_reviews TO anon, authenticated;

-- Include every visited storefront page in the heatmap selector, even when it
-- has not received a click yet. Click counts remain zero until a click is recorded.
CREATE OR REPLACE FUNCTION public.visitor_pages(_from timestamptz, _to timestamptz)
RETURNS TABLE(page text, clicks bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    page,
    count(*) FILTER (WHERE event_type = 'click') AS clicks
  FROM public.visitor_events
  WHERE public.is_admin()
    AND created_at >= _from
    AND created_at < _to
    AND event_type IN ('page_view', 'click')
    AND page IS NOT NULL
  GROUP BY page
  ORDER BY count(*) FILTER (WHERE event_type = 'click') DESC, max(created_at) DESC
  LIMIT 100;
$$;

REVOKE EXECUTE ON FUNCTION public.visitor_pages(timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.visitor_pages(timestamptz, timestamptz) TO authenticated;
