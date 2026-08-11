-- Strict, atomic stock claim used at payment confirmation time.
CREATE OR REPLACE FUNCTION public.claim_order_stock(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already boolean;
  v_unavailable jsonb := '[]'::jsonb;
  r RECORD;
BEGIN
  IF _order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_order');
  END IF;

  SELECT stock_deducted INTO v_already
  FROM public.orders WHERE id = _order_id FOR UPDATE;

  IF v_already IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;

  IF v_already THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  -- Lock every involved product row (stable order to avoid deadlocks)
  PERFORM 1
  FROM public.products p
  WHERE p.id IN (
    SELECT DISTINCT oi.product_id FROM public.order_items oi
    WHERE oi.order_id = _order_id AND oi.product_id IS NOT NULL
  )
  ORDER BY p.id
  FOR UPDATE;

  -- Detect shortages first
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

  IF jsonb_array_length(v_unavailable) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_stock', 'unavailable', v_unavailable);
  END IF;

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
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_order_stock(uuid) TO service_role;

-- Public availability check: lets the client know instantly if items just sold out.
CREATE OR REPLACE FUNCTION public.check_stock_availability(_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unavailable jsonb := '[]'::jsonb;
  r RECORD;
BEGIN
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN
    RETURN jsonb_build_object('ok', true, 'unavailable', v_unavailable);
  END IF;

  FOR r IN
    SELECT (e->>'product_id')::uuid AS product_id,
           GREATEST(1, COALESCE((e->>'quantity')::int, 1)) AS qty
    FROM jsonb_array_elements(_items) e
    WHERE (e->>'product_id') ~ '^[0-9a-fA-F-]{36}$'
  LOOP
    DECLARE
      v_qty int;
      v_in boolean;
      v_name text;
    BEGIN
      SELECT p.stock_quantity, p.in_stock, p.name INTO v_qty, v_in, v_name
      FROM public.products p WHERE p.id = r.product_id;

      IF v_qty IS NULL THEN
        CONTINUE;
      END IF;

      IF NOT v_in OR v_qty < r.qty THEN
        v_unavailable := v_unavailable || jsonb_build_object(
          'product_id', r.product_id,
          'product_name', v_name,
          'requested', r.qty,
          'available', GREATEST(0, v_qty)
        );
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', jsonb_array_length(v_unavailable) = 0, 'unavailable', v_unavailable);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_stock_availability(jsonb) TO anon, authenticated, service_role;

-- Live stock updates for shoppers
ALTER TABLE public.products REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;