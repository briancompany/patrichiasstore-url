-- Fix order_tracking INSERT policy for anon users
DROP POLICY IF EXISTS "Anyone can insert order tracking" ON public.order_tracking;

CREATE POLICY "Anyone can insert order tracking" 
ON public.order_tracking 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);