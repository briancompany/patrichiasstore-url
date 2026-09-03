-- ============ FLASH SALES ============
ALTER TABLE public.flash_sales
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS stock_allocated integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_sold integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_flash_sales_window ON public.flash_sales (is_active, starts_at, ends_at);

CREATE OR REPLACE FUNCTION public.get_active_flash_sales()
RETURNS TABLE(
  flash_sale_id uuid,
  product_id uuid,
  title text,
  sale_price integer,
  original_price integer,
  starts_at timestamptz,
  ends_at timestamptz,
  stock_allocated integer,
  stock_sold integer,
  remaining integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fs.id,
    fs.product_id,
    fs.title,
    fs.sale_price,
    fs.original_price,
    fs.starts_at,
    fs.ends_at,
    fs.stock_allocated,
    fs.stock_sold,
    CASE
      WHEN COALESCE(fs.stock_allocated, 0) <= 0 THEN 2147483647
      ELSE GREATEST(0, fs.stock_allocated - COALESCE(fs.stock_sold, 0))
    END AS remaining
  FROM public.flash_sales fs
  WHERE fs.is_active = true
    AND fs.starts_at <= now()
    AND fs.ends_at > now()
    AND (COALESCE(fs.stock_allocated, 0) <= 0
         OR COALESCE(fs.stock_sold, 0) < fs.stock_allocated)
  ORDER BY fs.ends_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_flash_sales() TO anon, authenticated, service_role;

-- Claim order stock now also reserves flash-sale units atomically.
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

  -- Reserve flash-sale units (only for live sales with a limited allocation).
  FOR r IN
    SELECT oi.product_id, SUM(oi.quantity)::int AS qty
    FROM public.order_items oi
    WHERE oi.order_id = _order_id AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id
  LOOP
    UPDATE public.flash_sales fs
    SET stock_sold = LEAST(fs.stock_allocated, COALESCE(fs.stock_sold, 0) + r.qty),
        is_active = CASE
          WHEN fs.stock_allocated > 0
               AND COALESCE(fs.stock_sold, 0) + r.qty >= fs.stock_allocated THEN false
          ELSE fs.is_active
        END
    WHERE fs.product_id = r.product_id
      AND fs.is_active = true
      AND fs.starts_at <= now()
      AND fs.ends_at > now()
      AND COALESCE(fs.stock_allocated, 0) > 0;
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

-- ============ SERVER MONITOR LOGS ============
CREATE TABLE IF NOT EXISTS public.server_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL DEFAULT 'info',
  event_type text NOT NULL,
  message text NOT NULL,
  endpoint text,
  method text,
  status_code integer,
  response_time_ms integer,
  ip_address text,
  user_id uuid,
  user_email text,
  source text NOT NULL DEFAULT 'client',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.server_logs
  ADD CONSTRAINT server_logs_severity_check
  CHECK (severity IN ('info', 'warning', 'error', 'critical'));

CREATE INDEX IF NOT EXISTS idx_server_logs_occurred_at ON public.server_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_logs_severity ON public.server_logs (severity);
CREATE INDEX IF NOT EXISTS idx_server_logs_event_type ON public.server_logs (event_type);

GRANT SELECT ON public.server_logs TO authenticated;
GRANT ALL ON public.server_logs TO service_role;

ALTER TABLE public.server_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can read server logs"
ON public.server_logs
FOR SELECT
TO authenticated
USING (public.is_admin() OR public.has_staff_role(auth.uid(), 'manager'));

-- Safe write path: events are inserted through this definer function only.
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
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_sev text;
  v_meta jsonb;
  v_email text;
BEGIN
  v_sev := lower(COALESCE(_severity, 'info'));
  IF v_sev NOT IN ('info', 'warning', 'error', 'critical') THEN
    v_sev := 'info';
  END IF;

  -- Strip anything that could carry secrets or payment data.
  v_meta := COALESCE(_meta, '{}'::jsonb);
  IF jsonb_typeof(v_meta) <> 'object' THEN
    v_meta := '{}'::jsonb;
  END IF;
  v_meta := v_meta
    - 'password' - 'pass' - 'token' - 'access_token' - 'refresh_token'
    - 'apikey' - 'api_key' - 'secret' - 'authorization' - 'auth'
    - 'card' - 'card_number' - 'cvv' - 'pin' - 'mpesa_code' - 'phone';

  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.server_logs (
    severity, event_type, message, endpoint, method,
    status_code, response_time_ms, user_id, user_email, source, meta
  )
  VALUES (
    v_sev,
    left(COALESCE(_event_type, 'unknown'), 60),
    left(COALESCE(_message, ''), 500),
    left(_endpoint, 200),
    left(_method, 10),
    _status_code,
    _response_time_ms,
    auth.uid(),
    v_email,
    'client',
    v_meta
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_server_event(text, text, text, text, text, integer, integer, jsonb) TO anon, authenticated, service_role;
