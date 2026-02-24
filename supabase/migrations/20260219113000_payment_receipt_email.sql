-- Add customer email to orders for automatic receipt delivery.
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS customer_email text;

-- Basic email format and required-at-insert enforcement.
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_customer_email_format_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_customer_email_format_check
CHECK (
  customer_email IS NULL
  OR customer_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
);

-- Ensure public order inserts include email.
DROP POLICY IF EXISTS "Anyone can place orders" ON public.orders;
CREATE POLICY "Anyone can place orders"
ON public.orders
FOR INSERT
WITH CHECK (
  customer_name IS NOT NULL
  AND length(trim(customer_name)) > 0
  AND customer_phone IS NOT NULL
  AND length(trim(customer_phone)) >= 9
  AND customer_email IS NOT NULL
  AND customer_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  AND total_amount IS NOT NULL
  AND total_amount > 0
);

-- Track sent receipt emails to prevent duplicate sends.
CREATE TABLE IF NOT EXISTS public.receipt_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  payment_code text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.receipt_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view receipt email logs"
ON public.receipt_emails
FOR SELECT
USING (public.is_admin());

CREATE POLICY "Service role can insert receipt email logs"
ON public.receipt_emails
FOR INSERT
WITH CHECK (auth.role() = 'service_role');
