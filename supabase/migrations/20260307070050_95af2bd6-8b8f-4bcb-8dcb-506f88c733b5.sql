-- Store customer contact email separately from orders for secure access
CREATE TABLE IF NOT EXISTS public.order_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_contacts' AND policyname = 'Anyone can insert order contacts'
  ) THEN
    CREATE POLICY "Anyone can insert order contacts"
    ON public.order_contacts
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
      order_id IS NOT NULL
      AND customer_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
      AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id)
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_contacts' AND policyname = 'Admins can view order contacts'
  ) THEN
    CREATE POLICY "Admins can view order contacts"
    ON public.order_contacts
    FOR SELECT
    TO authenticated
    USING (public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_order_contacts_updated_at'
  ) THEN
    CREATE TRIGGER update_order_contacts_updated_at
    BEFORE UPDATE ON public.order_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Receipt email audit table used by send-receipt-email function
CREATE TABLE IF NOT EXISTS public.receipt_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  payment_code TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.receipt_emails ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'receipt_emails' AND policyname = 'Admins can view receipt email logs'
  ) THEN
    CREATE POLICY "Admins can view receipt email logs"
    ON public.receipt_emails
    FOR SELECT
    TO authenticated
    USING (public.is_admin());
  END IF;
END $$;

-- Public RPC to upsert order contact details without exposing table reads
CREATE OR REPLACE FUNCTION public.upsert_order_contact_email(
  _order_id UUID,
  _customer_email TEXT,
  _customer_name TEXT DEFAULT NULL,
  _customer_phone TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _order_id IS NULL THEN
    RAISE EXCEPTION 'Order is required';
  END IF;

  IF _customer_email IS NULL OR btrim(_customer_email) = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF upper(_customer_email) !~ '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id) THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  INSERT INTO public.order_contacts (order_id, customer_email, customer_name, customer_phone)
  VALUES (_order_id, lower(btrim(_customer_email)), NULLIF(btrim(_customer_name), ''), NULLIF(btrim(_customer_phone), ''))
  ON CONFLICT (order_id)
  DO UPDATE SET
    customer_email = EXCLUDED.customer_email,
    customer_name = COALESCE(EXCLUDED.customer_name, public.order_contacts.customer_name),
    customer_phone = COALESCE(EXCLUDED.customer_phone, public.order_contacts.customer_phone),
    updated_at = now();

  RETURN TRUE;
END;
$$;

-- Internal RPC used by backend functions for secure email lookup
CREATE OR REPLACE FUNCTION public.get_order_contact_email(_order_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oc.customer_email
  FROM public.order_contacts oc
  WHERE oc.order_id = _order_id
  LIMIT 1;
$$;

-- Public safe tracking lookup RPC (no PII)
CREATE OR REPLACE FUNCTION public.get_order_tracking_public(_tracking_code TEXT)
RETURNS TABLE (
  order_id UUID,
  status public.order_status,
  total_amount INTEGER,
  created_at TIMESTAMPTZ,
  delivery_type public.delivery_type,
  item_count BIGINT,
  tracking_code TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw TEXT;
  v_token TEXT;
  v_canonical TEXT;
BEGIN
  v_raw := upper(btrim(COALESCE(_tracking_code, '')));
  IF v_raw = '' THEN
    RETURN;
  END IF;

  v_token := regexp_replace(v_raw, '^PS-', '');

  IF v_token !~ '^[A-Z0-9]{6,10}$' THEN
    RETURN;
  END IF;

  v_canonical := 'PS-' || v_token;

  RETURN QUERY
  SELECT
    o.id,
    o.status,
    o.total_amount,
    o.created_at,
    o.delivery_type,
    COALESCE(oi.item_count, 0) AS item_count,
    ot.tracking_code
  FROM public.order_tracking ot
  JOIN public.orders o ON o.id = ot.order_id
  LEFT JOIN (
    SELECT order_id, count(*)::bigint AS item_count
    FROM public.order_items
    GROUP BY order_id
  ) oi ON oi.order_id = o.id
  WHERE ot.tracking_code IN (v_canonical, v_token)
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_order_contact_email(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_tracking_public(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_contact_email(UUID) TO anon, authenticated;

-- Refresh API schema cache
SELECT pg_notify('pgrst', 'reload schema');