-- Fix payments INSERT policy for anon users
DROP POLICY IF EXISTS "Anyone can insert payments" ON public.payments;

CREATE POLICY "Anyone can insert payments" 
ON public.payments 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);