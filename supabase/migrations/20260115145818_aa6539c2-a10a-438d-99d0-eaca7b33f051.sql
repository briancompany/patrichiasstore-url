-- Create payments table to record all payment confirmations for admin
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  mpesa_code TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Policies for payments
CREATE POLICY "Anyone can insert payments" 
ON public.payments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can view all payments" 
ON public.payments 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Admins can delete payments" 
ON public.payments 
FOR DELETE 
USING (is_admin());

-- Also fix the order_tracking insert policy to allow anyone to insert
DROP POLICY IF EXISTS "Admins can insert order tracking" ON public.order_tracking;

CREATE POLICY "Anyone can insert order tracking" 
ON public.order_tracking 
FOR INSERT 
WITH CHECK (true);