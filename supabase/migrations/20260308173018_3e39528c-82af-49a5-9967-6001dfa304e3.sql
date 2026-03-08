
-- Back-in-stock notification subscribers
CREATE TABLE public.stock_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, email)
);

ALTER TABLE public.stock_subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe
CREATE POLICY "Anyone can subscribe to stock alerts"
ON public.stock_subscribers FOR INSERT
WITH CHECK (
  product_id IS NOT NULL
  AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
);

-- Admins can view
CREATE POLICY "Admins can view stock subscribers"
ON public.stock_subscribers FOR SELECT
USING (is_admin());

-- Admins can update (mark notified)
CREATE POLICY "Admins can update stock subscribers"
ON public.stock_subscribers FOR UPDATE
USING (is_admin());

-- Delivery zones table
CREATE TABLE public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name text NOT NULL UNIQUE,
  delivery_fee integer NOT NULL DEFAULT 0,
  estimated_days integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

-- Anyone can view active zones
CREATE POLICY "Anyone can view delivery zones"
ON public.delivery_zones FOR SELECT
USING (is_active = true);

-- Admins manage zones
CREATE POLICY "Admins can view all delivery zones"
ON public.delivery_zones FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can insert delivery zones"
ON public.delivery_zones FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update delivery zones"
ON public.delivery_zones FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete delivery zones"
ON public.delivery_zones FOR DELETE
USING (is_admin());

-- Order history lookup function (by phone, no account needed)
CREATE OR REPLACE FUNCTION public.get_order_history_by_phone(_phone text)
RETURNS TABLE(
  order_id uuid,
  status order_status,
  total_amount integer,
  created_at timestamptz,
  delivery_type delivery_type,
  tracking_code text,
  item_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_phone text;
BEGIN
  v_phone := regexp_replace(btrim(COALESCE(_phone, '')), '[^0-9+]', '', 'g');
  
  IF length(v_phone) < 9 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id AS order_id,
    o.status,
    o.total_amount,
    o.created_at,
    o.delivery_type,
    ot.tracking_code,
    COALESCE(oi.item_count, 0) AS item_count
  FROM public.orders o
  LEFT JOIN public.order_tracking ot ON ot.order_id = o.id
  LEFT JOIN (
    SELECT order_items.order_id, count(*)::bigint AS item_count
    FROM public.order_items
    GROUP BY order_items.order_id
  ) oi ON oi.order_id = o.id
  WHERE o.customer_phone = v_phone
     OR o.customer_phone = regexp_replace(v_phone, '^0', '+254')
     OR o.customer_phone = regexp_replace(v_phone, '^\+254', '0')
  ORDER BY o.created_at DESC
  LIMIT 20;
END;
$$;
