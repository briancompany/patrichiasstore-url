-- Flexible payment selection: payment state is independent from fulfilment state.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_updated_by uuid;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('pesapal', 'mpesa', 'cash'));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));

-- Preserve historical paid orders.
UPDATE public.orders o
SET payment_status = 'paid',
    payment_updated_at = COALESCE(o.payment_updated_at, p.verified_at, o.updated_at)
FROM (
  SELECT order_id, max(verified_at) AS verified_at
  FROM public.payments
  GROUP BY order_id
) p
WHERE p.order_id = o.id AND o.payment_status <> 'paid';

UPDATE public.orders
SET payment_status = 'paid',
    payment_updated_at = COALESCE(payment_updated_at, updated_at)
WHERE status IN ('confirmed', 'completed') AND payment_status <> 'paid';

-- Persist the Pesapal IPN registration so every retry does not register it again.
CREATE TABLE IF NOT EXISTS public.payment_provider_settings (
  provider text PRIMARY KEY CHECK (provider IN ('pesapal')),
  ipn_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_provider_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_provider_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payment_provider_settings TO service_role;

CREATE TABLE IF NOT EXISTS public.order_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('method_changed', 'payment_recorded')),
  payment_method text NOT NULL CHECK (payment_method IN ('pesapal', 'mpesa', 'cash')),
  payment_status text NOT NULL CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  reference text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_payment_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view order payment events" ON public.order_payment_events;
CREATE POLICY "Admins view order payment events"
ON public.order_payment_events FOR SELECT TO authenticated
USING (public.is_admin());
GRANT SELECT ON public.order_payment_events TO authenticated;
GRANT ALL ON public.order_payment_events TO service_role;

CREATE OR REPLACE FUNCTION public.set_order_payment_method(_order_id uuid, _payment_method text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF _payment_method IS NULL OR _payment_method NOT IN ('pesapal', 'mpesa', 'cash') THEN
    RAISE EXCEPTION 'Choose a valid payment method';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.payment_status = 'paid' OR EXISTS (
    SELECT 1 FROM public.payments WHERE order_id = _order_id
  ) THEN
    RAISE EXCEPTION 'Payment has already been recorded; contact the store to change the payment method';
  END IF;

  UPDATE public.orders
  SET payment_method = _payment_method,
      payment_status = 'pending',
      payment_updated_at = now(),
      payment_updated_by = auth.uid()
  WHERE id = _order_id;

  INSERT INTO public.order_payment_events
    (order_id, event_type, payment_method, payment_status, amount, recorded_by)
  VALUES
    (_order_id, 'method_changed', _payment_method, 'pending', v_order.total_amount, auth.uid());

  -- Stop queued Pesapal jobs when the customer chooses another payment method.
  IF _payment_method <> 'pesapal' THEN
    UPDATE public.payment_tasks
    SET status = 'dead', error_message = 'Customer changed payment method'
    WHERE order_id = _order_id AND status IN ('pending', 'queued');
  END IF;

  RETURN jsonb_build_object('success', true, 'payment_method', _payment_method, 'payment_status', 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_order_paid(_order_id uuid, _reference text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an admin can record a payment';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'already_paid', true);
  END IF;

  UPDATE public.orders
  SET payment_method = COALESCE(payment_method, 'cash'),
      payment_status = 'paid',
      payment_reference = NULLIF(left(btrim(COALESCE(_reference, '')), 120), ''),
      payment_updated_at = now(),
      payment_updated_by = auth.uid()
  WHERE id = _order_id;

  INSERT INTO public.order_payment_events
    (order_id, event_type, payment_method, payment_status, amount, reference, recorded_by)
  VALUES
    (_order_id, 'payment_recorded', COALESCE(v_order.payment_method, 'cash'), 'paid',
     v_order.total_amount, NULLIF(left(btrim(COALESCE(_reference, '')), 120), ''), auth.uid());

  RETURN jsonb_build_object('success', true, 'payment_status', 'paid');
END;
$$;

-- Payment eligibility is based on payment_status, never fulfilment status.
CREATE OR REPLACE FUNCTION public.enqueue_payment_task(_order_id uuid, _callback_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_status text;
  v_task text;
BEGIN
  IF _callback_url IS NULL
     OR NOT (_callback_url LIKE 'https://%' OR _callback_url LIKE 'http://localhost%' OR _callback_url LIKE 'http://127.0.0.1%')
     OR _callback_url ~ '[[:space:]]' THEN
    RAISE EXCEPTION 'Invalid return address';
  END IF;

  SELECT payment_status INTO v_payment_status
  FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF v_payment_status IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_payment_status = 'paid' OR EXISTS (
    SELECT 1 FROM public.payments WHERE order_id = _order_id
  ) THEN
    RAISE EXCEPTION 'Order is already paid';
  END IF;

  SELECT status INTO v_task FROM public.payment_tasks WHERE order_id = _order_id FOR UPDATE;
  IF v_task IS NULL THEN
    INSERT INTO public.payment_tasks (order_id, callback_url) VALUES (_order_id, _callback_url);
  ELSIF v_task IN ('dead', 'failed') THEN
    UPDATE public.payment_tasks
    SET status = 'pending', retry_count = 0, next_attempt_at = now(),
        error_message = NULL, redirect_url = NULL, pesapal_tracking_id = NULL,
        callback_url = _callback_url
    WHERE order_id = _order_id;
  END IF;

  RETURN public.get_payment_task_status(_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.set_order_payment_method(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_mark_order_paid(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_payment_task(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_order_payment_method(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_order_paid(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_payment_task(uuid, text) TO anon, authenticated;
