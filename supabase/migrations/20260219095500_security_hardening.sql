-- Security hardening for order tracking, PII exposure, storage access, and security definer functions.

-- Ensure tracking table is admin-only for direct access.
DROP POLICY IF EXISTS "Anyone can view order tracking by code" ON public.order_tracking;
DROP POLICY IF EXISTS "Anyone can insert order tracking" ON public.order_tracking;
DROP POLICY IF EXISTS "Admins can insert order tracking" ON public.order_tracking;

CREATE POLICY "Admins can view order tracking"
ON public.order_tracking
FOR SELECT
USING (public.is_admin());

CREATE POLICY "Admins can insert order tracking"
ON public.order_tracking
FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update order tracking"
ON public.order_tracking
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete order tracking"
ON public.order_tracking
FOR DELETE
USING (public.is_admin());

-- Remove broad public read policies that expose order/customer PII via tracking joins.
DROP POLICY IF EXISTS "Anyone can view orders via tracking" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view order items via tracking" ON public.order_items;

-- Public-safe tracking function with strict backend validation and limited fields.
CREATE OR REPLACE FUNCTION public.get_order_tracking_public(p_tracking_code text)
RETURNS TABLE (
  order_id uuid,
  status public.order_status,
  total_amount integer,
  created_at timestamptz,
  delivery_type public.delivery_type,
  item_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tracking_code IS NULL OR btrim(p_tracking_code) = '' THEN
    RAISE EXCEPTION 'tracking code is required';
  END IF;

  IF upper(btrim(p_tracking_code)) !~ '^PS-[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'invalid tracking code format';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.status,
    o.total_amount,
    o.created_at,
    o.delivery_type,
    COUNT(oi.id) AS item_count
  FROM public.order_tracking ot
  JOIN public.orders o ON o.id = ot.order_id
  LEFT JOIN public.order_items oi ON oi.order_id = o.id
  WHERE ot.tracking_code = upper(btrim(p_tracking_code))
  GROUP BY o.id, o.status, o.total_amount, o.created_at, o.delivery_type;
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_tracking_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_tracking_public(text) TO anon, authenticated;

-- Explicitly lock down is_admin execute permissions to auth roles only.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- Restrict storage buckets from unrestricted public mode.
UPDATE storage.buckets
SET public = false
WHERE id IN ('product-images', 'school-logos');

-- Replace permissive read policies with authenticated-only reads.
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view school logos" ON storage.objects;

CREATE POLICY "Authenticated users can view product images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view school logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'school-logos' AND auth.role() = 'authenticated');
