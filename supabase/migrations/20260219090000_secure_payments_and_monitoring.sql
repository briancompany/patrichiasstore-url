-- Secure payment verification audit logs
CREATE TABLE IF NOT EXISTS public.payment_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL,
  transaction_reference TEXT,
  verification_status TEXT NOT NULL,
  verification_message TEXT,
  verified_by TEXT NOT NULL DEFAULT 'backend',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_verification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view payment verification logs" ON public.payment_verification_logs;
CREATE POLICY "Admins can view payment verification logs"
ON public.payment_verification_logs
FOR SELECT
USING (is_admin());

DROP POLICY IF EXISTS "Service role can insert payment verification logs" ON public.payment_verification_logs;
CREATE POLICY "Service role can insert payment verification logs"
ON public.payment_verification_logs
FOR INSERT
TO authenticated
WITH CHECK (is_admin());

-- Payments can no longer be inserted from anonymous client traffic.
DROP POLICY IF EXISTS "Anyone can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can insert payments" ON public.payments;
CREATE POLICY "Admins can insert payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (is_admin());
