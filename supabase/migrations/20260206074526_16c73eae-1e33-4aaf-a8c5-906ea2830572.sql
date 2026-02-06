-- Drop the restrictive insert policy that only works for anon,authenticated
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;

-- Create new policies that explicitly allow anonymous users to insert orders
CREATE POLICY "Public can insert orders" 
ON public.orders 
FOR INSERT 
TO public
WITH CHECK (true);

CREATE POLICY "Public can insert order items" 
ON public.order_items 
FOR INSERT 
TO public
WITH CHECK (true);