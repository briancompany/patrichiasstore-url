-- Size-aware stock checks and deductions with backward-compatible product-level fallback.
CREATE OR REPLACE FUNCTION public.has_complete_size_inventory(_type public.uniform_type, _sizes jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.pricing_chart pc WHERE pc.uniform_type = _type::text)
    AND jsonb_typeof(COALESCE(_sizes, '[]'::jsonb)) = 'array'
    AND jsonb_array_length(COALESCE(_sizes, '[]'::jsonb)) > 0
    AND (SELECT count(*) FROM jsonb_array_elements(COALESCE(_sizes, '[]'::jsonb))) =
        (SELECT count(*) FROM public.pricing_chart pc WHERE pc.uniform_type = _type::text)
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(_sizes, '[]'::jsonb)) AS s(value)
      WHERE COALESCE(s.value->>'stock', '') !~ '^[0-9]+$'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.pricing_chart pc
      WHERE pc.uniform_type = _type::text
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(_sizes, '[]'::jsonb)) AS s(value)
          WHERE s.value->>'size' = pc.size
            AND COALESCE(s.value->>'stock', '') ~ '^[0-9]+$'
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.check_stock_availability(_items jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_unavailable jsonb := '[]'::jsonb;
  r RECORD;
  v_stock int;
  v_in_stock boolean;
  v_product_name text;
  v_size_stock int;
  v_available int;
  v_complete boolean;
BEGIN
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN
    RETURN jsonb_build_object('ok', true, 'unavailable', v_unavailable);
  END IF;

  -- First check products with a complete chart-synchronized size inventory.
  FOR r IN
    SELECT (e->>'product_id')::uuid AS product_id, COALESCE(e->>'size', '') AS size,
           SUM(GREATEST(1, COALESCE((e->>'quantity')::int, 1)))::int AS qty
    FROM jsonb_array_elements(_items) e
    WHERE (e->>'product_id') ~ '^[0-9a-fA-F-]{36}$'
    GROUP BY (e->>'product_id')::uuid, COALESCE(e->>'size', '')
  LOOP
    SELECT p.stock_quantity, p.in_stock, p.name,
           public.has_complete_size_inventory(p.type, p.sizes),
           (SELECT CASE WHEN COALESCE(s.value->>'stock', '') ~ '^[0-9]+$'
                       THEN (s.value->>'stock')::int ELSE NULL END
            FROM jsonb_array_elements(COALESCE(p.sizes, '[]'::jsonb)) AS s(value)
            WHERE s.value->>'size' = r.size LIMIT 1)
    INTO v_stock, v_in_stock, v_product_name, v_complete, v_size_stock
    FROM public.products p WHERE p.id = r.product_id;
    IF v_stock IS NULL OR NOT v_complete THEN CONTINUE; END IF;
    v_available := COALESCE(v_size_stock, 0);
    IF NOT COALESCE(v_in_stock, false) OR v_available < r.qty THEN
      v_unavailable := v_unavailable || jsonb_build_object(
        'product_id', r.product_id, 'product_name', v_product_name, 'size', r.size,
        'requested', r.qty, 'available', v_available);
    END IF;
  END LOOP;

  -- Legacy or partially configured products are checked once against their total stock.
  FOR r IN
    SELECT (e->>'product_id')::uuid AS product_id,
           SUM(GREATEST(1, COALESCE((e->>'quantity')::int, 1)))::int AS qty
    FROM jsonb_array_elements(_items) e
    WHERE (e->>'product_id') ~ '^[0-9a-fA-F-]{36}$'
    GROUP BY (e->>'product_id')::uuid
  LOOP
    SELECT p.stock_quantity, p.in_stock, p.name, public.has_complete_size_inventory(p.type, p.sizes)
    INTO v_stock, v_in_stock, v_product_name, v_complete
    FROM public.products p WHERE p.id = r.product_id;
    IF v_stock IS NULL OR v_complete THEN CONTINUE; END IF;
    v_available := GREATEST(0, v_stock);
    IF NOT COALESCE(v_in_stock, false) OR v_available < r.qty THEN
      v_unavailable := v_unavailable || jsonb_build_object(
        'product_id', r.product_id, 'product_name', v_product_name, 'size', 'All sizes',
        'requested', r.qty, 'available', v_available);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', jsonb_array_length(v_unavailable) = 0, 'unavailable', v_unavailable);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_order_stock(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_already boolean;
  v_unavailable jsonb := '[]'::jsonb;
  r RECORD;
  v_size_stock int;
  v_complete boolean;
  v_available int;
BEGIN
  IF _order_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing_order'); END IF;
  SELECT stock_deducted INTO v_already FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF v_already IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found'); END IF;
  IF v_already THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;

  PERFORM 1 FROM public.products p
  WHERE p.id IN (SELECT DISTINCT oi.product_id FROM public.order_items oi
                 WHERE oi.order_id = _order_id AND oi.product_id IS NOT NULL)
  ORDER BY p.id FOR UPDATE;

  -- Validate chart-synchronized products by individual size.
  FOR r IN
    SELECT oi.product_id, oi.size, SUM(oi.quantity)::int AS qty,
           MIN(oi.product_name) AS product_name, p.stock_quantity, p.in_stock, p.sizes, p.type
    FROM public.order_items oi JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = _order_id AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id, oi.size, p.stock_quantity, p.in_stock, p.sizes, p.type
  LOOP
    IF NOT public.has_complete_size_inventory(r.type, r.sizes) THEN CONTINUE; END IF;
    SELECT CASE WHEN COALESCE(s.value->>'stock', '') ~ '^[0-9]+$'
                THEN (s.value->>'stock')::int ELSE NULL END
    INTO v_size_stock
    FROM jsonb_array_elements(COALESCE(r.sizes, '[]'::jsonb)) AS s(value)
    WHERE s.value->>'size' = r.size LIMIT 1;
    v_available := COALESCE(v_size_stock, 0);
    IF NOT COALESCE(r.in_stock, false) OR v_available < r.qty THEN
      v_unavailable := v_unavailable || jsonb_build_object(
        'product_id', r.product_id, 'product_name', r.product_name, 'size', r.size,
        'requested', r.qty, 'available', v_available);
    END IF;
  END LOOP;

  -- Validate legacy products once against the combined quantity of all sizes.
  FOR r IN
    SELECT p.id AS product_id, p.name AS product_name, p.stock_quantity, p.in_stock,
           SUM(oi.quantity)::int AS qty
    FROM public.products p JOIN public.order_items oi ON oi.product_id = p.id
    WHERE oi.order_id = _order_id AND NOT public.has_complete_size_inventory(p.type, p.sizes)
    GROUP BY p.id, p.name, p.stock_quantity, p.in_stock
  LOOP
    v_available := GREATEST(0, r.stock_quantity);
    IF NOT r.in_stock OR v_available < r.qty THEN
      v_unavailable := v_unavailable || jsonb_build_object(
        'product_id', r.product_id, 'product_name', r.product_name, 'size', 'All sizes',
        'requested', r.qty, 'available', v_available);
    END IF;
  END LOOP;

  IF jsonb_array_length(v_unavailable) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_stock', 'unavailable', v_unavailable);
  END IF;

  -- Deduct size stock for chart-synchronized products only.
  FOR r IN
    SELECT oi.product_id, oi.size, SUM(oi.quantity)::int AS qty, p.sizes, p.type
    FROM public.order_items oi JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = _order_id AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id, oi.size, p.sizes, p.type
  LOOP
    IF public.has_complete_size_inventory(r.type, r.sizes) THEN
      UPDATE public.products p
      SET sizes = (
        SELECT COALESCE(jsonb_agg(
          CASE WHEN s.value->>'size' = r.size THEN
            jsonb_set(s.value, '{stock}', to_jsonb(GREATEST(0, (s.value->>'stock')::int - r.qty)), true)
          ELSE s.value END ORDER BY s.ordinality), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE(p.sizes, '[]'::jsonb)) WITH ORDINALITY AS s(value, ordinality)
      ), updated_at = now() WHERE p.id = r.product_id;
    END IF;
  END LOOP;

  -- Synchronize product totals for size-managed products; decrement legacy totals otherwise.
  FOR r IN
    SELECT p.id, p.type, p.sizes, SUM(oi.quantity)::int AS qty
    FROM public.products p JOIN public.order_items oi ON oi.product_id = p.id
    WHERE oi.order_id = _order_id
    GROUP BY p.id, p.type, p.sizes
  LOOP
    IF public.has_complete_size_inventory(r.type, r.sizes) THEN
      UPDATE public.products p
      SET stock_quantity = COALESCE((SELECT SUM((s.value->>'stock')::int)
          FROM jsonb_array_elements(COALESCE(p.sizes, '[]'::jsonb)) AS s(value)), 0),
          in_stock = COALESCE((SELECT SUM((s.value->>'stock')::int) > 0
          FROM jsonb_array_elements(COALESCE(p.sizes, '[]'::jsonb)) AS s(value)), false),
          updated_at = now() WHERE p.id = r.id;
    ELSE
      UPDATE public.products p
      SET stock_quantity = GREATEST(0, p.stock_quantity - r.qty),
          in_stock = (GREATEST(0, p.stock_quantity - r.qty) > 0), updated_at = now()
      WHERE p.id = r.id;
    END IF;
  END LOOP;

  UPDATE public.orders SET stock_deducted = true WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_stock_availability(jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_order_stock(uuid) TO service_role;
