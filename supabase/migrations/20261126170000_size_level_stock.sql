-- Size-aware stock enforcement with a safe legacy fallback.
-- Products whose every size has a numeric "stock" value use per-size inventory.
-- Older or partially configured products continue using the existing product-level stock.

-- Only enable size-level stock after a product has been explicitly synchronized
-- to every current row in its shared category chart. This prevents legacy products
-- from silently switching inventory models just because their JSON had a stock key.
CREATE OR REPLACE FUNCTION public.has_complete_size_inventory(_type text, _sizes jsonb)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.pricing_chart pc WHERE pc.uniform_type = _type)
    AND jsonb_typeof(COALESCE(_sizes, '[]'::jsonb)) = 'array'
    AND jsonb_array_length(COALESCE(_sizes, '[]'::jsonb)) > 0
    AND (SELECT count(*) FROM jsonb_array_elements(COALESCE(_sizes, '[]'::jsonb))) =
        (SELECT count(*) FROM public.pricing_chart pc WHERE pc.uniform_type = _type)
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(_sizes, '[]'::jsonb)) AS s(value)
      WHERE COALESCE(s.value->>'stock', '') !~ '^[0-9]+$'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.pricing_chart pc
      WHERE pc.uniform_type = _type
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(_sizes, '[]'::jsonb)) AS s(value)
          WHERE s.value->>'size' = pc.size
            AND COALESCE(s.value->>'stock', '') ~ '^[0-9]+$'
        )
    );
$$;
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
  v_qty int;
  v_in boolean;
  v_name text;
  v_product_stock int;
  v_size_stock int;
  v_complete_size_stock boolean;
  v_available int;
BEGIN
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN
    RETURN jsonb_build_object('ok', true, 'unavailable', v_unavailable);
  END IF;

  FOR r IN
    SELECT (e->>'product_id')::uuid AS product_id,
           COALESCE(e->>'size', '') AS size,
           SUM(GREATEST(1, COALESCE((e->>'quantity')::int, 1)))::int AS qty
    FROM jsonb_array_elements(_items) e
    WHERE (e->>'product_id') ~ '^[0-9a-fA-F-]{36}$'
    GROUP BY (e->>'product_id')::uuid, COALESCE(e->>'size', '')
  LOOP
    v_product_stock := NULL;
    v_in := NULL;
    v_name := NULL;
    v_size_stock := NULL;
    v_complete_size_stock := false;

    SELECT p.stock_quantity, p.in_stock, p.name,
      public.has_complete_size_inventory(p.type, p.sizes),
      (
        SELECT CASE WHEN COALESCE(s.value->>'stock', '') ~ '^[0-9]+$'
                    THEN (s.value->>'stock')::int ELSE NULL END
        FROM jsonb_array_elements(COALESCE(p.sizes, '[]'::jsonb)) AS s(value)
        WHERE s.value->>'size' = r.size
        LIMIT 1
      )
    INTO v_product_stock, v_in, v_name, v_complete_size_stock, v_size_stock
    FROM public.products p
    WHERE p.id = r.product_id;

    IF v_product_stock IS NULL THEN
      CONTINUE;
    END IF;

    v_available := CASE WHEN v_complete_size_stock
                        THEN COALESCE(v_size_stock, 0)
                        ELSE GREATEST(0, v_product_stock) END;

    IF NOT COALESCE(v_in, false) OR v_available < r.qty THEN
      v_unavailable := v_unavailable || jsonb_build_object(
        'product_id', r.product_id,
        'product_name', v_name,
        'size', r.size,
        'requested', r.qty,
        'available', v_available
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', jsonb_array_length(v_unavailable) = 0, 'unavailable', v_unavailable);
END;
$$;

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
  v_product_stock int;
  v_size_stock int;
  v_complete_size_stock boolean;
  v_available int;
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

  PERFORM 1
  FROM public.products p
  WHERE p.id IN (
    SELECT DISTINCT oi.product_id FROM public.order_items oi
    WHERE oi.order_id = _order_id AND oi.product_id IS NOT NULL
  )
  ORDER BY p.id
  FOR UPDATE;

  -- Validate every product/size combination before deducting anything.
  FOR r IN
    SELECT oi.product_id, oi.size, SUM(oi.quantity)::int AS qty,
           MIN(oi.product_name) AS product_name, p.stock_quantity, p.in_stock,
           p.sizes, p.type
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = _order_id AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id, oi.size, p.stock_quantity, p.in_stock, p.sizes, p.type
  LOOP
    SELECT public.has_complete_size_inventory(r.type, r.sizes),
    (
      SELECT CASE WHEN COALESCE(s.value->>'stock', '') ~ '^[0-9]+$'
                  THEN (s.value->>'stock')::int ELSE NULL END
      FROM jsonb_array_elements(COALESCE(r.sizes, '[]'::jsonb)) AS s(value)
      WHERE s.value->>'size' = r.size
      LIMIT 1
    )
    INTO v_complete_size_stock, v_size_stock;

    v_available := CASE WHEN v_complete_size_stock
                        THEN COALESCE(v_size_stock, 0)
                        ELSE GREATEST(0, r.stock_quantity) END;

    IF NOT r.in_stock OR v_available < r.qty THEN
      v_unavailable := v_unavailable || jsonb_build_object(
        'product_id', r.product_id,
        'product_name', r.product_name,
        'size', r.size,
        'requested', r.qty,
        'available', v_available
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_unavailable) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_stock', 'unavailable', v_unavailable);
  END IF;

  -- Deduct size stock only when every size on that product has an explicit
  -- numeric stock value. Otherwise preserve the legacy product-level behavior.
  FOR r IN
    SELECT oi.product_id, oi.size, SUM(oi.quantity)::int AS qty, p.sizes, p.type
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = _order_id AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id, oi.size, p.sizes, p.type
  LOOP
    SELECT public.has_complete_size_inventory(r.type, r.sizes) INTO v_complete_size_stock;

    IF v_complete_size_stock THEN
      UPDATE public.products p
      SET sizes = (
        SELECT COALESCE(
          jsonb_agg(
            CASE
              WHEN s.value->>'size' = r.size THEN
                jsonb_set(s.value, '{stock}', to_jsonb(GREATEST(0, (s.value->>'stock')::int - r.qty)), true)
              ELSE s.value
            END
            ORDER BY s.ordinality
          ),
          '[]'::jsonb
        )
        FROM jsonb_array_elements(COALESCE(p.sizes, '[]'::jsonb)) WITH ORDINALITY AS s(value, ordinality)
      ),
      updated_at = now()
      WHERE p.id = r.product_id;
    END IF;
  END LOOP;

  -- Keep the existing total-stock field synchronized for complete size charts;
  -- legacy products continue to deduct from the total quantity as before.
  FOR r IN
    SELECT p.id, SUM(oi.quantity)::int AS qty,
           public.has_complete_size_inventory(p.type, p.sizes) AS complete_size_stock
    FROM public.products p
    JOIN public.order_items oi ON oi.product_id = p.id
    WHERE oi.order_id = _order_id
    GROUP BY p.id, p.sizes
  LOOP
    IF r.complete_size_stock THEN
      UPDATE public.products p
      SET stock_quantity = COALESCE((
            SELECT SUM((s.value->>'stock')::int)
            FROM jsonb_array_elements(COALESCE(p.sizes, '[]'::jsonb)) AS s(value)
          ), 0),
          in_stock = COALESCE((
            SELECT SUM((s.value->>'stock')::int) > 0
            FROM jsonb_array_elements(COALESCE(p.sizes, '[]'::jsonb)) AS s(value)
          ), false),
          updated_at = now()
      WHERE p.id = r.id;
    ELSE
      UPDATE public.products p
      SET stock_quantity = GREATEST(0, p.stock_quantity - r.qty),
          in_stock = (GREATEST(0, p.stock_quantity - r.qty) > 0),
          updated_at = now()
      WHERE p.id = r.id;
    END IF;
  END LOOP;

  UPDATE public.orders SET stock_deducted = true WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_stock_availability(jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_order_stock(uuid) TO service_role;
