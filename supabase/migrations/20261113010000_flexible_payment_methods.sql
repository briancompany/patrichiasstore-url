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

-- Preserve historical paid orders when payment records or paid fulfilment states exist.
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

CREATE OR REPLACE FUNCTION public.set_order_payment_method(_order_id uuid, _payment_method text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF _payment_method NOT IN ('pesapal', 'mpesa', 'cash') THEN
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
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only an admin can record a payment'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'already_paid', true);
  END IF;

  UPDATE public.orders
  SET payment_status = 'paid',
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

REVOKE ALL ON FUNCTION public.set_order_payment_method(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_mark_order_paid(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_order_payment_method(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_order_paid(uuid, text) TO authenticated;
