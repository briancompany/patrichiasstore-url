CREATE TABLE public.payment_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','queued','processing','completed','failed','dead')),
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_attempted_at timestamptz,
  callback_url text NOT NULL,
  redirect_url text,
  pesapal_tracking_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_tasks_due_idx ON public.payment_tasks (status, next_attempt_at);

GRANT SELECT ON public.payment_tasks TO authenticated;
GRANT ALL ON public.payment_tasks TO service_role;
ALTER TABLE public.payment_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view payment tasks" ON public.payment_tasks FOR SELECT TO authenticated USING (public.is_admin());

CREATE TRIGGER trg_payment_tasks_updated_at BEFORE UPDATE ON public.payment_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic checkout: order + items + contact + tracking + payment task in one transaction.
CREATE OR REPLACE FUNCTION public.create_order_with_payment_task(_order jsonb, _items jsonb, _email text, _callback_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_code text := 'PS-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  v_total int := COALESCE((_order->>'total_amount')::int, 0);
  v_name text := btrim(COALESCE(_order->>'customer_name', ''));
  v_phone text := btrim(COALESCE(_order->>'customer_phone', ''));
  v_status public.order_status := CASE WHEN COALESCE((_order->>'is_new_school')::boolean, false)
                                       THEN 'new_school_setup'::public.order_status
                                       ELSE 'pending_payment'::public.order_status END;
  e jsonb;
  v_qty int;
BEGIN
  IF v_name = '' OR length(v_name) > 120 THEN RAISE EXCEPTION 'Please enter your name'; END IF;
  IF length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 9 THEN RAISE EXCEPTION 'Please enter a valid phone number'; END IF;
  IF v_total <= 0 OR v_total > 1000000 THEN RAISE EXCEPTION 'Invalid order total'; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 50 THEN
    RAISE EXCEPTION 'Your order has no items';
  END IF;
  IF _callback_url IS NULL OR NOT (_callback_url ~ '^https://[^\s]+$' OR _callback_url ~ '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?/') THEN
    RAISE EXCEPTION 'Invalid return address';
  END IF;

  INSERT INTO public.orders (id, customer_name, customer_phone, customer_school, delivery_type, delivery_location,
    notes, total_amount, status, is_new_school, linked_school_id, is_special_order, special_order_note)
  VALUES (v_id, v_name, v_phone, NULLIF(btrim(_order->>'customer_school'), ''),
    COALESCE((_order->>'delivery_type')::public.delivery_type, 'pickup'),
    NULLIF(btrim(_order->>'delivery_location'), ''),
    left(NULLIF(btrim(_order->>'notes'), ''), 1000), v_total, v_status,
    COALESCE((_order->>'is_new_school')::boolean, false),
    NULLIF(_order->>'linked_school_id', '')::uuid,
    COALESCE((_order->>'is_special_order')::boolean, false),
    left(NULLIF(btrim(_order->>'special_order_note'), ''), 2000));

  FOR e IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := COALESCE((e->>'quantity')::int, 0);
    IF v_qty < 1 OR v_qty > 200 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    IF COALESCE((e->>'price_at_purchase')::int, -1) < 0 THEN RAISE EXCEPTION 'Invalid price'; END IF;
    INSERT INTO public.order_items (order_id, product_id, product_name, school_name, size, quantity, price_at_purchase,
      printing_required, logo_url, color, sample_image_url, shortfall_quantity)
    VALUES (v_id,
      CASE WHEN (e->>'product_id') ~ '^[0-9a-fA-F-]{36}$' AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = (e->>'product_id')::uuid)
           THEN (e->>'product_id')::uuid ELSE NULL END,
      left(COALESCE(e->>'product_name', 'Item'), 200), NULLIF(e->>'school_name', ''),
      left(COALESCE(e->>'size', '-'), 40), v_qty, (e->>'price_at_purchase')::int,
      COALESCE((e->>'printing_required')::boolean, false), NULLIF(e->>'logo_url', ''),
      NULLIF(e->>'color', ''), NULLIF(e->>'sample_image_url', ''),
      LEAST(v_qty, GREATEST(0, COALESCE((e->>'shortfall_quantity')::int, 0))));
  END LOOP;

  PERFORM public.upsert_order_contact_email(v_id, _email, v_name, v_phone);
  INSERT INTO public.order_tracking (order_id, tracking_code) VALUES (v_id, v_code);
  INSERT INTO public.payment_tasks (order_id, callback_url) VALUES (v_id, _callback_url);

  RETURN jsonb_build_object('order_id', v_id, 'tracking_code', v_code, 'status', v_status);
END $$;

-- Public status read by order id (uuid is unguessable); no PII returned.
CREATE OR REPLACE FUNCTION public.get_payment_task_status(_order_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('status', t.status, 'redirect_url', t.redirect_url,
    'tracking_id', t.pesapal_tracking_id, 'retry_count', t.retry_count, 'max_retries', t.max_retries,
    'order_status', o.status)
  FROM public.payment_tasks t JOIN public.orders o ON o.id = t.order_id
  WHERE t.order_id = _order_id LIMIT 1;
$$;

-- Create a task for an older order, or retry a dead/failed one.
CREATE OR REPLACE FUNCTION public.enqueue_payment_task(_order_id uuid, _callback_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status public.order_status; v_task text;
BEGIN
  IF _callback_url IS NULL OR NOT (_callback_url ~ '^https://[^\s]+$' OR _callback_url ~ '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?/') THEN
    RAISE EXCEPTION 'Invalid return address';
  END IF;
  SELECT status INTO v_status FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_status IN ('confirmed','completed','processing','ready','out_for_delivery','delivered') THEN
    RAISE EXCEPTION 'Order is already paid';
  END IF;

  SELECT status INTO v_task FROM public.payment_tasks WHERE order_id = _order_id FOR UPDATE;
  IF v_task IS NULL THEN
    INSERT INTO public.payment_tasks (order_id, callback_url) VALUES (_order_id, _callback_url);
  ELSIF v_task IN ('dead','failed') THEN
    UPDATE public.payment_tasks SET status = 'pending', retry_count = 0, next_attempt_at = now(),
      error_message = NULL, redirect_url = NULL, callback_url = _callback_url WHERE order_id = _order_id;
    IF v_status = 'declined' THEN
      UPDATE public.orders SET status = 'pending_payment' WHERE id = _order_id;
    END IF;
  END IF;
  RETURN public.get_payment_task_status(_order_id);
END $$;

-- Worker claim: safe for concurrent workers.
CREATE OR REPLACE FUNCTION public.claim_payment_tasks(_limit int DEFAULT 5)
RETURNS SETOF public.payment_tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- relay step: due pending tasks (and stuck processing ones) become queued
  UPDATE public.payment_tasks SET status = 'queued'
  WHERE (status = 'pending' AND next_attempt_at <= now())
     OR (status = 'processing' AND last_attempted_at < now() - interval '5 minutes');

  RETURN QUERY
  UPDATE public.payment_tasks t SET status = 'processing', last_attempted_at = now()
  WHERE t.id IN (
    SELECT id FROM public.payment_tasks WHERE status = 'queued'
    ORDER BY created_at ASC LIMIT LEAST(GREATEST(_limit, 1), 20)
    FOR UPDATE SKIP LOCKED)
  RETURNING t.*;
END $$;

REVOKE ALL ON FUNCTION public.create_order_with_payment_task(jsonb, jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_payment_task_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_payment_task(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_payment_tasks(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_payment_task(jsonb, jsonb, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_task_status(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_payment_task(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_payment_tasks(int) TO service_role;