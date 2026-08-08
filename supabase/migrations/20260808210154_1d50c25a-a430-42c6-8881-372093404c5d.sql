-- 1. Track by tracking code OR order id, no age restriction
CREATE OR REPLACE FUNCTION public.get_order_tracking_public(_tracking_code text)
RETURNS TABLE(order_id uuid, status order_status, total_amount integer, created_at timestamp with time zone, delivery_type delivery_type, item_count bigint, tracking_code text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_raw TEXT;
  v_token TEXT;
  v_uuid uuid;
BEGIN
  v_raw := upper(btrim(COALESCE(_tracking_code, '')));
  IF v_raw = '' THEN
    RETURN;
  END IF;

  -- Order ID (uuid) lookup
  BEGIN
    v_uuid := lower(v_raw)::uuid;
  EXCEPTION WHEN others THEN
    v_uuid := NULL;
  END;

  IF v_uuid IS NOT NULL THEN
    RETURN QUERY
    SELECT o.id, o.status, o.total_amount, o.created_at, o.delivery_type,
           COALESCE(oi.item_count, 0), ot.tracking_code
    FROM public.orders o
    LEFT JOIN public.order_tracking ot ON ot.order_id = o.id
    LEFT JOIN (
      SELECT order_items.order_id, count(*)::bigint AS item_count
      FROM public.order_items GROUP BY order_items.order_id
    ) oi ON oi.order_id = o.id
    WHERE o.id = v_uuid
    LIMIT 1;
    RETURN;
  END IF;

  v_token := regexp_replace(v_raw, '^PS-', '');
  IF v_token !~ '^[A-Z0-9]{4,16}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT o.id, o.status, o.total_amount, o.created_at, o.delivery_type,
         COALESCE(oi.item_count, 0), ot.tracking_code
  FROM public.order_tracking ot
  JOIN public.orders o ON o.id = ot.order_id
  LEFT JOIN (
    SELECT order_items.order_id, count(*)::bigint AS item_count
    FROM public.order_items GROUP BY order_items.order_id
  ) oi ON oi.order_id = o.id
  WHERE upper(ot.tracking_code) IN ('PS-' || v_token, v_token)
  LIMIT 1;
END;
$function$;

-- 2. Phone history: all orders, no 20 row cap, fallback tracking reference
CREATE OR REPLACE FUNCTION public.get_order_history_by_phone(_phone text)
RETURNS TABLE(order_id uuid, status order_status, total_amount integer, created_at timestamp with time zone, delivery_type delivery_type, tracking_code text, item_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_phone text;
  v_local text;
  v_intl  text;
BEGIN
  v_phone := regexp_replace(btrim(COALESCE(_phone, '')), '[^0-9+]', '', 'g');
  IF length(v_phone) < 9 THEN
    RETURN;
  END IF;

  -- normalise to last 9 digits for tolerant matching
  v_local := right(regexp_replace(v_phone, '[^0-9]', '', 'g'), 9);
  v_intl := '254' || v_local;

  RETURN QUERY
  SELECT
    o.id,
    o.status,
    o.total_amount,
    o.created_at,
    o.delivery_type,
    COALESCE(ot.tracking_code, o.id::text) AS tracking_code,
    COALESCE(oi.item_count, 0)
  FROM public.orders o
  LEFT JOIN public.order_tracking ot ON ot.order_id = o.id
  LEFT JOIN (
    SELECT order_items.order_id, count(*)::bigint AS item_count
    FROM public.order_items GROUP BY order_items.order_id
  ) oi ON oi.order_id = o.id
  WHERE right(regexp_replace(COALESCE(o.customer_phone,''), '[^0-9]', '', 'g'), 9) = v_local
     OR regexp_replace(COALESCE(o.customer_phone,''), '[^0-9]', '', 'g') = v_intl
  ORDER BY o.created_at DESC
  LIMIT 200;
END;
$function$;

-- 3. Stock deduction guard
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_deducted boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.deduct_order_stock(_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_already boolean;
  r RECORD;
BEGIN
  IF _order_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT stock_deducted INTO v_already
  FROM public.orders WHERE id = _order_id FOR UPDATE;

  IF v_already IS NULL OR v_already THEN
    RETURN false;
  END IF;

  FOR r IN
    SELECT product_id, SUM(quantity)::int AS qty
    FROM public.order_items
    WHERE order_id = _order_id AND product_id IS NOT NULL
    GROUP BY product_id
  LOOP
    UPDATE public.products p
    SET stock_quantity = GREATEST(0, p.stock_quantity - r.qty),
        in_stock = (GREATEST(0, p.stock_quantity - r.qty) > 0),
        updated_at = now()
    WHERE p.id = r.product_id;
  END LOOP;

  UPDATE public.orders SET stock_deducted = true WHERE id = _order_id;
  RETURN true;
END;
$function$;

-- 4. Admin/staff restock + adjust
CREATE OR REPLACE FUNCTION public.adjust_product_stock(_product_id uuid, _delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new integer;
BEGIN
  IF NOT (public.is_admin() OR public.has_staff_role(auth.uid(), 'staff') OR public.has_staff_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  UPDATE public.products
  SET stock_quantity = GREATEST(0, stock_quantity + _delta),
      in_stock = (GREATEST(0, stock_quantity + _delta) > 0),
      updated_at = now()
  WHERE id = _product_id
  RETURNING stock_quantity INTO v_new;

  IF v_new IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  RETURN v_new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_product_stock(_product_id uuid, _quantity integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new integer;
BEGIN
  IF NOT (public.is_admin() OR public.has_staff_role(auth.uid(), 'staff') OR public.has_staff_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  IF _quantity IS NULL OR _quantity < 0 THEN
    RAISE EXCEPTION 'Quantity must be zero or greater';
  END IF;

  UPDATE public.products
  SET stock_quantity = _quantity,
      in_stock = (_quantity > 0),
      updated_at = now()
  WHERE id = _product_id
  RETURNING stock_quantity INTO v_new;

  IF v_new IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  RETURN v_new;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.deduct_order_stock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_product_stock(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_order_tracking_public(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_history_by_phone(text) TO anon, authenticated;