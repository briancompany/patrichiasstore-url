ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_special_order boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_order_note text;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS shortfall_quantity integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.claim_order_stock(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already boolean;
  v_special boolean;
  v_unavailable jsonb := '[]'::jsonb;
  r RECORD;
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
$$;