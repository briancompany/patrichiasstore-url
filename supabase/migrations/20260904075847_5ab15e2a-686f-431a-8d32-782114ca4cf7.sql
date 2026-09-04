-- 1. Accurate, race-safe flash-sale stock claiming
CREATE OR REPLACE FUNCTION public.claim_order_stock(_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_already boolean;
  v_special boolean;
  v_unavailable jsonb := '[]'::jsonb;
  r RECORD;
  v_take int;
  v_remaining int;
BEGIN
  IF _order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_order');
  END IF;

  SELECT stock_deducted, is_special_order INTO v_already, v_special
  FROM public.orders WHERE id = _order_id FOR UPDATE;

  IF v_already IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;

  IF v_already THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  PERFORM 1
  FROM public.products p
  WHERE p.id IN (
    SELECT DISTINCT oi.product_id FROM public.order_items oi
    WHERE oi.order_id = _order_id AND oi.product_id IS NOT NULL
  )
  ORDER BY p.id
  FOR UPDATE;

  FOR r IN
    SELECT oi.product_id, SUM(oi.quantity)::int AS qty, MIN(oi.product_name) AS product_name,
           p.stock_quantity, p.in_stock
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = _order_id AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id, p.stock_quantity, p.in_stock
  LOOP
    IF NOT r.in_stock OR r.stock_quantity < r.qty THEN
      v_unavailable := v_unavailable || jsonb_build_object(
        'product_id', r.product_id,
        'product_name', r.product_name,
        'requested', r.qty,
        'available', GREATEST(0, r.stock_quantity)
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_unavailable) > 0 AND NOT COALESCE(v_special, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_stock', 'unavailable', v_unavailable);
  END IF;

  -- Claim flash-sale units only for quantities actually charged at the sale
  -- price, capped at the units still available. Rows are locked so two
  -- concurrent orders cannot oversell the same allocation.
  FOR r IN
    SELECT fs.id AS sale_id,
           GREATEST(0, fs.stock_allocated - COALESCE(fs.stock_sold, 0)) AS available,
           SUM(oi.quantity)::int AS qty
    FROM public.order_items oi
    JOIN public.flash_sales fs ON fs.product_id = oi.product_id
    WHERE oi.order_id = _order_id
      AND oi.product_id IS NOT NULL
      AND fs.is_active = true
      AND fs.starts_at <= now()
      AND fs.ends_at > now()
      AND COALESCE(fs.stock_allocated, 0) > 0
      AND oi.price_at_purchase <= fs.sale_price
    GROUP BY fs.id, fs.stock_allocated, fs.stock_sold
  LOOP
    SELECT GREATEST(0, stock_allocated - COALESCE(stock_sold, 0))
    INTO v_remaining
    FROM public.flash_sales WHERE id = r.sale_id FOR UPDATE;

    v_take := LEAST(COALESCE(v_remaining, 0), r.qty);
    IF v_take > 0 THEN
      UPDATE public.flash_sales
      SET stock_sold = COALESCE(stock_sold, 0) + v_take,
          is_active = CASE
            WHEN COALESCE(stock_sold, 0) + v_take >= stock_allocated THEN false
            ELSE is_active
          END
      WHERE id = r.sale_id;
    END IF;
  END LOOP;

  FOR r IN
    SELECT oi.product_id, SUM(oi.quantity)::int AS qty
    FROM public.order_items oi
    WHERE oi.order_id = _order_id AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id
  LOOP
    UPDATE public.products p
    SET stock_quantity = GREATEST(0, p.stock_quantity - r.qty),
        in_stock = (GREATEST(0, p.stock_quantity - r.qty) > 0),
        updated_at = now()
    WHERE p.id = r.product_id;
  END LOOP;

  UPDATE public.orders SET stock_deducted = true WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true, 'special', COALESCE(v_special, false), 'shortfalls', v_unavailable);
END;
$function$;

-- 2. Monitoring writes: signed-in only, throttled per account
CREATE OR REPLACE FUNCTION public.log_server_event(
  _event_type text,
  _message text,
  _severity text DEFAULT 'info',
  _endpoint text DEFAULT NULL,
  _method text DEFAULT NULL,
  _status_code integer DEFAULT NULL,
  _response_time_ms integer DEFAULT NULL,
  _meta jsonb DEFAULT '{}'::jsonb
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_uid uuid := auth.uid();
  v_recent int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT count(*) INTO v_recent
  FROM public.server_logs
  WHERE user_id = v_uid AND occurred_at > now() - interval '1 minute';

  IF v_recent > 120 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.server_logs (
    severity, event_type, message, endpoint, method,
    status_code, response_time_ms, user_id, source, meta
  ) VALUES (
    CASE WHEN lower(COALESCE(_severity, 'info')) IN ('info','warning','error','critical')
         THEN lower(_severity) ELSE 'info' END,
    left(COALESCE(_event_type, 'event'), 60),
    left(COALESCE(_message, ''), 500),
    left(_endpoint, 200),
    left(_method, 10),
    _status_code,
    _response_time_ms,
    v_uid,
    'client',
    COALESCE(_meta, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.log_server_event(text,text,text,text,text,integer,integer,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_server_event(text,text,text,text,text,integer,integer,jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_active_flash_sales() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_flash_sales() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.claim_order_stock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_order_stock(uuid) TO anon, authenticated, service_role;