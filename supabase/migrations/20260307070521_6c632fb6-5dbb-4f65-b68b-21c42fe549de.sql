CREATE OR REPLACE FUNCTION public.get_order_tracking_public(_tracking_code TEXT)
RETURNS TABLE (
  order_id UUID,
  status public.order_status,
  total_amount INTEGER,
  created_at TIMESTAMPTZ,
  delivery_type public.delivery_type,
  item_count BIGINT,
  tracking_code TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw TEXT;
  v_token TEXT;
  v_canonical TEXT;
BEGIN
  v_raw := upper(btrim(COALESCE(_tracking_code, '')));
  IF v_raw = '' THEN
    RETURN;
  END IF;

  v_token := regexp_replace(v_raw, '^PS-', '');

  IF v_token !~ '^[A-Z0-9]{6,10}$' THEN
    RETURN;
  END IF;

  v_canonical := 'PS-' || v_token;

  RETURN QUERY
  SELECT
    o.id AS order_id,
    o.status,
    o.total_amount,
    o.created_at,
    o.delivery_type,
    COALESCE(oi.item_count, 0) AS item_count,
    ot.tracking_code
  FROM public.order_tracking ot
  JOIN public.orders o ON o.id = ot.order_id
  LEFT JOIN (
    SELECT order_items.order_id, count(*)::bigint AS item_count
    FROM public.order_items
    GROUP BY order_items.order_id
  ) oi ON oi.order_id = o.id
  WHERE ot.tracking_code IN (v_canonical, v_token)
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_tracking_public(TEXT) TO anon, authenticated;
SELECT pg_notify('pgrst', 'reload schema');